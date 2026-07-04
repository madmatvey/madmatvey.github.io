---
layout: post
title: "Stop Reading EXPLAIN ANALYZE. Start Cross-Examining It."
date: 2026-06-26 13:42:00 +0400
last_modified_at: 2026-06-26
description: "Four numbers, four myths, and one rule for reading Postgres query plans as evidence, not vibes. Actual rows, loops, buffers, and the 10x cardinality rule."
tags: [postgres, sql, optimization, database, query planner, explain analyze, performance, backend engineering, fractional cto, sequential scan, nested loop, buffers, cardinality]
author: eugene
categories: [PostgreSQL Performance]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/stop-reading-explain-analyze-start-cross-examining-it.png
    alt: "Stop Reading EXPLAIN ANALYZE – the operators aren't the story"
---

*`EXPLAIN ANALYZE` isn't a list of suspects. It's a transcript of what actually happened – and I read it like a mugshot lineup for years before I learned better.*

---

I spent years reading `EXPLAIN ANALYZE` wrong.

Not "wrong" in the sense of misunderstanding the syntax. I knew what a `Seq Scan` was. I knew a `Hash Join` from a `Nested Loop`. I could recite the difference between `Bitmap Heap Scan` and `Index Only Scan` in my sleep.

What I didn't know, for longer than I'd like to admit, was that knowing the vocabulary and knowing how to read the plan are two completely different skills.

At [Appbooster](https://appbooster.com?utm_source=eugenetheengineer.com&utm_medium=referral), I spent three and a half years on a high-load Rails product – PostgreSQL, Redis, 8–10k RPM on average, peaks around 25k. The kind of stack where performance problems show up in production, not in design docs. I was good at that work. I could find the slow query, fix the index, ship the patch. The feedback loop was immediate and honest. I wrote about that era recently in [From Senior Engineer to CTO](/posts/from-senior-engineer-to-cto-the-real-skill-gap-isnt-technical/) – and one thing I didn't say loudly enough there is how much of my "senior backend" credibility came from database debugging I was doing by pattern-matching, not by reading evidence.

Most engineers, past me included, open a query plan, scan the operator names, and start guessing: *"that Seq Scan looks suspicious," "maybe it's the join," "let's just throw an index at it and see."* That's not analysis. That's pattern-matching dressed up as debugging. I see the same instinct in code review — commenting on surface shape instead of system consequences — and wrote about breaking that habit in [Most Engineers Review Code. Staff Engineers Review Decisions.](/posts/most-engineers-review-code-staff-engineers-review-decisions/).

`EXPLAIN ANALYZE` exists precisely so you don't have to guess. It's not a list of suspects. It's a transcript of what actually happened when Postgres ran your query – full of testimony, timestamps, and discrepancies between what was expected and what occurred. Read it like that, and most "mystery" slow queries stop being mysteries.

This is the reading method I now use on every slow query that lands on my desk – whether it's a 200-row admin dashboard, a [single aggregated JSON call for a Telegram Mini App](/posts/ux-when-initial-app-loading/), or a billing reconciliation query where [balance is derived from postings, not read from a column](/posts/your-billing-system-probably-isnt-an-accounting-system/). It comes down to four numbers, four myths, and one rule.

I learned most of this the hard way, on a production incident I first wrote about in 2020 as [Optimizing SQL Queries or Tracking Dangerous Criminals](/posts/sql-optimization-or-criminal-tracking/) and retold more recently in [How We Reduced PostgreSQL Query Time from 250ms to 20ms](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/). That story is the spine of everything below.

---

## The Four Numbers That Matter More Than Any Operator Name

Before you even look at *which* operator Postgres chose, look at four numbers:

1. **Actual Rows** – how many rows actually came out of this node
2. **Estimated Rows** – how many rows the planner *thought* would come out
3. **Loops** – how many times this node executed
4. **Buffers** – how much data was read, and from where

Almost every real performance problem reveals itself through some combination of these four. The operator name – `Seq Scan`, `Hash Join`, `Nested Loop` – is just the planner's chosen strategy. The four numbers tell you whether that strategy was actually a good idea, given what really happened at runtime.

When our arena battles endpoint was averaging 250ms, I pasted the plan into explain.depesz.com and immediately saw a red-flagged `Index Scan`. That felt like progress. What I *didn't* do yet was ask why the planner thought scanning ~500,000 rows to return ~40 was a reasonable trade – or whether the numbers on the nodes feeding the join told a different story than the operator names.

Here's the reframe that matters: stop optimizing operators. Start optimizing the gap between estimation and reality.

---

## Myth #1: "Seq Scan Means Something Is Wrong"

This is the single most repeated piece of bad advice in every "how to read EXPLAIN" thread on the internet: *if you see a sequential scan, add an index.*

It's not just incomplete advice. It's actively misleading, because the same two words – `Seq Scan` – describe two completely different situations:

```
Seq Scan on users  (cost=0.00..1.05 rows=12 width=64)
```

```
Seq Scan on event_logs  (cost=0.00..892341.00 rows=48000000 width=64)
```

A sequential scan over 12 rows in a lookup table is not a problem. It's frequently *faster* than an index scan, because Postgres skips the overhead of traversing an index structure entirely. A sequential scan over 48 million rows in your events table is a different story – and it's effectively unavoidable unless the planner has a selective predicate and a usable index to filter on first.

In the plan, both nodes look almost identical at a glance: same operator name, same shape. The only way to tell them apart is to actually read the row counts attached to them.

The corrected version of the rule: **the operator name tells you nothing on its own. The row count next to it tells you almost everything.**

I learned this twice. First when I watched an index make a query *worse* – Postgres didn't ignore it, it priced it and chose differently. I unpacked that mental model in [The Index Lie](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/). Then again on the arena battles query, where the problem wasn't "no index" but an index with catastrophically wrong selectivity: a `created_at` index covering half a million historical rows to find forty with status `waiting_for_players`. The fix was a partial index scoped to the rows that actually mattered – 40 kilobytes instead of 40 megabytes. Full story in the [250ms → 20ms write-up](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/).

---

## Myth #2: "The Highest-Cost Node Is the Problem"

`cost=0.00..892341.00` looks alarming. It's tempting to chase the biggest cost number in the plan and assume that's your bottleneck.

Cost is not a measurement. Cost is the planner's *opinion*, calculated before the query ever runs, based on table statistics, configured cost constants, and assumptions about how selective your filters will be.

`EXPLAIN ANALYZE` gives you something cost can't: actual execution time. That means every node in the plan carries two separate realities:

```
Planner's opinion:    cost=0.43..847.21 rows=3400 width=120
Execution reality:     actual time=0.021..412.887 rows=89 loops=1
```

The interesting work isn't in either number alone – it's in the *gap* between them. A node where the planner expected to do a small amount of work, and actually did a huge amount of work (or vice versa), is where your investigation should start. A node with a high cost number but execution time that matches expectations is usually just an expensive query that's expensive for legitimate reasons.

Chase the discrepancy, not the size of the number.

This is exactly what bit us when the partial index landed and latency dropped to ~30ms – and then four days later the planner regressed to the old `created_at` index. Locally rational decision, globally bad outcome. The cost model looked plausible on paper. Runtime didn't. I spent a day tuning statistics and bumping Postgres patch versions before I stopped arguing with the planner's opinion and started reading what actually happened in the plan after the regression.

---

## The 10x Rule: Reading Estimated vs. Actual Rows

This is the single highest-leverage thing you can do when reading a plan, and it takes ten seconds once you know to look for it.

Find the ratio between estimated rows and actual rows on each node:

- **~2x off** – normal. Statistics are never perfectly precise.
- **~5x off** – worth a second look, especially on a node feeding a join.
- **~10x off** – suspicious. Something about your statistics, your predicate, or your data distribution is misleading the planner.
- **~100x off** – you've almost certainly found your root cause.

Why does this matter so much? Because cardinality estimates aren't just a footnote – they're the input to nearly every decision the query planner makes:

- **Join order** – which table gets scanned first
- **Join strategy** – hash join, merge join, or nested loop
- **Memory allocation** – how much `work_mem` gets reserved for a sort or hash table
- **Parallelism** – whether the planner believes parallel workers are worth the overhead

A bad cardinality estimate doesn't just mislead you when you're reading the plan after the fact – it actively misled the planner *before* it built the plan. A planner that thinks a join will produce 50 rows will happily choose a nested loop. If that join actually produces 500,000 rows, you now have a nested loop iterating half a million times, and the plan will look "fine" at a glance because every individual operator still has a small, polite-looking cost.

Stale statistics, correlated columns the planner can't model, and skewed data distributions are the usual suspects. The fix is rarely glamorous – `ANALYZE`, extended statistics, or rewriting a predicate so it's more transparent to the planner – but finding *which* node has the 10x+ miss is what tells you where to point that fix.

On the arena battles table, the data shape was extreme: ~500,000 total records, ~40 active at any moment. That's not a 10x miss – it's orders of magnitude. No amount of operator-name staring surfaces that. Only the row counts do. Once I internalized the 10x rule, I started running it on every audit – including billing systems where [balance-as-query](/posts/your-billing-system-probably-isnt-an-accounting-system/) means a `SUM` over postings that looks innocent in development and turns into a cardinality surprise at scale.

---

## Myth #3: "The Node With the Biggest Execution Time Is the Culprit"

This one trips up even experienced engineers, because the plan's tree structure isn't intuitive if you've never had it explained.

```
Hash Join              (actual time=0.512..501.204 rows=89 loops=1)
 -> Seq Scan on orders  (actual time=0.018..142.331 rows=900000 loops=1)
 -> Seq Scan on users   (actual time=0.009..0.412 rows=1200 loops=1)
```

If you scan for the biggest number here, your eye lands on the `Hash Join` at 501ms. That's the wrong read. A parent node's `actual time` is **inclusive of everything beneath it**. The Hash Join didn't spend 501ms joining – it spent 501ms total, of which roughly 142ms was waiting on the `orders` scan underneath it.

The question to ask isn't *"which node shows the biggest number?"* It's *"where does the time start accumulating that wasn't already accounted for by the children?"* In the example above, the actual culprit is more likely the gap between 142ms (orders scan) and 501ms (the join itself) – nearly 360ms that the join node is responsible for on its own, independent of its children.

Once you internalize that times are cumulative up the tree, you stop chasing the visually biggest number and start subtracting child time from parent time – which is usually where the real cost is hiding.

I made this mistake in the original 2020 investigation. New Relic showed Postgres swallowing endpoint time; I opened the plan, saw a big number at the top, and almost declared victory when I found an index to add. The real accumulation was lower in the tree – and it took a second pass, subtracting child times, to see that the index wasn't the whole story. explain.depesz helped because it calculates per-operation timing on the side, but the habit matters more than the tool: parent time minus children, bottom up.

---

## Myth #4: Nobody Checks Loops, and That's Exactly the Problem

This is the one that produces the most "wait, what?" reactions when I walk a team through a plan, because it's so easy to miss and so expensive when you do.

```
Index Scan using orders_user_id_idx on orders
  (actual time=0.005..0.052 rows=4 loops=58000)
```

At a glance: `actual time=0.005..0.052`. That looks fast. Your brain reads "0.05 milliseconds" and moves on.

Here's the catch: for nodes inside a loop – typically the inner side of a nested loop join – the `actual time` shown is the **average time per loop**, not the total. The real cost is:

```
0.052 ms × 58,000 loops ≈ 3,016 ms
```

Three seconds, hiding behind a number that looked like it belonged in the noise floor. This is exactly how a nested loop join can look completely innocent at every individual node, while the query itself crawls. Each iteration is cheap. There are just an enormous number of iterations, because the outer side of the join produced far more rows than expected – which, notice, usually traces straight back to the cardinality miss from the 10x Rule above.

Loops and the 10x Rule aren't separate tricks. They're usually the same root cause, observed from two different angles. A nested loop with a high loop count is frequently the *symptom*; a bad cardinality estimate on the outer side is frequently the *cause*.

This is the trap that almost kept our arena battles query slow even after the partial index worked. Rails had generated a `NOT EXISTS` correlated subquery – reasonable product requirement, Postgres-hostile implementation. The subquery ran once **per row** evaluated. With 40 candidate rows it wasn't catastrophic. Once the planner regressed to the old index and the outer set ballooned to 500,000 rows, it became a loop-count disaster hiding behind polite per-iteration timings. Rewriting to `LEFT JOIN ... WHERE id IS NULL` collapsed the loop structure. That rewrite – not another index – is what took execution from 12ms on the subquery path alone down to 0.3ms. Details in the [full production story](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/).

---

## BUFFERS: The Most Underused Flag in Your Toolkit

Most engineers run:

```sql
EXPLAIN ANALYZE SELECT ...
```

Fewer run:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...
```

That one extra word changes what question you're able to answer. Without `BUFFERS`, you know *how long* something took. You have no idea *why* – specifically, whether you were CPU-bound or I/O-bound.

`BUFFERS` adds output like:

```
Buffers: shared hit=842 read=15234
```

- **`hit`** – pages found already in shared buffers (memory). Fast.
- **`read`** – pages that had to be pulled from disk (or the OS cache, depending on your setup). Slow, comparatively.

A node with a high `read` count relative to `hit` is telling you something timing alone never will: this query is fighting your buffer cache, possibly because the working set doesn't fit in memory, possibly because of a cold cache, possibly because an index isn't being used the way you expect. A node that's slow but shows almost entirely `hit` buffers is telling you the bottleneck is CPU-bound computation, not disk access – and that changes what kind of fix is even worth attempting.

Skipping `BUFFERS` means you're debugging with half the evidence available to you, every single time.

I'll be honest: in the 2020 investigation I ran `EXPLAIN ANALYZE` without `BUFFERS` for longer than I should have. Our RDS instance was bleeding CPU credits – a symptom that screamed I/O and cache pressure – but I was staring at execution times trying to decide whether the bottleneck was disk or computation. `BUFFERS` would have answered that in one pass. I mention this because [The Index Lie](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/) already argues for `EXPLAIN (ANALYZE, BUFFERS)` as the default, and I wrote that article partly as a note to my younger self.

---

## Putting It Together: Reading a Plan as Evidence, Not Vibes

When a slow query lands in front of me now, the sequence looks like this:

1. **Run it with everything on**: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` – or JSON if I'm feeding it into a visualizer.
2. **Scan for the 10x+ row estimate misses** before reading anything else. This usually tells me where the planner was misled.
3. **Subtract child time from parent time**, working from the bottom of the tree up, to find where time is actually accumulating rather than just being passed through.
4. **Check loop counts** on any node sitting inside a nested loop. A small per-loop number with a large loop count is a silent multiplier.
5. **Check `Buffers`** on the worst offending nodes to know whether I'm chasing a CPU problem or an I/O problem – because the fix is different for each.
6. **Only then** do I look at the operator names, and by that point they usually just confirm what the four numbers already told me.

On the arena battles incident, steps 2 and 4 together found both problems: the partial index addressed the cardinality catastrophe on the status filter; the `LEFT JOIN` rewrite addressed the loop multiplier the correlated subquery was hiding. Either fix alone was fragile – the index regressed without the rewrite, and the rewrite alone wouldn't have helped with the wrong index still in play. I wrote about that interaction in the [250ms post](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) as lesson #5: two problems can mask each other.

The fix, once you've actually found the problem, is often trivial – a missing index, an `ANALYZE` to refresh stale statistics, a rewritten predicate that's more transparent to the planner. The fix takes ten seconds. Finding the actual problem, instead of guessing at it, is where the three hours go. That ratio doesn't change with experience. What changes is how systematically you spend those three hours.

It's also, frankly, the unglamorous work that teams defer in favor of greener pastures. I wrote about that pattern in [Biggest Engineering Wins Were Things We Didn't Build](/posts/the-biggest-engineering-wins-were-things-we-didnt-build/) – the actual bottleneck is usually a slow query, not the Hypothetical Future feature on the roadmap. Reading plans systematically is how you find those bottlenecks before they become $20/month in RDS credits, then $200, then a pager at 2am.

---

## Tools That Make Plans Easier to Read

Reading raw text output is a skill worth having – it's always available, in any environment, with zero setup. But once plans get deep or you're dealing with parallel workers, a visualizer earns its place. Here are the ones I actually use:

- **[explain.depesz.com](https://explain.depesz.com/)** – where I pasted the arena battles plan in 2020 and immediately saw the index misselection flagged red. Still my first stop: color-codes slow nodes, calculates per-operation timing, lets you collapse subtrees you've ruled out. Zero setup.

- **[PEV2](https://explain.dalibo.com/)** (hosted at explain.dalibo.com) – useful when I want to eyeball which dimension is driving slowness – time, rows, cost, or buffers – before digging into individual nodes. Free, open source, runs offline.

- **[pgMustard](https://www.pgmustard.com/)** – when I'm handing a plan to someone less comfortable reading raw output, or I want a second opinion on row estimate mismatches surfaced in plain language.

- **[explain-postgresql.com](https://explain-postgresql.com/)** – handy for Citus/TimescaleDB/Greenplum plans when I'm not on vanilla Postgres.

- **[PgHero](https://github.com/ankane/pghero)** – not a plan visualizer, but the tool that told me *which* query to run `EXPLAIN` on in the first place. `pg_stat_statements` aggregated by total time surfaced our 250ms offender before I ever opened a plan. I reach for it before explain.depesz on every new audit.

- **Built-in IDE visualizers** – DBeaver, DataGrip, and others. Convenient, less detailed than depesz for the parent/child time math.

None of these tools replace the reading method above – they just remove the friction of manually tracing parent/child time relationships or scanning for the worst row-count misses by eye. Pick whichever fits your workflow, but make sure `BUFFERS` is part of whatever plan you feed in. A pretty visualization of a plan that's missing buffer stats still only shows you half the picture.

---

## The Actual Skill

`EXPLAIN ANALYZE` isn't a query optimization tool. It's a reality-check tool. It exists to replace guessing with evidence – but only if you know which four numbers to interrogate before you let yourself look at the operator names.

The hardest part was never fixing the database. It was learning to stop guessing long enough to let the plan tell me what actually happened.

I spent years being the person who could "fix the slow query" without being the person who could *read* the plan. The gap between those two identities is smaller than it looks – four numbers, four myths, one rule – and it took a production incident, an RDS credit balance hitting zero, and a partial index plus a query rewrite to finally close it for me. If you're on the same journey, start with [The Index Lie](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/) for the mental model, then [the 250ms story](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) for what it looks like when all four myths show up in the same plan.

---

*If your team is debugging the same slow queries over and over without a repeatable method for reading the plan – or scaling a Postgres-backed system into a regime where these misses start costing real money – that's the kind of production problem I work on with engineering teams as a fractional CTO. [Happy to talk through what you're seeing](https://www.linkedin.com/in/eugeneleontev).*
