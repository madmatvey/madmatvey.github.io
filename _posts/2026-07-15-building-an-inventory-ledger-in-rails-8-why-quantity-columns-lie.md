---
layout: post
title: "Building an Inventory Ledger in Rails 8: Why quantity Columns Lie"
date: 2026-07-15 13:42:00 +0400
last_modified_at: 2026-07-15
description: "Build an append-only inventory ledger in Rails 8 and PostgreSQL: stop racey quantity updates, cache balances safely, and reconcile stock from the ledger."
tags: [ruby, rails, postgresql, inventory, ledger, concurrency, idempotency, solid queue, backend engineering, fractional cto]
author: eugene
categories: [Billing & Fintech]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/building-an-inventory-ledger-in-rails-8-why-quantity-columns-lie.png
    alt: "Quantity columns lie: racey products.quantity vs append-only inventory_ledger_entries with SUM(delta) and stock_balances"
---

*Two checkout workers both see `quantity: 1`. Both sell. Your warehouse ships one unit. Support opens three tickets.*

---

[Your Billing System Probably Isn't an Accounting System](/posts/your-billing-system-probably-isnt-an-accounting-system/) made the case for money: a mutable `wallet.balance` column is a receipt system, not a ledger. [Double-Entry Ledger in Rails](/posts/double-entry-ledger-in-rails-minimal-production-model/) showed the reconstruction test. Stock has the same failure mode – and a simpler fix.

This is not double-entry accounting for inventory. It is an append-only movement log – the inventory cousin of that money ledger. Same reconstruction test, fewer accounts. If you searched for an **inventory ledger Rails example**, this is the full working pattern: schema, service object, concurrency control, reconciliation job, and how to test the race for real.

---

## The failure mode that never reproduces in `rails s`

You ship the obvious model:

```ruby
# The lie that ships in every MVP
product.update!(quantity: product.quantity - line.quantity)
# or worse:
Product.where(id: id).update_all("quantity = quantity - #{line.quantity}")
```

Two customers checkout the last unit at the same millisecond. Both requests read `quantity = 1`. Both write `quantity = 0`. One unit left the warehouse. Two orders were accepted. The bug is invisible in a single-threaded local server and intermittent in staging with one Sidekiq worker.

Locks on `products` fix the race *for that write*. They do not give you history, audit, or a way to prove what stock *should* be. When the 3PL says you shipped 14 of SKU-X last Tuesday and your admin says 11, `products.quantity` has nothing useful to say. You are arguing from a single overwritten integer.

A mutable quantity column is the wrong primitive: no movement history, no reconciliation target, and concurrency requires bolting locks onto a model that already threw away the evidence.

---

## Core pattern: append-only ledger

Think of a warehouse stock book, not a bank chart of accounts. Every change is a row. You never `UPDATE` a movement. You only `INSERT`.

```ruby
# db/migrate/xxx_create_inventory_ledger.rb
class CreateInventoryLedger < ActiveRecord::Migration[8.0]
  def change
    create_table :inventory_ledger_entries do |t|
      t.belongs_to :product_variant, null: false, foreign_key: true
      t.belongs_to :warehouse, null: false, foreign_key: true
      t.integer :delta, null: false
      t.string :movement_type, null: false
      t.belongs_to :reference, polymorphic: true, null: true
      t.string :idempotency_key, null: false
      t.datetime :occurred_at, null: false
      t.jsonb :metadata, null: false, default: {}
      t.datetime :created_at, null: false
      # no updated_at – movements are immutable
    end

    add_index :inventory_ledger_entries, :idempotency_key, unique: true
    add_index :inventory_ledger_entries,
      [:product_variant_id, :warehouse_id, :occurred_at],
      name: "index_inventory_ledger_on_variant_warehouse_occurred"

    add_check_constraint :inventory_ledger_entries,
      "delta <> 0",
      name: "inventory_ledger_entries_delta_nonzero"

    add_check_constraint :inventory_ledger_entries,
      "movement_type IN ('purchase', 'sale', 'adjustment', 'return', 'transfer_in', 'transfer_out')",
      name: "inventory_ledger_entries_movement_type_check"

    create_table :stock_balances do |t|
      t.belongs_to :product_variant, null: false, foreign_key: true
      t.belongs_to :warehouse, null: false, foreign_key: true
      t.integer :quantity, null: false, default: 0
      t.datetime :computed_at
      t.timestamps
    end

    add_index :stock_balances,
      [:product_variant_id, :warehouse_id],
      unique: true,
      name: "index_stock_balances_on_variant_and_warehouse"
  end
end
```

`idempotency_key` is the same discipline as [billing idempotency](/posts/billing-idempotency-webhooks-unique-indexes/): warehouse webhooks, WMS callbacks, and job retries must not double-apply a movement. The unique index is the layer that survives process crashes – not an `exists?` check in Ruby.

`CHECK (delta <> 0)` keeps noise out of the book. Zero-delta "movements" are almost always a bug upstream.

---

## Where current stock lives: three options

**A – `SUM(delta)` on the fly.** Correct and simple at low volume. Breaks when a SKU has thousands of movements and every checkout scans history – same pressure as ledger balance queries in the [250ms → 20ms](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) case study.

**B – `stock_balances` updated in the same transaction as the insert.** Fast enough for real-time checkout. Breaks when someone updates the cache without writing the ledger.

**C – materialized view, refresh on a schedule.** Fine for reporting dashboards. Breaks the moment you use it to reserve stock at checkout – `REFRESH MATERIALIZED VIEW` (even `CONCURRENTLY`) is not a checkout primitive.

**Recommendation: B + a background reconciliation job.** Cached `stock_balances.quantity` is an optimization for fast reads. The ledger is the source of truth. If those two disagree, the cache is wrong – not the other way around. That sentence is the whole point of the pattern.

---

## Concurrency: the race, then the lock

Without a lock, two workers both read balance `5`, both insert `delta: -1`, both write balance `4`. Final ledger sum is `3`. Cache says `4`. You just invented a support ticket.

Default approach in Rails 8: lock the balance row, then insert + update in one transaction. [`with_lock`](https://guides.rubyonrails.org/v8.0/active_record_querying.html#pessimistic-locking) wraps `SELECT … FOR UPDATE` – PostgreSQL's standard way to protect a row against concurrent writers ([app-level consistency](https://www.postgresql.org/docs/current/applevel-consistency.html)).

```ruby
balance.with_lock do
  raise InsufficientStock if balance.quantity + delta < 0 && !variant.allow_negative_stock?
  InventoryLedgerEntry.create!(...)
  balance.update!(quantity: balance.quantity + delta, computed_at: Time.current)
end
```

Alternative: `ApplicationRecord.transaction(isolation: :serializable)` and retry on `ActiveRecord::SerializationFailure`. PostgreSQL raises SQLSTATE `40001` when concurrent serializable transactions would produce an anomaly – the app **must** retry ([serialization failure handling](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html)).

Trade-off:

- **Row lock** – predictable. Hot SKUs queue. Latency spikes on that one balance row (the hot-row problem covered in [7 PostgreSQL Performance Mistakes](/posts/seven-postgresql-performance-mistakes-i-keep-seeing/)).
- **Serializable** – no explicit lock in your code, but retry storms under contention on the same SKU.

For checkout paths I default to `with_lock` on `stock_balances`. It is boring and measurable.

---

## Negative stock is a business decision

A `CHECK (quantity >= 0)` on `stock_balances` is one line and will save you from overselling – until product asks for backorders or preorders. Then the constraint becomes an incident.

Better: a flag on the variant (`allow_negative_stock`) checked **inside** the locked transaction, before the insert. Blocking a sale and selling into the red are both valid policies. The tech lead's job is to pick one explicitly and encode it once – not discover the policy from a CHECK constraint violation at Black Friday.

---

## Rails 8 implementation

### Models

```ruby
class InventoryLedgerEntry < ApplicationRecord
  belongs_to :product_variant
  belongs_to :warehouse
  belongs_to :reference, polymorphic: true, optional: true

  MOVEMENT_TYPES = %w[
    purchase sale adjustment return transfer_in transfer_out
  ].freeze

  validates :delta, numericality: { other_than: 0 }
  validates :movement_type, inclusion: { in: MOVEMENT_TYPES }
  validates :idempotency_key, presence: true, uniqueness: true

  def readonly?
    persisted?
  end
end

class StockBalance < ApplicationRecord
  belongs_to :product_variant
  belongs_to :warehouse
end
```

`readonly?` after persist is belt-and-suspenders with the missing `updated_at`. Corrections are new rows (`adjustment`), never edits.

### Service object – one place for the transaction

Keep the transactional logic out of callbacks and out of controllers. One object owns insert + cache update:

```ruby
class StockMovement
  class InsufficientStock < StandardError; end

  def self.record!(variant:, warehouse:, delta:, type:, reference:,
                   idempotency_key:, occurred_at: Time.current, metadata: {})
    ApplicationRecord.transaction do
      balance = StockBalance.find_or_create_by!(
        product_variant: variant,
        warehouse: warehouse
      )

      balance.with_lock do
        next_qty = balance.quantity + delta
        if next_qty.negative? && !variant.allow_negative_stock?
          raise InsufficientStock, "variant=#{variant.id} warehouse=#{warehouse.id}"
        end

        InventoryLedgerEntry.create!(
          product_variant: variant,
          warehouse: warehouse,
          delta: delta,
          movement_type: type,
          reference: reference,
          idempotency_key: idempotency_key,
          occurred_at: occurred_at,
          metadata: metadata,
          created_at: Time.current
        )

        balance.update!(quantity: next_qty, computed_at: Time.current)
      end
    end
  rescue ActiveRecord::RecordNotUnique
    InventoryLedgerEntry.find_by!(idempotency_key: idempotency_key)
  end
end
```

Checkout calls `StockMovement.record!(..., delta: -line.quantity, type: "sale", idempotency_key: "order:#{order.id}:line:#{line.id}")`. Receiving stock uses positive `delta` and `type: "purchase"`. Same API for adjustments and transfers.

Do not put inventory mutations in Redis counters either – [Redis is single-threaded](/posts/redis-is-single-threaded/), and stock that must reconcile belongs in PostgreSQL with the rest of the ledger.

### Reconciliation with Solid Queue

Rails 8's default queue adapter is Solid Queue. Recurring tasks live in `config/recurring.yml` ([Active Job basics](https://guides.rubyonrails.org/v8.0/active_job_basics.html)):

```yaml
production:
  inventory_reconciliation:
    class: InventoryReconciliationJob
    schedule: every hour
```

```ruby
class InventoryReconciliationJob < ApplicationJob
  queue_as :low

  def perform
    drifts = []

    StockBalance.find_each do |balance|
      ledger_qty = InventoryLedgerEntry
        .where(
          product_variant_id: balance.product_variant_id,
          warehouse_id: balance.warehouse_id
        )
        .sum(:delta)

      next if ledger_qty == balance.quantity

      drifts << {
        product_variant_id: balance.product_variant_id,
        warehouse_id: balance.warehouse_id,
        cached: balance.quantity,
        ledger: ledger_qty
      }
    end

    return if drifts.empty?

    Rails.error.report(
      StandardError.new("inventory balance drift"),
      context: { drifts: drifts.first(50), count: drifts.size }
    )
    # Optionally auto-correct: balance.update!(quantity: ledger_qty)
    # Prefer alert-first until you trust the job.
  end
end
```

When this job fires, you have a production bug in the write path – not a "Postgres is weird" mystery. Fix `StockMovement`, then decide whether the job should auto-heal the cache.

---

## Historical queries: why not just lock `quantity`

With a ledger you get, for free:

```sql
-- Stock as of end of day (warehouse dispute / audit)
SELECT COALESCE(SUM(delta), 0)
FROM inventory_ledger_entries
WHERE product_variant_id = $1
  AND warehouse_id = $2
  AND occurred_at <= $3;

-- Full movement history for one SKU
SELECT occurred_at, movement_type, delta, reference_type, reference_id, metadata
FROM inventory_ledger_entries
WHERE product_variant_id = $1 AND warehouse_id = $2
ORDER BY occurred_at, id;
```

Reconstruction test for inventory: empty database, replay every ledger row in order, arrive at the same `stock_balances.quantity` the app shows. If you cannot pass that test, your cache is the source of truth – and you will lose the next warehouse dispute.

Row-locking a `quantity` column can make concurrent decrements correct. It cannot answer "what was on hand last Tuesday?" That is why the ledger wins even after you already know how to use `FOR UPDATE`.

---

## Scaling

Index first. Without `(product_variant_id, warehouse_id, occurred_at)`, point-in-time `SUM` and history pages degrade into sequential scans. Partial indexes help when you filter a subset of movement types – same idea as [PostgreSQL Partial Indexes](/posts/postgresql-partial-indexes-index-less-query-faster/).

When the table hits tens of millions of rows and archival matters, Postgres [declarative partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) by `RANGE (occurred_at)` is the usual next step:

```sql
CREATE TABLE inventory_ledger_entries (
  -- columns as above; id strategy must work with partitions
  occurred_at timestamptz NOT NULL,
  ...
) PARTITION BY RANGE (occurred_at);
```

That is an ops decision, not a day-one requirement. Ship the append-only model and the composite index first; partition when retention and vacuum cost force the conversation.

---

## Testing the race for real

Mocks will not catch this. You need two Ruby threads (or processes) hitting a real Postgres with two connections.

```ruby
# spec/concurrency/stock_movement_race_spec.rb
RSpec.describe "StockMovement race" do
  it "does not oversell the last unit" do
    variant = create(:product_variant, allow_negative_stock: false)
    warehouse = create(:warehouse)
    StockBalance.create!(product_variant: variant, warehouse: warehouse, quantity: 1)

    errors = Queue.new
    threads = 2.times.map do |i|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          StockMovement.record!(
            variant: variant,
            warehouse: warehouse,
            delta: -1,
            type: "sale",
            reference: create(:order),
            idempotency_key: "race-test-#{i}"
          )
        end
      rescue StockMovement::InsufficientStock => e
        errors << e
      end
    end
    threads.each(&:join)

    balance = StockBalance.find_by!(product_variant: variant, warehouse: warehouse)
    expect(balance.quantity).to eq(0)
    expect(InventoryLedgerEntry.where(product_variant: variant).sum(:delta)).to eq(-1)
    expect(errors.size).to eq(1)
  end
end
```

One sale commits. One raises `InsufficientStock`. Cache and ledger agree. If this test is flaky, your lock scope is wrong – usually because something read the balance outside `with_lock`.

---

## When you do not need this

One warehouse, one writer process, no audit requirement, low concurrency: `product.with_lock { product.update!(quantity: product.quantity - n) }` is enough. An inventory ledger is overengineering until the second warehouse, the first 3PL chargeback, or the first ticket that says "stock doesn't match reality."

The pattern pays for itself when you need history and when concurrent writers share a SKU. Until then, ship the lock and keep the door open to migrate – shadow-write ledger rows beside `quantity` the same way the [double-entry migration path](/posts/double-entry-ledger-in-rails-minimal-production-model/) shadows `wallet.balance`.

---

## Short Answer

An inventory ledger in Rails is an append-only `inventory_ledger_entries` table of signed `delta` movements, not a mutable `products.quantity` column. Current stock is either `SUM(delta)` or a `stock_balances` cache updated in the same transaction under `with_lock`. Idempotency keys and a unique index stop duplicate warehouse events. A Solid Queue reconciliation job compares cache to ledger and alerts on drift. The ledger is the source of truth; the balance table is an optimization.

---

## Final Answer: How to Build an Inventory Ledger in Rails

1. **Schema:** Create `inventory_ledger_entries` (variant, warehouse, delta, movement_type, polymorphic reference, idempotency_key, occurred_at, metadata) and `stock_balances` (unique per variant+warehouse).
2. **Constraints:** `CHECK (delta <> 0)`, unique index on `idempotency_key`, composite index on `(product_variant_id, warehouse_id, occurred_at)`. No `updated_at` on movements.
3. **Service:** One `StockMovement.record!` that locks the balance row, optionally rejects negative stock, inserts the ledger row, and updates the cache atomically.
4. **Idempotency:** Derive keys from order line IDs / webhook event IDs; rescue `RecordNotUnique` and return the existing entry.
5. **Reconciliation:** Hourly Solid Queue job that `SUM`s the ledger per SKU/warehouse and alerts when it disagrees with `stock_balances`.
6. **Prove it:** Parallel-thread integration test against real Postgres for the last-unit race.

Pass the reconstruction test: replay every movement from an empty database and land on the same quantity the app shows.

---

## FAQ: Inventory ledger in Rails

**What is an inventory ledger in Rails?**
An append-only table of stock movements (`delta` rows) from which on-hand quantity is derived. It is the inventory analogue of a financial ledger – usually single-sided deltas, not full double-entry.

**Why is a `quantity` column a bad idea?**
It overwrites history, cannot explain disputes, and race conditions on decrement are intermittent and hard to reproduce. Locks fix concurrency but not auditability.

**What does an inventory ledger Rails example schema look like?**
`inventory_ledger_entries` with variant, warehouse, signed delta, movement type, polymorphic reference, unique `idempotency_key`, and `occurred_at`; plus optional `stock_balances` for cached quantity.

**How do you prevent race conditions when decrementing stock?**
Lock the `stock_balances` row with `with_lock` (`SELECT … FOR UPDATE`), then insert the ledger entry and update the cache in the same transaction. Alternatively use `serializable` isolation and retry on serialization failures.

**Where should current stock balance live?**
Source of truth: `SUM(delta)` over the ledger. Fast path: `stock_balances.quantity` maintained in the same transaction. Materialized views are for reporting, not checkout.

**How do you prevent negative inventory?**
Either a DB `CHECK (quantity >= 0)` or an app-level `allow_negative_stock` flag checked inside the locked transaction. Pick the policy deliberately – backorders change the answer.

**How do you reconcile cached balances with the ledger?**
A recurring Solid Queue job recomputes `SUM(delta)` per variant/warehouse, compares to `stock_balances`, and alerts (or auto-corrects) on drift.

**When is an inventory ledger overkill?**
Single writer, low concurrency, no audit or multi-warehouse needs. A locked `quantity` column is enough until the first reconciliation failure forces the issue.

---

*More in this series: [Billing Systems for Rails Engineers](/billing-systems-for-rails-engineers/) · [Double-Entry Ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/) · [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/)*
