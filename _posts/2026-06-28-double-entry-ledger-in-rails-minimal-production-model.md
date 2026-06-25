---
layout: post
title: "Double-Entry Ledger in Rails: A Minimal Production Model"
date: 2026-06-28 13:42:00 +0400
last_modified_at: 2026-06-28
description: "A minimal double-entry ledger in Rails and PostgreSQL: accounts, postings, balance-as-query, and the migration path from wallet.balance without a big-bang rewrite."
tags: [ruby, rails, postgresql, billing, fintech, double-entry accounting, ledger, wallet, backend engineering, fractional cto, journal entry, financial systems]
author: eugene
categories: [Billing & Fintech]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/wallets-vs-ledgers.png
    alt: "Double-entry ledger schema in Rails with accounts and postings"
---

*You don't need a finance team to justify a ledger. You need one reconciliation ticket where `wallet.balance` and `wallet_transactions` disagree – and no way to prove which one is right.*

---

[Your Billing System Probably Isn't an Accounting System](/posts/your-billing-system-probably-isnt-an-accounting-system/) made the case: mutable `wallet.balance` is a receipt system, not a ledger. [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/) covered how duplicate events break wallets silently.

This post is the minimal schema and service layer I've used to introduce double-entry without stopping the world – small enough to ship in a sprint, strict enough to pass the reconstruction test.

**Double-entry bookkeeping** means every financial event is recorded as a journal entry where total debits equal total credits. Customer balance is derived from postings – not a mutable column.

---

## The reconstruction test

Before any schema:

> Can you take an empty database, replay every financial event in order, and arrive at the exact balance the customer sees?

If balance is `wallet.balance` mutated in place, the answer is *"only if nothing ever went wrong."* If balance is derived from postings, the answer is *"yes, by construction."*

---

## Minimal schema

Four tables. No gem required on day one (though [money-rails](https://github.com/RubyMoney/money-rails) helps with currency).

```ruby
# db/migrate/xxx_create_ledger.rb
class CreateLedger < ActiveRecord::Migration[8.0]
  def change
    create_table :accounts do |t|
      t.belongs_to :owner, polymorphic: true, index: true  # nil for system accounts
      t.string :code, null: false          # e.g. "wallet", "stripe_clearing", "platform_revenue"
      t.string :account_type, null: false, default: "liability"  # asset | liability | revenue
      t.string :currency, null: false, default: "USD"
      t.timestamps
    end

    add_index :accounts, [:owner_type, :owner_id, :code], unique: true
    add_index :accounts, :code, unique: true, where: "owner_id IS NULL",
      name: "index_system_accounts_on_code"

    add_check_constraint :accounts,
      "account_type IN ('asset', 'liability', 'revenue')",
      name: "accounts_account_type_check"

    create_table :journal_entries do |t|
      t.string :idempotency_key, null: false
      t.string :reason, null: false
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :journal_entries, :idempotency_key, unique: true

    create_table :postings do |t|
      t.belongs_to :journal_entry, null: false, foreign_key: true
      t.belongs_to :account, null: false, foreign_key: true
      t.string :direction, null: false    # "debit" | "credit"
      t.decimal :amount, precision: 20, scale: 6, null: false
      t.timestamps
    end

    add_check_constraint :postings,
      "direction IN ('debit', 'credit')",
      name: "postings_direction_check"

    create_table :account_balances do |t|
      t.belongs_to :account, null: false, foreign_key: true, index: { unique: true }
      t.decimal :balance, precision: 20, scale: 6, null: false, default: 0
      t.datetime :computed_at
      t.timestamps
    end
  end
end
```

System accounts (`stripe_clearing`, `platform_revenue`) have `owner: nil`. Customer wallet accounts belong to the customer and use `account_type: "liability"` – you owe them the balance.

`account_balances` is optional but practical: balance-as-query (`SUM` over postings) is correct but slow at volume. A materialized balance updated in the same transaction as postings gives you fast reads *and* a reconciliation target.

---

## Models

```ruby
class Account < ApplicationRecord
  belongs_to :owner, polymorphic: true, optional: true
  has_many :postings, dependent: :restrict_with_error
  has_one :account_balance, dependent: :destroy

  scope :system, -> { where(owner_id: nil) }

  enum :account_type, { asset: "asset", liability: "liability", revenue: "revenue" }, validate: true

  def computed_balance
    debits  = postings.debit.sum(:amount)
    credits = postings.credit.sum(:amount)
    asset? ? debits - credits : credits - debits
  end
end

class JournalEntry < ApplicationRecord
  has_many :postings, dependent: :restrict_with_error, inverse_of: :journal_entry

  validates :idempotency_key, uniqueness: true
  validate :balanced_postings, on: :create

  private

  def balanced_postings
    debits  = postings.select(&:debit?).sum(&:amount)
    credits = postings.select(&:credit?).sum(&:amount)
    errors.add(:base, "Unbalanced entry") unless debits == credits
  end
end

class Posting < ApplicationRecord
  belongs_to :journal_entry, inverse_of: :postings
  belongs_to :account

  enum :direction, { debit: "debit", credit: "credit" }, validate: true
end

class AccountBalance < ApplicationRecord
  belongs_to :account
end
```

`computed_balance` depends on `account_type`: assets are debit-normal (`debits - credits`); liabilities and revenue are credit-normal (`credits - debits`). The validation runs in Ruby on create — postings must be built with `entry.postings.build` before `save!`, not created afterward. For stronger guarantees, add a database trigger or defer to a service that raises before commit if `Σ debits ≠ Σ credits`.

---

## Two services: top-up and spend

A customer **top-up** (payment received) moves money from clearing into the wallet liability. **Spending** moves money from wallet into revenue. Revenue does not appear in a top-up – that was the most common mistake I've seen in first ledger implementations.

```ruby
class TopUpCustomerWalletService
  def self.call(customer:, amount:, reason:, idempotency_key:)
    ApplicationRecord.transaction do
      wallet_account    = customer.accounts.find_by!(code: "wallet")
      clearing_account  = Account.system.find_by!(code: "stripe_clearing")

      entry = JournalEntry.new(idempotency_key: idempotency_key, reason: reason)
      entry.postings.build(account: clearing_account, direction: :debit,  amount: amount)
      entry.postings.build(account: wallet_account,   direction: :credit, amount: amount)
      entry.save!

      LedgerBalanceRefresh.refresh_balance!(wallet_account, clearing_account)
      entry
    end
  rescue ActiveRecord::RecordNotUnique
    JournalEntry.find_by!(idempotency_key: idempotency_key)
  end
end

class SpendFromWalletService
  def self.call(customer:, amount:, reason:, idempotency_key:)
    ApplicationRecord.transaction do
      wallet_account  = customer.accounts.find_by!(code: "wallet")
      revenue_account = Account.system.find_by!(code: "platform_revenue")

      entry = JournalEntry.new(idempotency_key: idempotency_key, reason: reason)
      entry.postings.build(account: wallet_account,  direction: :debit,  amount: amount)
      entry.postings.build(account: revenue_account, direction: :credit, amount: amount)
      entry.save!

      LedgerBalanceRefresh.refresh_balance!(wallet_account, revenue_account)
      entry
    end
  rescue ActiveRecord::RecordNotUnique
    JournalEntry.find_by!(idempotency_key: idempotency_key)
  end
end

module LedgerBalanceRefresh
  def self.refresh_balance!(*accounts)
    rows = accounts.map do |account|
      { account_id: account.id, balance: account.computed_balance, computed_at: Time.current }
    end
    AccountBalance.upsert_all(rows, unique_by: :account_id, update_only: %i[balance computed_at])
  end
end
```

Wire `TopUpCustomerWalletService` from your webhook job with `idempotency_key: webhook_event.provider_event_id` – same discipline as [billing idempotency](/posts/billing-idempotency-webhooks-unique-indexes/).

Notice what's absent: `wallet.balance += amount`. The customer's balance is derived from postings on a liability account. Duplicate webhook, duplicate job → `RecordNotUnique` → same journal entry returned.

---

## Wallet vs ledger: comparison

| | Mutable wallet | Double-entry ledger |
|---|----------------|---------------------|
| Source of truth | `wallets.balance` column | Sum of postings |
| Duplicate event risk | Silent drift | `RecordNotUnique`; duplicate entries inflate balances |
| Refund / chargeback | Special-case decrement | Another journal entry |
| Reconciliation | Hope transactions match balance | `computed_balance == account_balances.balance` |
| Ship speed | Fast | Slower |
| Audit / SOC 2 | Painful | Natural |

---

## Migration without big-bang rewrite

You're not rewriting billing in one sprint. The path I've used on live systems:

**Step 1 – Shadow ledger (diagnostic only)**

Keep `wallet.balance` authoritative. On every credit/debit, write equivalent journal entries. Nightly job:

```ruby
Wallet.find_each do |wallet|
  account = wallet.customer.accounts.find_by(code: "wallet")
  next unless account

  drift = wallet.balance - account.computed_balance
  LedgerDriftAlert.create!(wallet: wallet, drift: drift) if drift.nonzero?
end
```

Most teams discover drift within days. That's when the migration gets prioritized.

**Step 2 – Read from ledger in one low-stakes path**

Support-facing "explain my balance" page reads from `account.computed_balance` and lists postings. Customer-facing balance still uses `wallet.balance`.

**Step 3 – Write through ledger for refunds and webhooks first**

That's where [mutable balances break](/posts/your-billing-system-probably-isnt-an-accounting-system/) – retries, chargebacks, partial refunds.

**Step 4 – Retire `wallet.balance`**

Stop writing. Keep column for rollback. Reconciliation job shows zero drift for 30+ days. Drop column in a later migration.

---

## Performance: when SUM gets slow

At thousands of postings per account, `computed_balance` needs help:

- **Partial indexes** on `postings(account_id, direction)` – same pattern as [250ms → 20ms](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) case study
- **Materialized `account_balances`** updated in transaction (shown above)
- **Periodic reconciliation** comparing materialized vs computed – catches bugs in `refresh_balance!`

For heavy reporting, stream postings to a warehouse. The ledger remains source of truth; analytics is derived.

---

## What not to build yet

- Multi-currency FX engine
- Full chart of accounts matching GAAP
- Event sourcing framework

Start with customer wallet (liability) + stripe clearing (asset) + platform revenue (revenue) + idempotent journal entries. Add accounts when finance asks for them – they will, but later.

---

## Short Answer

A minimal double-entry ledger in Rails needs four tables: `accounts`, `journal_entries`, `postings`, and optionally `account_balances` for fast reads. Every financial event becomes a balanced journal entry (equal debits and credits) with an `idempotency_key`. Customer balance is derived from postings on a liability account, not a mutable `wallet.balance` column. Migrate by shadow-writing to the ledger while keeping `wallet.balance` authoritative, then cut over path by path.

---

## Final Answer: How to Build a Double-Entry Accounting System in Rails

1. **Schema:** Create `accounts` (owner + code + account_type), `journal_entries` (idempotency_key, reason), `postings` (account, direction, amount), and `account_balances` (materialized balance).
2. **Rule:** Every journal entry must balance: sum of debits = sum of credits. Store amounts as `decimal(20,6)`.
3. **Account types:** Assets are debit-normal; liabilities and revenue are credit-normal. Balance formula depends on type.
4. **Service layer:** One service per business event (top-up, spend, refund). Build postings before `save!`. Use `idempotency_key` from the webhook event ID.
5. **Migration:** Shadow-write → read from ledger in support UI → write through ledger for webhooks/refunds → retire `wallet.balance` after 30 days zero drift.

Pass the reconstruction test: replay all journal entries from an empty database and arrive at the same customer balance.

---

## FAQ: Double-entry ledger in Rails

**What tables do I need for a double-entry ledger in Rails?**
Four: `accounts`, `journal_entries`, `postings`, and optionally `account_balances` for fast reads. Postings are the atomic debit/credit lines; journal entries group them.

**How is balance calculated from postings?**
Sum debits and credits on the account, then apply the sign for the account type: `debits - credits` for assets, `credits - debits` for liabilities and revenue.

**What's the difference between a wallet and a ledger?**
A wallet stores balance as a mutable column. A ledger derives balance from immutable postings. Wallets are fast to ship; ledgers are auditable by construction.

**How do I migrate from wallet.balance without downtime?**
Shadow-write journal entries alongside wallet mutations, alert on drift, read from the ledger in low-stakes paths first, then write through the ledger for webhooks and refunds before retiring the column.

**What is the reconstruction test?**
Replay every journal entry in order on an empty database. If you arrive at the same customer balance the app shows, your ledger is the source of truth.

**Do I need a gem like money-rails?**
Not on day one. Use `decimal` columns with explicit scale. Add money-rails when multi-currency formatting matters.

**Is this event sourcing?**
No. It's double-entry bookkeeping. Events are journal entries; balance is derived from postings, not from an event stream projection framework.

**How does this relate to Stripe?**
Stripe is your payment rail. The ledger is your internal source of truth. Reconcile Stripe balance transactions to journal entries nightly – same discipline as [billing idempotency](/posts/billing-idempotency-webhooks-unique-indexes/).

---

*I help teams migrate from wallet columns to ledgers without stopping releases – and audit existing billing layers before chargebacks force the question. [Reach out](https://t.me/eugene_the_engineer?direct) if you're planning this migration.*
