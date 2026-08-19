---
layout: post
title: "Billing Reconciliation in Rails: How to Find Money That Doesn't Match"
date: 2026-08-19 13:42:00 +0400
last_modified_at: 2026-08-19
description: "Billing reconciliation in Rails: prove Stripe, ledger, and wallet balances agree. Detect drift, classify PENDING vs MISMATCHED, and correct with journal entries."
tags: [ruby, rails, postgresql, billing, fintech, reconciliation, stripe, ledger, double-entry accounting, wallet, backend engineering, fractional cto, solid queue]
author: eugene
categories: [Billing & Fintech]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/balanced_no_eq_completed.png
    alt: "Billing reconciliation: Stripe, internal ledger, and customer wallets compared — $40 drift between ledger and wallets"
---

*Stripe says $127,430. Your ledger says $127,430. Customer wallets say $127,390. Every ledger invariant passes. Forty dollars is missing – and nothing in your write path will tell you.*

---

Part of [Billing Systems for Rails Engineers](/billing-systems-for-rails-engineers/). [Your Billing System Probably Isn't an Accounting System](/posts/your-billing-system-probably-isnt-an-accounting-system/) named the mutable-balance problem. [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/) stopped money from moving twice. [Double-Entry Ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/) gave you an append-only source of truth. [Exactly-Once Is an Illusion](/posts/exactly-once-is-an-illusion-rails-payments/) composed those layers into a payment path.

This post is the question that comes after all of that:

> **Can you independently prove the numbers are correct?**

A billing system is not trustworthy because its transactions balance. It is trustworthy when you can independently prove that its balances match the external systems that actually moved the money.

---

## Reconciliation ≠ balance calculation

These are different jobs. Most teams collapse them into one nightly `SUM`.

**Balance calculation** answers: *What does our database say the customer is owed?*

**Reconciliation** answers: *Does our database agree with an independent source of truth?*

```text
Balance calculation
    ↓
"What does our database say?"

Reconciliation
    ↓
"Does our database agree with an independent source?"
```

`account.computed_balance` is balance calculation. Comparing that sum to Stripe's balance transactions for the same window is reconciliation. If you only ever compare two columns that your own write path produced, you are checking that your bug is consistent – not that your money is correct.

---

## Three numbers that should agree

In a healthy system, three representations converge:

```text
Stripe
   ↓
$127,430.00

Internal Ledger
   ↓
$127,430.00

Customer Balances
   ↓
$127,430.00
```

Then production happens:

```text
Stripe        $127,430
Ledger        $127,430
Wallets       $127,390

               ↓

              $40 drift
```

Ledger matches provider. Projection does not. Every journal entry is still balanced. The reconstruction test from the [ledger post](/posts/double-entry-ledger-in-rails-minimal-production-model/) – empty database, replay postings, land on ledger totals – still passes. What failed is the hop from ledger to wallet cache. Or the reverse: wallet was credited from a webhook that never produced a posting. You cannot tell which from a single number. You need a comparison across representations.

That is where production engineering starts.

---

## A balanced ledger can still be wrong

This is the failure mode that fools the best schemas.

```text
Stripe:
payment = $100

Internal payments:
payment = $100

Ledger:
+ $100   (balanced journal entry)
```

Everything looks fine. Then:

```text
Stripe:
refund = $30

Internal refunds:
refund = $30

Ledger:
missing
```

`Σ debits == Σ credits` is still true for every journal entry you *did* write. `JournalEntry` validation still passes. The reconstruction test still lands on the (wrong) customer balance your UI shows. The books are balanced. The books are incomplete.

> **A balanced ledger can still be wrong.**

Balance is an internal invariant. Completeness is an external claim. Idempotency and unique indexes stop *duplicate* money movement ([Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/)). They do not detect *missing* money movement. Only reconciliation against the provider catches the gap.

---

## What exactly are we reconciling?

"Reconciliation" is not one job. It is a taxonomy of comparisons. Name the level or you will page on noise.

| Level | Compare |
| --- | --- |
| Ledger | postings ↔ computed account balance |
| Wallet | ledger ↔ materialized `account_balances` / wallet cache |
| Payments | provider events ↔ internal payment rows |
| Cash | provider balance / payouts ↔ internal clearing account |
| Revenue | ledger revenue postings ↔ billing / invoice records |
| Refunds | provider refunds / disputes ↔ internal refund journal entries |

Ship the first three before you build a finance dashboard. Ledger-vs-materialized catches bugs in `refresh_balance!`. Payments-vs-provider catches lost webhooks. Cash-vs-clearing catches fee and settlement drift. Refunds are where [mutable wallets break](/posts/your-billing-system-probably-isnt-an-accounting-system/) and where "balanced but incomplete" shows up first.

---

## The independence rule

This is not reconciliation:

```ruby
ledger.balance == wallet.balance
```

If both values were written by the same buggy service, they will agree and both be wrong. Reconciliation must cross *independent representations of reality*:

```text
Stripe (provider)
   │
   │  compare
   ▼
Internal Ledger (append-only postings)
   │
   │  compare
   ▼
Customer balances / projections
```

Provider truth is not your database. Your ledger is not your wallet cache. Your wallet cache is not the Stripe Dashboard. Cross two of them and you get a signal. Cross all three and you get a diagnosis.

The [exactly-once post](/posts/exactly-once-is-an-illusion-rails-payments/) put reconciliation at the end of the payment path for this reason: it does not *create* correctness. It detects when the composition failed.

---

## The naive Rails job (and why it is wrong)

Most teams ship something like this first:

```ruby
class ReconcileStripePayments
  def call(date:)
    stripe_total = stripe_payments(date)
    ledger_total = ledger_payments(date)

    return if stripe_total == ledger_total

    ReconciliationMismatch.create!(
      source: "stripe",
      date: date,
      expected: stripe_total,
      actual: ledger_total
    )
  end
end
```

It is useful as a canary. It is not a reconciliation system. It collapses:

* event ordering and delayed webhooks into a single daily total;
* refunds, partial refunds, and chargebacks into the same bucket as charges;
* fees and net settlement into gross payment amounts;
* timezone and "created vs available" into one `date:`;
* pending provider rows into immediate mismatches.

A `$40` gap on a daily sum does not tell you *which* of those went wrong. Production reconciliation stores *items*, not just totals – and gives each item a lifecycle.

---

## Schema: runs and items

Two tables. A run is a scoped comparison. An item is one external fact matched (or not) to one internal fact.

```ruby
# db/migrate/xxx_create_reconciliation.rb
class CreateReconciliation < ActiveRecord::Migration[8.0]
  def change
    create_table :reconciliation_runs do |t|
      t.string :source, null: false          # "stripe_balance_transactions"
      t.string :scope, null: false           # "payments" | "refunds" | "cash"
      t.datetime :interval_start, null: false
      t.datetime :interval_end, null: false
      t.string :status, null: false, default: "running"
      t.jsonb :summary, null: false, default: {}
      t.timestamps
    end

    add_index :reconciliation_runs, [:source, :scope, :interval_start, :interval_end],
      unique: true, name: "index_reconciliation_runs_on_window"

    create_table :reconciliation_items do |t|
      t.belongs_to :reconciliation_run, null: false, foreign_key: true
      t.string :source, null: false
      t.string :external_id, null: false     # e.g. txn_... or re_...
      t.string :internal_id                  # journal_entry / payment id
      t.bigint :expected_cents
      t.bigint :actual_cents
      t.string :currency, null: false, default: "usd"
      t.string :state, null: false, default: "pending"
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :reconciliation_items, [:reconciliation_run_id, :source, :external_id],
      unique: true, name: "index_reconciliation_items_on_external"

    add_check_constraint :reconciliation_items,
      "state IN ('matched', 'mismatched', 'pending', 'unresolved')",
      name: "reconciliation_items_state_check"
  end
end
```

Mismatches are rows with a state machine – not log lines that scroll off. Support and finance need a URL, not a Slack screenshot.

---

## Fetching the independent source (stripe-ruby)

Use the current stripe-ruby client surface (`Stripe::StripeClient`), not the legacy static helpers, and page with `auto_paging_each`:

```ruby
class StripeBalanceTransactionFetcher
  def initialize(api_key: ENV.fetch("STRIPE_SECRET_KEY"))
    @client = Stripe::StripeClient.new(api_key)
  end

  def each_in_window(from:, to:)
    list = @client.v1.balance_transactions.list(
      {
        created: { gte: from.to_i, lt: to.to_i },
        limit: 100
      }
    )

    list.auto_paging_each do |txn|
      yield txn
    end
  end
end
```

Balance Transactions are the right API object for cash-level reconciliation: each row has `amount`, `fee`, `net`, `type`, `created`, and `available_on`. Do not reconcile from Charge objects alone – fees and payouts live on the balance transaction side.

For settlement-date truth (finance's question, not engineering's "what happened today"), use the Reporting API:

```ruby
class StripeBalanceReport
  def initialize(api_key: ENV.fetch("STRIPE_SECRET_KEY"))
    @client = Stripe::StripeClient.new(api_key)
  end

  def start!(from:, to:)
    @client.v1.reporting.report_runs.create(
      {
        report_type: "balance_change_from_activity.itemized.6",
        parameters: {
          interval_start: from.to_i,
          interval_end: to.to_i
        }
      }
    )
  end
end
```

Report type choice constrains the question you can ask:

| Report type | Required params | What it answers |
| --- | --- | --- |
| `balance_change_from_activity.itemized.6` | `interval_start`, `interval_end` | Full activity history for the window |
| `payout_reconciliation.itemized.7` | `interval_start`, `interval_end` (+ optional `timezone`) | What settled into payouts |
| `ending_balance_reconciliation.itemized.4` | `interval_end` only | Ending balance as of a point in time |

Pick one question per run. Mixing "created today" with "available today" in the same total is how you invent `$40` of phantom drift.

---

## Matching with states, not booleans

```ruby
class ReconcileStripeBalanceTransactions
  PENDING_GRACE = 5.minutes

  def call(from:, to:)
    run = ReconciliationRun.create!(
      source: "stripe_balance_transactions",
      scope: "cash",
      interval_start: from,
      interval_end: to,
      status: "running"
    )

    StripeBalanceTransactionFetcher.new.each_in_window(from: from, to: to) do |txn|
      reconcile_item!(run, txn)
    end

    run.update!(status: "completed", summary: summarize(run))
    run
  end

  private

  def reconcile_item!(run, txn)
    entry = JournalEntry.find_by(idempotency_key: "stripe:bt:#{txn.id}")
    expected = txn.net # cents; API amounts are in the smallest currency unit
    age = Time.current - Time.at(txn.created)

    state =
      if entry && entry_amount_cents(entry) == expected
        "matched"
      elsif entry.nil? && age < PENDING_GRACE
        "pending"
      elsif entry.nil? || entry_amount_cents(entry) != expected
        age < 24.hours ? "mismatched" : "unresolved"
      end

    ReconciliationItem.create!(
      reconciliation_run: run,
      source: "stripe",
      external_id: txn.id,
      internal_id: entry&.id&.to_s,
      expected_cents: expected,
      actual_cents: entry && entry_amount_cents(entry),
      currency: txn.currency,
      state: state,
      metadata: {
        reporting_hint: txn.type,
        available_on: txn.available_on,
        fee: txn.fee
      }
    )
  end
end
```

States matter:

```text
MATCHED      – external fact and internal fact agree
PENDING      – external exists, internal missing, inside grace window
MISMATCHED   – disagree, or internal still missing after grace
UNRESOLVED   – still open after investigation SLA (human queue)
```

Provider payment exists, internal payment missing, event thirty seconds old → **PENDING**, not **MISMATCHED**. Stripe webhooks are at-least-once and unordered; a reconciliation system that pages on webhook lag gets muted. A muted reconciliation system is worse than none.

---

## Schedule it like inventory reconciliation

Rails 8's default queue adapter is Solid Queue. Recurring tasks live in `config/recurring.yml` – same pattern as the [inventory ledger](/posts/building-an-inventory-ledger-in-rails-8-why-quantity-columns-lie/) hourly drift job:

```yaml
production:
  billing_reconciliation:
    class: BillingReconciliationJob
    schedule: every day at 3am
```

```ruby
class BillingReconciliationJob < ApplicationJob
  queue_as :low

  def perform
    to = Time.current.beginning_of_hour
    from = to - 24.hours
    ReconcileStripeBalanceTransactions.new.call(from: from, to: to)
  end
end
```

Run more often for payments/refunds (hourly) and less often for cash/payout reports (daily). The cadence should match how long you are willing to not know.

---

## What makes reconciliation hard in production

These are not edge cases. They are the job.

**Transaction date vs settlement date.** Stripe reports expose both `created_utc` and `available_on_utc`. Your ledger probably books on webhook time. Finance books on available/payout time. Reconcile like-to-like or invent drift.

**Gross, fee, net.** Balance Transaction API amounts are in the smallest currency unit (cents for USD). Itemized reports often express `gross` / `fee` / `net` in major units. Convert explicitly. Never `==` across unit systems.

**`reporting_category` vs `type`.** Prefer `reporting_category` when reading reports; the older `type` field is coarser and easier to mis-bucket refunds and disputes.

**Partial refunds.** One charge, three refunds. Match each refund's external id to its own journal entry. A daily sum can hide a missing partial.

**Chargebacks and reversals.** A dispute opens, funds leave, then a reversal may return them. Two provider events, two journal entries, one customer-facing story. Idempotency keys must distinguish `dispute:` from `dispute_reversal:`.

**Currency and FX.** Multi-currency wallets need per-currency runs. Converting everything to USD before matching will create permanent noise.

**Unordered, delayed webhooks.** Already covered by `PENDING`. Also covered by [exactly-once architecture](/posts/exactly-once-is-an-illusion-rails-payments/): inbox uniqueness stops duplicates; reconciliation detects absences.

**Timezone.** `payout_reconciliation.itemized.7` accepts a `timezone` parameter; `balance_change_from_activity.itemized.6` does not. Store `interval_start` / `interval_end` in UTC in your runs table and document which clock the report used.

---

## Never "fix" reconciliation by mutating a balance

Bad:

```ruby
wallet.update!(balance: wallet.balance + 40)
```

You erased the evidence. Tomorrow's job still cannot explain *why* the wallet was short, and you have taught the team that the cache is writable by ops.

Good:

```text
Reconciliation detects $40
       ↓
Engineer investigates (which level? which external_id?)
       ↓
Missing financial event identified
       ↓
New journal entry (idempotency_key tied to reconciliation_item)
       ↓
Materialized balance refreshed in the same transaction
       ↓
Audit trail preserved
```

Reconciliation **detects** drift. It does not **author** money. Correction is another balanced journal entry – same discipline as top-ups and refunds in the [double-entry model](/posts/double-entry-ledger-in-rails-minimal-production-model/). Link `metadata: { reconciliation_item_id: ... }` so the fix is itself reconcilable.

Auto-healing a materialized cache from `SUM(postings)` can be acceptable *after* you trust the write path – the inventory post says the same about `stock_balances`. Auto-inserting journal entries from a Stripe CSV without a human or a typed correction policy is how you launder provider errors into your books.

---

## Reconciliation as an operational subsystem

Nightly compare-and-alert is a start. A system looks like this:

```text
                Reconciliation
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
      Payments       Refunds      Balances
          │            │            │
          └────────────┼────────────┘
                       ↓
                  Mismatches
                       ↓
                 Investigation
                       ↓
                   Correction
                       ↓
                     Audit
```

Detection without investigation is a pager nobody owns. Investigation without correction leaves `UNRESOLVED` forever. Correction without audit recreates the mutable-balance culture you left. Treat reconciliation like on-call for money: runbooks, owners, SLAs on `MISMATCHED` → `matched` via a correcting entry.

---

## Same problem as inventory

[Building an Inventory Ledger](/posts/building-an-inventory-ledger-in-rails-8-why-quantity-columns-lie/) uses `SUM(delta)` vs `stock_balances.quantity` and alerts on drift. Billing reconciliation uses provider totals vs ledger vs wallet. The architectural claim is the same:

> **Financial reconciliation and inventory reconciliation are the same problem: independently proving that a derived state matches an append-only source of truth.**

If you already ship inventory drift jobs, you already know the shape. Money adds an external party (the PSP) and stricter correction rules. The independence rule does not change.

---

## Short Answer

Billing reconciliation in Rails is not recalculating `wallet.balance`. It is systematically comparing independent representations – provider (Stripe Balance Transactions / reports), append-only ledger postings, and customer projections – recording each comparison as a run with item-level states (`matched`, `pending`, `mismatched`, `unresolved`), and correcting drift with new journal entries instead of mutating balances. A balanced ledger can still be wrong; only an external check proves completeness.

---

## Final Answer: How to Reconcile Billing in Rails

1. **Name the three numbers.** Provider total, ledger total, projection total. Decide which pairs you compare on which cadence.
2. **Separate calculation from reconciliation.** `SUM(postings)` proves internal consistency. Provider comparison proves external agreement.
3. **Store runs and items.** Unique on `(run, source, external_id)`. States over booleans – especially `pending` for webhook grace.
4. **Fetch Stripe correctly.** `Stripe::StripeClient` + `balance_transactions.list` + `auto_paging_each` for near-real-time; Reporting API (`balance_change_from_activity.itemized.6`, payout / ending-balance report types) for settlement windows.
5. **Match like-to-like.** Same currency, same unit (cents vs major), same clock (`created` vs `available_on`), same scope (charges vs refunds vs fees).
6. **Correct with journal entries.** Never `wallet.update!(balance: ...)`. Tie the correcting entry's `idempotency_key` to the reconciliation item.
7. **Operate it.** Solid Queue recurring job, investigation queue, SLA on unresolved items – same seriousness as payment webhooks.

---

## FAQ: Billing reconciliation in Rails

**What is billing reconciliation?**
The process of proving that your internal money records agree with independent sources – usually the payment provider, your ledger, and customer-facing balances – and of investigating and correcting disagreements without destroying audit history.

**How do I reconcile Stripe with my Rails database?**
Pull Balance Transactions (or a Stripe report) for a UTC window, match each `txn_…` / refund id to a journal entry via a stable `idempotency_key`, record matches and gaps as `reconciliation_items`, and alert on `mismatched` / `unresolved` – not on every few seconds of webhook lag.

**Why does my ledger balance but the numbers are still wrong?**
`Σ debits == Σ credits` only proves each written entry is balanced. It does not prove every provider event was written. Missing refunds and lost webhooks leave a balanced, incomplete ledger.

**Should reconciliation auto-correct balances?**
Do not mutate `wallet.balance`. Optionally refresh a materialized cache from `SUM(postings)` after you trust the write path. Missing financial facts should become new journal entries under a correction policy, not silent column edits.

**What is the difference between PENDING and MISMATCHED?**
`PENDING` means the external fact is newer than your grace window and the internal row may still arrive. `MISMATCHED` means the grace expired or amounts disagree. Page on the second; chart the first.

**Which Stripe report should I use?**
Activity history: `balance_change_from_activity.itemized.6`. Payout settlement: `payout_reconciliation.itemized.7`. Point-in-time ending balance: `ending_balance_reconciliation.itemized.4`. One question per run.

**How is this different from idempotency?**
Idempotency prevents the same event from applying twice. Reconciliation detects when an event never applied, applied as the wrong amount, or applied in one layer but not another.

**Does this replace a double-entry ledger?**
No. Reconciliation assumes you have something worth comparing. Start with [idempotency](/posts/billing-idempotency-webhooks-unique-indexes/) and a [ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/), then add reconciliation as the proof layer – the same sequence as [exactly-once payment architecture](/posts/exactly-once-is-an-illusion-rails-payments/).

---

*More in this series: [Billing Systems for Rails Engineers](/billing-systems-for-rails-engineers/) · [Double-Entry Ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/) · [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/) · [Exactly-Once Is an Illusion](/posts/exactly-once-is-an-illusion-rails-payments/) · [Inventory Ledger](/posts/building-an-inventory-ledger-in-rails-8-why-quantity-columns-lie/)*

*I help teams turn "we have a ledger" into "we can prove the money" – reconciliation runs, mismatch triage, and correction policies that survive audit. If Stripe totals and your database disagree this month, [happy to review the architecture](https://t.me/eugene_the_engineer?direct).*
