# Distribution assets — ready to paste

Copy for manual distribution. SQL whale republish is **already live** on [DEV.to](https://dev.to/madmatvey/optimizing-sql-queries-or-tracking-dangerous-criminals-58k) and [LinkedIn](https://www.linkedin.com/posts/eugeneleontev_postgresql-rubyonrails-backendengineering-share-7476200641829416961-mMqD/).

---

## Hacker News — The Index Lie

**When:** Tuesday–Thursday, 14:00–17:00 UTC (8–10am US Eastern)  
**URL:** `https://eugenetheengineer.com/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/`

**Title (neutral — use as-is):**

```
The Index Lie: Why "Just Add an Index" Can Make Your Query Slower
```

**Notes:**

- Engage in comments for 30+ minutes after submit
- Do not submit billing and Index Lie the same week
- Author replies convert HN traffic

---

## LinkedIn — The Index Lie

**Format:** Native post + link in first comment

**Post body:**

```
Postgres doesn't ignore your index. It runs a cost calculation you didn't run — and sometimes the index loses.

What I cover in this production write-up:
• Why sequential scans beat index scans past a selectivity threshold
• Heap Fetches, correlation, and write-side index cost
• What to do instead of SET enable_seqscan = off

Full write-up (link in comments): The Index Lie

#PostgreSQL #RubyOnRails #BackendEngineering #Database #Performance
```

**First comment:**

```
https://eugenetheengineer.com/posts/the-index-lie-why-just-add-an-index-can-make-your-query-slower/

Part of the PostgreSQL Performance Playbook:
https://eugenetheengineer.com/postgresql-performance-playbook/

Related: 250ms → 20ms case study, Cross-Examining EXPLAIN ANALYZE
```

---

## LinkedIn — Billing vs Accounting

**Format:** Native post + link in first comment

**Post body:**

```
Most Rails billing apps mutate wallet.balance and call it done.

Here's the reconstruction test that exposes the gap — and why refunds break systems that never built a real ledger:

What I cover:
• Wallet column vs double-entry ledger — the reconstruction test
• Why refunds and partial captures expose the gap
• A migration path without a big-bang rewrite

Full write-up (link in comments): Your Billing System Isn't an Accounting System

#RubyOnRails #Billing #Fintech #PostgreSQL #BackendEngineering
```

**First comment:**

```
https://eugenetheengineer.com/posts/your-billing-system-probably-isnt-an-accounting-system/

Billing hub (reading order):
https://eugenetheengineer.com/billing-systems-for-rails-engineers/

Follow-ups: Double-Entry Ledger in Rails, Billing Idempotency (webhooks + unique indexes)
```

---

## DEV.to queue

| Post | Doc | Status |
|------|-----|--------|
| SQL optimization whale | [devto-sql-optimization-republish.md](devto-sql-optimization-republish.md) | **Published** |
| The Index Lie | [devto-index-lie-republish.md](devto-index-lie-republish.md) | Ready |
| Billing vs Accounting | [devto-billing-vs-accounting-republish.md](devto-billing-vs-accounting-republish.md) | Ready |
