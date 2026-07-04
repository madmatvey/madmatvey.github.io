---
layout: post
title: "PostgreSQL Partial Indexes: Index Less, Query Faster"
date: 2026-07-06 13:42:00 +0400
last_modified_at: 2026-07-06
description: "PostgreSQL partial indexes: one WHERE clause for 20-30x smaller indexes, less write amplification, and race-proof rules like one draft per user."
tags: [postgresql, partial index, indexes, unique index, write amplification, query planner, indexing, database performance, rails, backend engineering, fractional cto]
author: eugene
categories: [PostgreSQL Performance]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/postgresql-partial-indexes-index-less-query-faster.png
    alt: "PostgreSQL partial index vs full B-tree index – index what you actually query"
---

*PostgreSQL will index literally anything you tell it to – including 11.8 million rows you will never query again in your life. I've never seen an index apologize for being 30x bigger than it needs to be. It just quietly taxes every INSERT instead.*

---

Most "database performance tuning" starts with rewriting SQL. Mine usually starts with deleting indexes that have been quietly collecting rent since 2019.

I keep seeing the same pattern in schema reviews: a `status` column, 95% of rows sitting at `completed`, and a nice fat B-tree index dutifully covering every single one of them. The app never queries `completed`. It queries `pending` – maybe a few thousand rows out of several million.

Doesn't matter. Postgres indexes all of it anyway, because nobody told it not to.

This post is about the one-clause feature that fixes it: [partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html). Smaller indexes, faster lookups, less write amplification – and one trick that has nothing to do with performance at all. It's part of the [PostgreSQL Performance Playbook](/postgresql-performance-playbook/); if you want the full series in reading order, start there.

---

## An Index Isn't a Shortcut. It's a Second Table.

Here's the part almost nobody internalizes.

Every `INSERT` writes to every index on the table. Every `UPDATE` that touches an indexed column writes to it too (unless [HOT updates](https://www.postgresql.org/docs/current/storage-hot.html) apply). Every autovacuum has to walk it. You pay rent on an index forever, whether you ever read from it or not.

So when people go hunting for "why is this query slow," they check the query. Almost nobody checks whether the index backing it is 10x bigger than the working set it should represent – or whether the index is a bad deal the planner already refuses to use. I wrote about that second failure mode in [The Index Lie: Why "Just Add an Index" Can Make Your Query Slower](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/). This post is about the first one.

The PostgreSQL documentation says it plainly: a query searching for a common value – one that accounts for more than a few percent of the table – [won't use the index anyway](https://www.postgresql.org/docs/current/indexes-partial.html), so there is no point keeping those rows in the index at all. Removing them shrinks the index *and* speeds up writes, because the index no longer needs updating on every change to rows it doesn't cover.

---

## The Fix Is One WHERE Clause

A [partial index](https://www.postgresql.org/docs/current/indexes-partial.html) is an index built over a subset of a table, defined by a conditional expression the docs call the *predicate*. The index contains entries only for rows that satisfy it.

```sql
CREATE INDEX idx_orders_pending
ON orders (created_at)
WHERE status = 'pending';
```

One clause. `WHERE`. That's the whole trick.

Instead of a B-tree covering every order since your company existed, you get an index sized for the working set: the few thousand rows the application actually queries. Postgres scans something sized for reality, not for your entire order history since 2019.

I've watched this play out in production. In the [250ms → 20ms case study](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/), the query that was draining our RDS credits filtered on a status column – forty relevant rows hiding in half a million historical ones. The full `created_at` index was about 40 MB. The partial index that replaced it in the query plan: **40 kilobytes**. A 1000x size reduction, lookups dropping from double-digit milliseconds to sub-millisecond, and every `INSERT` into that table got cheaper at the same time.

Teams that make this switch on skewed status columns routinely report index sizes dropping by 20–30x. Not because of exotic tuning – because the index finally stopped carrying rows nobody reads.

**For CTOs and founders:** this is one of the highest-leverage, lowest-risk changes in the PostgreSQL toolbox. No query rewrites, no application deploys, no schema migration risk. One DDL statement, built [concurrently](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY), and both your p99 latency and your write throughput improve.

---

## The Sharper Use: Business Rules the Application Can't Enforce

There's a second use for partial indexes, and it has nothing to do with speed.

"A user can only have one draft" is a rule most teams enforce with a `SELECT`, an `if exists?`, and an `INSERT` – and a race condition quietly waiting for Black Friday traffic. Two requests hit the check at the same time, both see no draft, both insert. Your Rails validation ran twice and passed twice.

The database can enforce this rule in a way that cannot be raced:

```sql
CREATE UNIQUE INDEX idx_one_draft_per_user
ON documents (user_id)
WHERE status = 'draft';
```

No app code. No advisory lock. No `SELECT FOR UPDATE`. The database just refuses to let the second draft exist – while allowing any number of `published` or `archived` documents per user, because rows outside the predicate aren't constrained at all.

This is [Example 11.3 in the official documentation](https://www.postgresql.org/docs/current/indexes-partial.html): a partial [unique index](https://www.postgresql.org/docs/current/indexes-unique.html) enforces uniqueness among the rows that satisfy the predicate, without constraining those that don't. The docs frame it as a feature; I'd frame it as a design principle. You're moving a business rule out of your Rails app and into a place where it can't be raced, forgotten, or quietly bypassed by a background job someone wrote two years ago.

It's the same principle I used for payment deduplication in [Billing Idempotency: Webhooks, Unique Indexes, and the Line Between](/posts/billing-idempotency-webhooks-unique-indexes/) – when correctness matters, the unique index is the only layer in the stack that actually wins the race. Every layer above it is best-effort.

---

## The Honest Caveat

Partial indexes aren't automatically faster, and every contrarian take needs its fine print.

The planner uses a partial index only when it can prove your query's `WHERE` clause *implies* the index's predicate. The documentation is [refreshingly blunt](https://www.postgresql.org/docs/current/indexes-partial.html) about how far that proof goes: PostgreSQL "does not have a sophisticated theorem prover." It recognizes simple implications like `x < 1` implies `x < 2`; beyond that, the predicate must exactly match part of the query's condition.

Three consequences worth knowing before you ship one:

1. **Parameterized queries can't match a range predicate.** Matching happens at planning time, so a prepared query with `WHERE created_at > $1` will never match an index predicate like `WHERE created_at > '2026-01-01'` – the planner can't know what `$1` will be. Equality predicates on a constant (`status = 'pending'`) are the safe, boring, correct choice.
2. **The skew has to stay skewed.** If `pending` grows from 5% of the table to 60%, Postgres will shrug and sequential scan anyway – correctly, as the [planner statistics](https://www.postgresql.org/docs/current/planner-stats.html) will tell it the index no longer pays. This is a tool for skewed data, not a universal upgrade you bolt on and forget.
3. **Don't use partial indexes as a substitute for partitioning.** The docs call out [creating a set of non-overlapping partial indexes per category](https://www.postgresql.org/docs/current/indexes-partial.html) as an anti-pattern – the planner has to laboriously test each one. If your data is big enough that one index per category sounds tempting, you want [partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).

---

## Finding Candidates in Ten Minutes

Two queries surface most partial-index opportunities in an existing schema.

First, find your biggest indexes and how often they're actually read, via [`pg_stat_user_indexes`](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW):

```sql
SELECT
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

Then, for every large index on a status-like column, check the value distribution:

```sql
SELECT status, count(*) AS rows
FROM orders
GROUP BY status
ORDER BY rows DESC;
```

When one value owns 90%+ of the table and your queries only ever ask about the others – that's a partial index candidate. Soft-delete columns (`deleted_at IS NULL`), processing queues (`status = 'pending'`), and unbilled-orders patterns (the [documentation's own example](https://www.postgresql.org/docs/current/indexes-partial.html)) are the usual suspects.

Build the replacement without blocking writes, then drop the old one once you've confirmed the plan switched:

```sql
CREATE INDEX CONCURRENTLY idx_orders_pending
ON orders (created_at)
WHERE status = 'pending';
```

[`CREATE INDEX CONCURRENTLY`](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY) takes longer and needs a bit of care (it can leave an invalid index behind on failure – check and retry), but it doesn't lock writes on a production table. Verify the planner picked it up with [`EXPLAIN (ANALYZE, BUFFERS)`](https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-ANALYZE) – and if you want the full method for reading what comes back, that's [Stop Reading EXPLAIN ANALYZE. Start Cross-Examining It.](/posts/stop-reading-explain-analyze-start-cross-examining-it/)

---

## PostgreSQL documentation referenced in this post

| What | Official docs |
|------|---------------|
| Partial indexes (concept, examples, caveats) | [Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html) |
| Partial unique index for business rules | [Partial Indexes – Example 11.3](https://www.postgresql.org/docs/current/indexes-partial.html) |
| Unique indexes | [Unique Indexes](https://www.postgresql.org/docs/current/indexes-unique.html) |
| Index creation and `WHERE` predicate syntax | [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) |
| Online index builds | [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY) |
| Why the planner skips indexes on common values | [Planner Statistics](https://www.postgresql.org/docs/current/planner-stats.html) |
| Index usage counters and sizes | [pg_stat_user_indexes](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-INDEXES-VIEW) |
| Heap-only tuple updates (when writes skip indexes) | [HOT updates](https://www.postgresql.org/docs/current/storage-hot.html) |
| When to partition instead | [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) |

---

## The Question Nobody Asks

Most engineers spend their time optimizing queries. Almost nobody spends five minutes asking why they're indexing rows they will never read.

That question has saved more infra budget in my experience than most query-tuning sessions combined. Sometimes the fastest query isn't the one you optimized – it's the one that stopped dragging around ten million useless index entries.

So, confession time: what's the most ridiculous index you've ever found during a schema review? Bonus points if it was sitting on a soft-delete column.

If you're a founder or CTO whose write latency keeps creeping up while the "database optimization" tickets keep closing, [that's the kind of audit I do as a fractional CTO](/posts/looking-for-my-next-role/). The first thirty minutes are usually `pg_stat_user_indexes` and an uncomfortable list of indexes nobody has read from since 2019.

---

*More in this series: [PostgreSQL Performance Playbook](/postgresql-performance-playbook/) · [The Index Lie](/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/) · [250ms → 20ms](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) · [Cross-Examining EXPLAIN](/posts/stop-reading-explain-analyze-start-cross-examining-it/)*
