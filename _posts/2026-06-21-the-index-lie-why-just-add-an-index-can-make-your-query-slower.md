---
layout: post
title: "The Index Lie: Why \"Just Add an Index\" Can Make Your Query Slower"
date: 2026-06-21 13:42:00 +0400
last_modified_at: 2026-06-21
description: "PostgreSQL doesn't ignore your index – it prices it. When index scans lose to sequential scans, what Heap Fetches, correlation, and write-side maintenance actually mean."
tags: [postgres, sql, optimization, database, query planner, indexing, performance, backend engineering, fractional cto, sequential scan, index-only scan, brin, partial index, explain analyze]
author: eugene
categories: [Engineering, Coding]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/the-index-lie-why-just-add-an-index-can-make-your-query-slower.png
    alt: "The Index Lie: Why Just Add an Index Can Make Your Query Slower"
---

*Postgres doesn't ignore your index. It runs a cost calculation you didn't run – and sometimes the index loses.*

---

There's a sentence I've heard in more incident retros than almost any other:

"Let's add an index."

It's said with confidence, because it's usually right. Most of the time, adding an index to a slow query is the correct first move. But I've also sat in front of a screen watching a query get *worse* after the index landed – not marginally worse, noticeably worse – and had to explain to a team why the database we all trust apparently "ignored" the thing we just gave it.

It didn't ignore it. It evaluated it. And it decided the index was a bad deal.

That distinction is the whole article.

> **TL;DR:** An index locates rows, not data. Past a selectivity threshold that shifts with correlation, I/O cost settings, and cache state, Postgres correctly prefers a sequential scan over chasing index pointers across the heap. Every index also taxes writes. Plans that were optimal at 10k rows can flip at 500M. 

> The fix isn't `SET enable_seqscan = off` – it's `EXPLAIN (ANALYZE, BUFFERS)` and treating indexing as ongoing operations work.

---

## Indexes don't retrieve data. They locate rows.

This is the part most engineers skip past without really absorbing: an index is not a shortcut to your data. It's a shortcut to *where your data might be*. Those are different jobs, and conflating them is where the mental model breaks.

When Postgres uses a B-tree index to satisfy `WHERE country = 'US'`, what it actually gets back is a list of row locations – tuple identifiers pointing into the heap, the table's real storage. To turn those locations into actual rows – the columns you asked for – it still has to go fetch each one from the heap. Unless the index happens to contain every column the query needs *and* the visibility map confirms those heap pages are all-visible, every matching row costs a separate trip to the heap.

That exception matters more than people realize. An **index-only scan** can skip heap access when the index stores the indexed data values and the visibility map bit for that heap page is set – meaning every row on the page is visible to every transaction. PostgreSQL maintains this map precisely because MVCC visibility information lives in the heap, not the index. When you see `Heap Fetches: 0` in `EXPLAIN ANALYZE`, the covering index and visibility map are doing their job. When you see `Heap Fetches: 847,291`, you're paying the random-read tax on every match.

If your query matches twelve rows, that's twelve cheap trips. Index wins, easily.

If your query matches eight hundred thousand rows, that's eight hundred thousand mostly-random reads scattered across the table's physical layout. At that point, reading the entire table once, in order, front to back, is frequently cheaper than chasing the index pointer by pointer. That's a sequential scan, and it's not the planner being lazy – it's the planner doing arithmetic you didn't do.

There's also a middle path worth knowing: **bitmap index scans**. When the planner expects a moderate number of matches – too many for a straight index scan to be efficient, too few to justify reading the whole table – it can probe the index, build a bitmap of matching heap pages, and then visit those pages in physical order. You get index selectivity without fully random I/O. The plan won't always say "Seq Scan" or "Index Scan"; sometimes it says `Bitmap Heap Scan`, and that's the planner splitting the difference.

Picture a library. If you need one specific book, the card catalog is obviously faster than walking every aisle. If you need half the books in the building, the catalog stops helping – at some point you're better off just walking the aisles once and grabbing everything as you pass it. Postgres's query planner is running exactly that comparison, every time, using actual statistics about your data instead of intuition.

---

## The threshold is not a fixed number, and that's the trap

A lot of engineers want a rule: "if the query returns more than X% of the table, the index gets skipped." It's tempting, and it's not quite true. The real threshold shifts based on:

- **Physical correlation** – how randomly the matching rows are scattered across the table's pages. Postgres tracks this in `pg_stats` as the `correlation` column: values near 1.0 mean row order on disk closely follows index order; values near 0 mean matches are scattered. Low correlation pushes the planner toward sequential scans earlier.
- **The configured cost ratio between random I/O and sequential I/O** – `random_page_cost` (default 4.0) vs `seq_page_cost` (default 1.0). On SSD-backed storage, many teams lower `random_page_cost` toward 1.1–1.5 because random reads are far less punitive than on spinning disks. That single tuning change can flip plans.
- **Whether the table has been recently vacuumed and analyzed**, since stale statistics produce confidently wrong plans. `ANALYZE` samples the table and updates `pg_stats`; without it, the planner is optimizing against a photograph of your data from last week.
- **The size of the table relative to available cache** – a table that fits comfortably in `shared_buffers` behaves very differently than one that doesn't, because sequential scans on cached data are nearly free.

That 20–40% selectivity range people cite as a rule of thumb is a reasonable mental anchor, not a constant. I've seen plans flip to a seq scan at 8% on a poorly-correlated table, and stay on an index scan past 60% on a well-clustered one. The official docs put it plainly: for queries fetching a large fraction of the table, an explicit sequential scan is often faster because disk I/O stays sequential. If you're debugging a plan, the number that actually matters is the one in your own `EXPLAIN (ANALYZE, BUFFERS)` output, not a blog post's rule of thumb – including this one.

When you do run that explain, look past the node type. The `Buffers:` line tells you what actually hit disk versus cache. `shared read=N` is cold I/O; `shared hit=N` is cache. That's the arithmetic the planner approximated – now you can see whether it was right.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE country = 'US';
```

---

## Nobody mentions the write-side cost until it's already a problem

Here's the half of the conversation that almost never happens before the index gets added: every index you create has to be maintained on every insert, update, and delete that touches it. Not occasionally – every single time.

There's a partial escape hatch. **HOT updates** (Heap-Only Tuple) let Postgres update a row in-place without touching indexes – but only when no indexed column changes and there's free space on the same heap page. The moment your `UPDATE` touches a column that's indexed, every index on that column gets updated. Add four indexes to a write-heavy table and you've multiplied the write amplification.

I've watched this play out in a fairly predictable shape. A team notices a slow `SELECT`, adds three or four indexes to cover different filter combinations, and the read path gets noticeably faster. Nobody benchmarks the write path before or after, because the original complaint was about reads. A few weeks later, insert latency on that table has crept up, batch jobs are taking longer, and nobody connects it back to the indexing work, because the read query really did get faster – it's just that the table as a whole got slower to write to, and that cost is paid continuously rather than in one visible spike.

This isn't an argument against indexes. It's an argument for treating every index as a trade you're making on purpose, with a cost on both sides of the ledger, rather than a free upgrade.

---

## The index that was right two years ago might not be right today

The other failure mode I'd flag is less about a single bad decision and more about decay. An index tuned against ten thousand rows reflects the data distribution of ten thousand rows: how values are spread, how selective each filter actually is, how the planner's statistics characterize that shape. Grow the table to five hundred million rows and none of those assumptions necessarily survive. Selectivity changes. Correlation changes. The statistics the planner relies on get recalculated, and the cost comparison that used to favor your index can quietly flip.

The uncomfortable version of this: an indexing decision that was clearly correct at last year's scale can become clearly wrong at this year's scale, and nothing about your application code has to change for that to happen. The table just has to grow. This is one of the reasons I treat index review as a recurring operational task tied to growth checkpoints, not a one-time decision made during initial schema design.

---

## The actual mental model shift

The reframe that matters here isn't "indexes are bad" or "trust the planner blindly." It's narrower than that:

Most engineers optimize for *having* an index. Postgres optimizes for *cost*. When those two things disagree, the engineer assumes the database made a mistake. Usually, it didn't – it ran a calculation you didn't run, using statistics you didn't look at.

So when someone says "Postgres is ignoring my index," what's almost always true is: "Postgres calculated that my index is the more expensive option for this query, on this data, at this scale, right now." That's not a bug report. It's a cost estimate you disagree with, and the right response is to go look at *why*, not to force the planner's hand with `SET enable_seqscan = off` and call it fixed.

Forcing the planner is a diagnostic step, not a production fix. It tells you what the index path would cost if chosen – useful for confirming your hypothesis – but leaving it on masks the underlying problem. The planner will still be wrong about other queries, and you've traded a readable plan for a slower one.

---

## What this actually changes about how you operate

In practice, this shifts where the work goes. Past a certain scale, the lever isn't "which index do I add next." It's:

- **Selectivity** – does this filter actually narrow the result set enough to justify an index, given how the data is distributed today, not when the schema was designed? Check `pg_stats` for the column's `n_distinct` and `most_common_vals`.
- **Correlation** – would a `CLUSTER` (one-time physical reorder via `CLUSTER tablename USING indexname`) or a **BRIN** index serve this access pattern better than another B-tree? BRIN indexes store min/max summaries per block range and shine when column values correlate with physical row order – they're tiny compared to B-tree, but useless when data is randomly scattered.
- **Partial and covering indexes** – can the index be scoped to the subset of rows actually queried (`WHERE status = 'active'`), or extended with `INCLUDE (column)` to carry output columns without making them part of the search key? That last option is how you get index-only scans without bloating the key.
- **Partitioning and data locality** – at real scale, the question stops being "which index" and becomes "should this data even live in one table."
- **Periodic re-validation** – pulling `EXPLAIN (ANALYZE, BUFFERS)` on your highest-traffic queries on a schedule, not just when something breaks, since the plan that was optimal six months ago is not guaranteed to still be optimal.

None of this is exotic. It's the difference between treating indexing as a one-time tuning step and treating it as part of the system's ongoing operating model – something that gets revisited as the data shape changes, because it will.

---

*If you're hitting query plans that don't match your intuition, or scaling decisions that worked at one order of magnitude and stopped working at the next, that's usually a sign the system has outgrown the assumptions it was designed under – not that something is broken. I work with engineering teams on exactly this kind of backend and database scaling decision-making. [Happy to talk through what you're seeing](https://www.linkedin.com/in/eugeneleontev/).*
