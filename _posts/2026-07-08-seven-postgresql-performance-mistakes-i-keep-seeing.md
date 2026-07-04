---
layout: post
redirect_from:
  - /2026/07/08/seven-postgresql-performance-mistakes-i-keep-seeing/
  - /2026/07/08/seven-postgresql-performance-mistakes-i-keep-seeing.html
title: "7 PostgreSQL Performance Mistakes I Keep Seeing"
date: 2026-07-08 13:42:00 +0400
last_modified_at: 2026-07-08
description: "Seven PostgreSQL performance mistakes I keep seeing in production: pg_stat_statements sorting, FK indexes, ORM N+1s, wait vs exec time, index bloat, and EXPLAIN."
tags: [postgresql, performance, pg_stat_statements, explain analyze, indexes, foreign keys, orm, n+1, lock contention, query planner, backend engineering, fractional cto, rails]
author: eugene
categories: [PostgreSQL Performance]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/7-postgresql-performance-mistakes-i-keep-seeing.png
    alt: "Seven PostgreSQL performance mistakes – the bottleneck isn't where you look"
---

*Every PostgreSQL performance conversation starts the same way: "Did you add an index?" Almost none of them should start there.*

---

After enough production incidents, I noticed something uncomfortable: we rarely fixed PostgreSQL first. We fixed the assumptions we'd made about it.

At [Appbooster](https://appbooster.com?utm_source=eugenetheengineer.com&utm_medium=referral), I spent three and a half years on a high-load Rails product – PostgreSQL, Redis, 8–10k RPM on average, peaks around 25k. The kind of stack where performance problems show up in production, not in design docs. I wrote about that era in [How We Reduced PostgreSQL Query Time from 250ms to 20ms](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) and the reading method I use now in [Stop Reading EXPLAIN ANALYZE. Start Cross-Examining It.](/posts/stop-reading-explain-analyze-start-cross-examining-it/).

This post is the overview I wish someone had handed me before the first incident: seven mistakes I keep seeing – in myself, in every team I've reviewed, and in the "PostgreSQL is slow" tickets that land on a CTO's desk when the real problem is three layers up.

If you want the full series in reading order, start at the [PostgreSQL Performance Playbook](/postgresql-performance-playbook/).

---

## Mistake #1: Sorting `pg_stat_statements` by `mean_exec_time` Instead of Total Cost

The first thing most engineers do when Postgres feels slow is open PgHero or run a query against [`pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html) – the extension that tracks normalized query statistics (`CREATE EXTENSION pg_stat_statements;` required):

```sql
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

That list is almost useless for prioritization.

A 7ms query running 18 million times a day costs more than a 5-second query running twice. [`mean_exec_time`](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-COLUMNS) tells you which individual execution hurts. [`total_exec_time`](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-COLUMNS) tells you which query pattern owns your database.

The query I actually run first – same view, sorted by cumulative cost ([documented example](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-PGSTATSTATEMENTS)):

```sql
SELECT
  substring(query, 1, 100) AS query,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(
    100.0 * total_exec_time / sum(total_exec_time) OVER (),
    2
  ) AS pct_total
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

The `pct_total` column is the one that changes the conversation. When a single normalized query pattern accounts for 40% of all database time, you don't need a committee to decide what to fix next.

**For CTOs and founders:** this is how you stop funding a two-week "database optimization sprint" that chases a nightly report while a checkout query burns 30% of your RDS bill.

---

## Mistake #2: Assuming a Missing Index Is the Default Explanation

"Let's add an index" is the most confident sentence in backend engineering – and one of the most frequently wrong.

Most of the time, the planner already told you the real problem. Nobody read the estimate.

When you run [`EXPLAIN (ANALYZE, BUFFERS)`](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE), compare **Estimated Rows** to **Actual Rows** on every node. A 10× gap between what the planner expected and what actually happened is a smoking gun – and it usually points to stale statistics, a correlated column the planner can't model, or a filter that's less selective than anyone assumed. The `BUFFERS` option shows [buffer read counts](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) per plan node – shared hits vs reads from disk.

A sequential scan is not a bug. Postgres chooses it when it's cheaper than chasing index pointers across the heap. I've watched teams add indexes that made queries *slower* – not because Postgres ignored the index, but because it correctly priced it as a bad deal.

I wrote the full argument in [The Index Lie: Why "Just Add an Index" Can Make Your Query Slower](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/). The short version: an index locates rows, not data. Past a selectivity threshold, a seq scan wins. Every index also taxes every `INSERT` and `UPDATE` on that table.

Before you reach for `CREATE INDEX`, ask: *did the planner get the row estimate wrong, or did it get it right and choose the cheaper path?*

---

## Mistake #3: Blaming PostgreSQL When the ORM Is the Actual Bottleneck

New Relic says "Postgres time: 340ms." The database looks guilty. Often it isn't.

N+1 queries, `SELECT *`, and lazy-loaded associations turn a healthy database into a slow application. Rails makes this easy – `includes` vs `preload` vs `eager_load` is a decision most teams make once during onboarding and never revisit.

The tell in [`pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html) is high [`calls`](https://www.postgresql.org/docs/current/pgstatstatements.html#PGSTATSTATEMENTS-COLUMNS) with low `mean_exec_time`:

```sql
SELECT
  substring(query, 1, 80) AS query,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE calls > 1000
ORDER BY calls DESC
LIMIT 20;
```

When the same query pattern appears thousands of times per minute with nearly identical parameters, you've found an N+1 – or a loop in application code that should have been one query.

```ruby
# This is not a database problem.
users.each { |u| u.orders.sum(:total) }

# This is.
Order.where(user_id: users.map(&:id)).group(:user_id).sum(:total)
```

**For recruiters and hiring managers:** the engineer who can read `pg_stat_statements` and trace high `calls` back to application code is worth more than the one who knows seven index types but can't spot an N+1 in a Rails log.

---

## Mistake #4: Measuring Execution Time Instead of Wait Time

"The query is slow" and "the query is waiting on a lock" produce identical symptoms in your APM. They require opposite fixes.

Execution time is how long Postgres spent working. Wait time is how long your query sat in line – blocked on a lock, waiting for I/O, waiting for a buffer pin, waiting for replication. [`pg_stat_activity`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW) exposes this via [`wait_event_type` and `wait_event`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW):

```sql
SELECT pid, wait_event_type, wait_event, state, query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
  AND pid <> pg_backend_pid();
```

A result like `wait_event_type = Lock`, `wait_event = relation` means your "slow query" isn't slow – it's stuck behind another transaction. Adding an index won't help. Shortening a transaction will.

The [`pg_locks`](https://www.postgresql.org/docs/current/view-pg-locks.html) view lists held and awaited locks, but the docs explicitly recommend [`pg_blocking_pids()`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION) to find who blocks whom – the join across lock modes is easy to get wrong:

```sql
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
CROSS JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS bp(blocking_pid)
JOIN pg_stat_activity blocking ON blocking.pid = bp.blocking_pid
WHERE blocked.wait_event_type = 'Lock';
```

I've seen teams burn a sprint on index tuning while a `SELECT FOR UPDATE` inside a Sidekiq job held a row lock for 45 seconds. The database wasn't the bottleneck. The job design was.

---

## Mistake #5: Adding Indexes Forever, Never Removing Any

Every `UPDATE` and `INSERT` touches every index on that table. Half your indexes are probably pure write tax.

Indexes accumulate like kitchen gadgets – each one seemed useful when someone added it. Nobody tracks the ones that stopped earning their keep. [`pg_stat_user_indexes`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW) tracks per-index scan counts via [`idx_scan`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW):

```sql
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

`idx_scan = 0` since the last [statistics reset](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-STATS-VIEWS) means nobody has read from this index. That's not always grounds for immediate deletion – some indexes exist for constraint enforcement or rare admin queries – but it's grounds for a conversation.

Before you add index number twelve to a hot write table, ask what you're willing to remove. The [250ms → 20ms case study](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) wasn't just about adding the right partial index – it was about understanding which existing indexes the planner was ignoring and why.

---

## Mistake #6: Believing Foreign Keys Get Indexed Automatically

Only primary keys do.

PostgreSQL documentation is explicit: [foreign key declarations do not automatically create indexes](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) on the referencing columns. The referenced side is always indexed (it must be a PK or unique constraint). The referencing side is your problem.

I've watched a single unindexed foreign key on a 12-million-row table generate millions of sequential scans before anyone noticed – usually during a `DELETE` on the parent table or a `JOIN` through the FK column.

Find them by querying [`pg_constraint`](https://www.postgresql.org/docs/current/catalog-pg-constraint.html) (type `f` = foreign key) and checking for a matching entry in [`pg_index`](https://www.postgresql.org/docs/current/catalog-pg-index.html):

```sql
SELECT
  c.conrelid::regclass AS table_name,
  string_agg(a.attname, ', ' ORDER BY x.n) AS fk_columns,
  c.confrelid::regclass AS references_table,
  pg_size_pretty(pg_relation_size(c.conrelid)) AS table_size
FROM pg_constraint c
CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS x(attnum, n)
JOIN pg_attribute a ON a.attnum = x.attnum AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND i.indpred IS NULL
      AND (i.indkey::smallint[])[0:cardinality(c.conkey) - 1]
          OPERATOR(pg_catalog.@>) c.conkey
  )
GROUP BY c.conrelid, c.confrelid, c.conname
ORDER BY pg_relation_size(c.conrelid) DESC;
```

If that query returns rows, you have unindexed foreign keys. Add them with [`CREATE INDEX CONCURRENTLY`](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY) in production – the `CONCURRENTLY` keyword builds without locking writes.

Rails migrations make this easy to forget. `add_reference :orders, :user, foreign_key: true` creates the constraint. It does not create the index on `user_id`. You need `index: true` – or a linter in CI that catches the gap.

---

## Mistake #7: Running `EXPLAIN ANALYZE` Without Reading It

Knowing the command isn't the same as knowing why the planner picked Nested Loop over Hash Join.

Most engineers open a query plan, scan the operator names, and start guessing. "That Seq Scan looks suspicious." "Maybe it's the join." "Let's throw an index at it."

That's pattern-matching dressed up as debugging.

`EXPLAIN ANALYZE` is a transcript of what actually happened – full of testimony, timestamps, and discrepancies between what was expected and what occurred. Before you look at *which* operator Postgres chose, look at four numbers from the [plan output](https://www.postgresql.org/docs/current/using-explain.html):

1. **Actual Rows** – how many rows actually came out of this node
2. **Estimated Rows** – how many the planner *thought* would come out
3. **Loops** – how many times this node executed
4. **Buffers** – how much data was read, and from where ([`BUFFERS` option](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE))

There's a fifth cost most plans hide by default: **serialization**.

By default, `EXPLAIN ANALYZE` runs with [`SERIALIZE NONE`](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) – it measures how long Postgres spent *finding* rows, not how long it spent *converting them to a format the client can read*. That conversion – text or binary output functions, decompressing TOASTed values from out-of-line storage – can be a significant fraction of what your application actually waits for. Your APM measures end-to-end time. Your plan, without `SERIALIZE`, often doesn't.

```sql
EXPLAIN (ANALYZE, BUFFERS, SERIALIZE TEXT)
SELECT id, body, metadata FROM posts WHERE user_id = 42;
```

With [`SERIALIZE TEXT`](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) (or `SERIALIZE BINARY` for binary-protocol clients), Postgres performs the same output conversions a real execution would and reports the time separately. Combined with `BUFFERS`, any buffer reads involved in those conversions are counted too. The serialization line shows up in the plan output and is folded into total **Execution time**.

A few constraints worth knowing:

- `SERIALIZE` only works with `ANALYZE` – you can't profile serialization on a hypothetical plan
- `EXPLAIN` never sends data to the client, so **network transmission cost is not measurable** this way
- Writing `SERIALIZE` without an argument defaults to `TEXT`

When a query's plan nodes look fast but the endpoint is slow, and the SELECT pulls wide `text`/`jsonb` columns or TOAST-heavy payloads, run it again with `SERIALIZE TEXT` before you declare the database innocent.

A Nested Loop with 500,000 loops on the inner side isn't "the join is slow." It's "the planner thought the outer side would be small and it wasn't." A Hash Join that spills to disk isn't "we need more RAM." It's "the hash table exceeded `work_mem`." A fast plan with expensive serialization isn't "the ORM is lying" – it's "you measured retrieval, not delivery."

I wrote the full reading method in [Stop Reading EXPLAIN ANALYZE. Start Cross-Examining It.](/posts/stop-reading-explain-analyze-start-cross-examining-it/). The one rule that covers most cases: stop optimizing operators. Start optimizing the gap between estimation and reality.

---

## The Pattern Under All Seven

Engineers optimize the metric that's visible, not the one that's expensive.

Mean execution time is visible. Total cost is expensive. A missing index is visible. A bad row estimate is expensive. ORM query count is invisible until you enable `pg_stat_statements`. Lock wait time looks identical to slow execution in every APM dashboard I've used.

PostgreSQL isn't usually the bottleneck. The mental model of PostgreSQL is.

This is the same instinct I see in code review – commenting on surface shape instead of system consequences. I wrote about breaking that habit in [Most Engineers Review Code. Staff Engineers Review Decisions.](/posts/most-engineers-review-code-staff-engineers-review-decisions/). Database debugging has the same trap: you optimize what you can see in the first five minutes, not what actually costs money at scale.

**For CTOs:** if your team's default response to "the database is slow" is "add an index," you don't have a PostgreSQL problem. You have a diagnostic culture problem. The fix is cheaper than another RDS instance tier.

---

## The 15-Minute Audit

Run these seven checks in order. Each one takes about two minutes. Together they surface 80% of the mistakes above.

1. **Top queries by total cost** – [`pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html) ordered by `total_exec_time DESC`, not `mean_exec_time`
2. **High-call patterns** – same view, ordered by `calls DESC` where `calls > 1000` (N+1 detector)
3. **Unindexed foreign keys** – [`pg_constraint`](https://www.postgresql.org/docs/current/catalog-pg-constraint.html) + [`pg_index`](https://www.postgresql.org/docs/current/catalog-pg-index.html) query from Mistake #6
4. **Unused indexes** – [`pg_stat_user_indexes`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW) where `idx_scan = 0`
5. **Active lock waits** – [`pg_stat_activity`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW) where `wait_event IS NOT NULL`; use [`pg_blocking_pids()`](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION) to find the blocker
6. **Row estimate gaps** – [`EXPLAIN (ANALYZE, BUFFERS)`](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) on your top offender; look for 10× gaps between estimated and actual rows. If plan time looks fine but the endpoint doesn't, re-run with [`SERIALIZE TEXT`](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) to measure output conversion cost
7. **Stale statistics** – [`pg_stat_user_tables`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW): `last_analyze` and `last_autoanalyze`

```sql
SELECT relname, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY last_analyze NULLS FIRST
LIMIT 10;
```

Paste the `EXPLAIN` output into [explain.depesz.com](https://explain.depesz.com) if visual parsing helps. Enable [`pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html) on every production instance – if it's not on, that's check zero (`CREATE EXTENSION pg_stat_statements;`).

---

## PostgreSQL documentation referenced in this post

| What | Official docs |
|------|---------------|
| Query statistics (`total_exec_time`, `calls`) | [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html) |
| Session state and wait events | [pg_stat_activity](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW) |
| Lock inventory | [pg_locks](https://www.postgresql.org/docs/current/view-pg-locks.html) |
| Find blocking sessions | [pg_blocking_pids()](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-SESSION) |
| Index usage counters | [pg_stat_user_indexes](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW) |
| Table analyze timestamps | [pg_stat_user_tables](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW) |
| Foreign key constraints | [DDL constraints – FK](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) |
| Constraint catalog | [pg_constraint](https://www.postgresql.org/docs/current/catalog-pg-constraint.html) |
| Index catalog | [pg_index](https://www.postgresql.org/docs/current/catalog-pg-index.html) |
| Query plans | [EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html), [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) |
| Output serialization cost (`SERIALIZE TEXT` / `BINARY`) | [EXPLAIN – SERIALIZE](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) |
| Online index builds | [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY) |

---

## What's Your Most Recent Mistake?

I've made every mistake on this list. Some I caught in staging. Some I caught at 2 AM with a pager and a cold coffee.

The one I see most often in teams I review isn't technical at all – it's the reflex to treat PostgreSQL as the first suspect instead of the first witness.

What's the mistake on this list you've made most recently – and did you catch it before it hit production, or after?

If you're a founder or CTO whose team keeps circling the same "database is slow" tickets, [that's the kind of audit I do as a fractional CTO](/posts/looking-for-my-next-role/). The first hour is usually `pg_stat_statements` and a conversation about what your APM is actually measuring.

---

*More in this series: [PostgreSQL Performance Playbook](/postgresql-performance-playbook/) · [The Index Lie](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/) · [250ms → 20ms](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) · [Cross-Examining EXPLAIN](/posts/stop-reading-explain-analyze-start-cross-examining-it/)*
