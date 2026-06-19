---
layout: post
title: "How We Reduced PostgreSQL Query Time from 250ms to 20ms"
last_modified_at: 2026-06-11
description: "A production story about wrong indexes, planner regressions, and the query rewrite nobody wanted to do. Rails, PostgreSQL, PgHero, partial indexes."
tags: [postgres, sql, optimization, ruby on rails, performance, pghero, database, engineering leadership, fractional cto, backend, aws rds, query planner]
author: eugene
categories: [Tutorial, Coding]
comments : True
pin: false
render_with_liquid: false
image:
    path: /assets/img/how-we-reduced-postgresql-query-time-from-250ms-to-20ms.png
    alt: "How We Reduced PostgreSQL Query Time from 250ms to 20ms"
---

*A production story about wrong indexes, escaped prisoners, and the query rewrite nobody wanted to do.*

---

There's a particular kind of engineering pain that doesn't show up in sprint planning.

It accumulates quietly. A slow query here, a timeout there, a database CPU spike that costs you $20 to paper over. You file it under "technical debt," pay the bill, and move on. Until one day you can't anymore.

This is that story.

---

## The Background

Our backend is a Rails API on top of PostgreSQL, running at 8–10k RPM during the day with peaks around 25k RPM. The database lives in Amazon RDS — a `db.t3.xlarge`, 4 vCPU, 16GB RAM. T-type instances in RDS work on a credit model: run below your CPU baseline and you bank credits; hit a spike and you spend them. In theory, it's elegant cost management for bursty workloads.

In practice, we were slowly bleeding the credit balance dry.

For a while, we just topped it up. $20/month felt like a rounding error against our total infra spend. But the thing about gradual degradation is that it rarely stays gradual. It compounds. Database latency bled into endpoint response time. Endpoint response time bled into user experience. And I found myself in a pattern I recognized: putting out fires instead of writing code.

One day I wrote as much in our daily standup. Went to the project manager, explained the situation, and asked for dedicated time to actually investigate rather than patch. Got the green light. Opened New Relic.

What I saw confirmed the suspicion.

---

## Finding the Suspect

The New Relic timeline told a clear story: during peak load, response times regularly spiked past 1000ms. The yellow band — Postgres time — was swallowing most of it. Some requests were spending the majority of their lifecycle waiting on the database.

That narrowed the problem considerably. This wasn't a Ruby performance issue or a background job congestion. Something in the SQL layer was broken.

I installed [PgHero](https://github.com/ankane/pghero) to read from `pg_stat_statements`. This is one of the most underused diagnostic tools in the Rails/Postgres stack — it gives you query-level statistics aggregated over time: total time, average time, call count. The default sort by Total Time is exactly where you want to start. It surfaces the queries that matter, not just the ones that are slow in isolation.

Slow queries in PgHero are flagged at >100 calls/day and >20ms average. Our top offender wasn't borderline. It was averaging **250ms** and running hundreds of times per hour during peak load.

I pulled the `EXPLAIN ANALYZE` output into [explain.depesz.com](https://explain.depesz.com) and found what I was looking for: an Index Scan flagged red. The query was hitting an index on `created_at` — a broad, time-ordered index covering the entire table. Around **500,000 rows** scanned to return **40 results**.

That's not a query. That's a haystack search.

---

## Understanding the Data Shape

The query was for an in-app feature — a lottery-style mechanic where users bet internal currency. Each "battle" record has a status (e.g., `waiting_for_players`, `completed`, `cancelled`) and a bet amount. The query was looking for open battles where the bet didn't exceed the user's current balance.

Here's what the data actually looked like:

- **~500,000 total battle records** in the table
- **~40 records** with status `waiting_for_players` at any given moment

The existing index covered the full table by `created_at`. The query was doing a sequential scan through half a million historical records to find 40 active ones. The selectivity was catastrophically wrong.

The fix was a **partial index** — an index that only exists for the subset of rows that matter:

```ruby
add_index :arena_battles, :bet,
          where: "status = 'waiting_for_players'",
          name: "index_arena_battles_on_bet_partial_status"
```

This index covers only the 40 active records. It weighs **40 kilobytes** versus the original index at **40 megabytes**. We deployed the migration.

The endpoint response time dropped from ~250ms to ~30ms within hours.

We celebrated.

Too early.

---

## The Regression

Four days later, the latency was back.

Postgres has a query planner. The planner decides which index to use based on statistics it collects about data distribution. After a period of writes and reads, the planner had looked at both indexes and decided — incorrectly — that reverting to the old `created_at` index was more efficient. It wasn't. But statistics lie, especially when data distribution is extreme.

We were back to 250ms.

The standard playbook when a planner makes a bad decision:

1. Tune Postgres statistics/cost settings
2. Upgrade Postgres (we were on 9.6.11 — bumping to 9.6.15 was worth trying)
3. Look more carefully at what query Rails is actually generating

The third path led somewhere interesting.

---

## The Accomplice

Rails was generating this:

```sql
SELECT "arena_battles".*
FROM "arena_battles"
WHERE "arena_battles"."status" = 'waiting_for_players'
  AND (arena_battles.bet <= 98.13)
  AND (NOT EXISTS (
        SELECT 1 FROM arena_participations
        WHERE arena_battle_id = arena_battles.id
          AND (arena_profile_id = 46809)
      ))
ORDER BY "arena_battles"."created_at" ASC
LIMIT 10 OFFSET 0
```

See that `NOT EXISTS` subquery? It was added at some point to exclude battles where the user was already participating — a reasonable product requirement, implemented in the most Postgres-hostile way possible.

The correlated subquery runs once **per row** evaluated. For every candidate battle, Postgres has to execute a separate lookup against the participations table to check whether this user is already in it. With the partial index giving us 40 rows, this wasn't catastrophic. But it was enough to confuse the planner's cost estimates — and once the planner started preferring the old index again, we were suddenly doing this check against 500,000 rows.

The `EXPLAIN ANALYZE` confirmed it: `Planning time: 0.180ms`, `Execution time: 12.119ms` on the subquery path alone, before accounting for the index misselection.

The fix is a rewrite most Rails developers know in theory and avoid in practice:

```sql
SELECT "arena_battles".*
FROM "arena_battles"
LEFT JOIN arena_participations
  ON arena_participations.arena_battle_id = arena_battles.id
  AND (arena_participations.arena_profile_id = 46809)
WHERE "arena_battles"."status" = 'waiting_for_players'
  AND (arena_battles.bet <= 98.13)
  AND (arena_participations.id IS NULL)
ORDER BY "arena_battles"."created_at" ASC
LIMIT 10 OFFSET 0
```

`LEFT JOIN ... WHERE foreign_key IS NULL` is the canonical way to express "rows from A that have no matching row in B." It's set-based. It lets the planner reason about joins holistically rather than row-by-row. It gives the optimizer room to use the right index.

After the rewrite: `Planning time: 0.185ms`, `Execution time: 0.337ms`.

And with both fixes in place — the partial index and the LEFT JOIN rewrite — the average query time settled at **20ms**. End-to-end endpoint latency dropped accordingly and stayed down. The planner had no reason to regress; the query shape itself was no longer ambiguous.

---

## What Actually Fixed It (And Why It Mattered)

Two separate problems compounded into one production incident:

**Problem 1:** An index with catastrophically wrong selectivity. A partial index reduced the coverage from 500,000 rows to 40 — a 12,000x reduction in scan cost.

**Problem 2:** A correlated subquery that corrupted the planner's cost model. Rewriting to `LEFT JOIN / IS NULL` gave the planner a query shape it could optimize correctly and consistently.

Either fix in isolation was fragile. The partial index worked until the planner second-guessed itself. The subquery rewrite alone wouldn't have helped if the index was still wrong. Together, they locked in a stable execution path.

Total improvement: **250ms → 20ms**. A 12.5x reduction in query time, sustained.

The RDS credit balance stopped bleeding. We deleted the `created_at` index entirely — it wasn't used elsewhere. The table dropped from ~110MB to a more reasonable footprint.

---

## Lessons That Didn't Require a Postmortem

**1. `pg_stat_statements` + PgHero is your first call, not your last resort.**

Running this in production means you always have query-level evidence, not just endpoint-level symptoms. Install it before you need it.

**2. The query planner is a model, not a guarantee.**

It can make locally rational decisions that produce globally bad results, especially when data distributions are skewed. Don't assume an index will stay chosen. Verify with `EXPLAIN ANALYZE` periodically in production.

**3. `NOT EXISTS` with a correlated subquery is almost always wrong at scale.**

It reads cleanly. It performs terribly when the outer dataset grows. The LEFT JOIN / IS NULL pattern does the same thing and gives the planner room to work. Know this before you need to debug it.

**4. Partial indexes are underused.**

If your queries consistently filter on a low-cardinality status column — `active`, `pending`, `waiting` — and the table has significant historical data, a partial index is often the highest-leverage change you can make with the lowest surface area risk.

**5. Two problems can mask each other.**

The subquery was hiding how bad the index was. The index regression was hiding how bad the subquery was. Fixing one at a time gave us false confidence. Understand the interaction before you declare victory.

---

## Tooling Used

- **[New Relic](https://newrelic.com)** — endpoint-level response time tracking, surfaced the database as the bottleneck
- **[PgHero](https://github.com/ankane/pghero)** — query-level statistics via `pg_stat_statements`, identified the specific offender
- **[explain.depesz.com](https://explain.depesz.com)** — visual EXPLAIN ANALYZE output, made the index misselection immediately obvious
- **AWS RDS console** — credit balance and CPU utilization graphs confirmed before/after

None of this required exotic infrastructure. It required looking at the right layer with the right tools.

---

The whole investigation took a few days. The fixes were small. The impact was immediate and durable.

Most performance problems in Rails/Postgres applications aren't hard to fix. They're hard to find in time, before they become expensive enough to demand attention. Building the habit of looking — PgHero in production, `pg_stat_statements` always on, periodic slow query reviews — is what separates teams that are reactive from teams that aren't surprised.

We weren't surprised again.

---

<small>First published on [Habr](https://habr.com/ru/articles/509406/) in 2020. An earlier version with the detective metaphor lives [here](/posts/sql-optimization-or-criminal-tracking/). Working on a Rails/Postgres system showing early signs of this pattern? [Connect on LinkedIn](https://www.linkedin.com/in/eugeneleontev).</small>
