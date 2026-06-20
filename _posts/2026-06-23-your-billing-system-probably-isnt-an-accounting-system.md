---
layout: post
title: "Your Billing System Probably Isn't an Accounting System"
date: 2026-06-23 13:42:00 +0400
last_modified_at: 2026-06-23
description: "Most teams build a wallet. They think they built a ledger. The difference shows up the day you need to explain where the money went."
tags: [ruby, rails, postgresql, billing, architecture, fintech, double-entry accounting, wallet, ledger, backend engineering, fractional cto, webhooks, idempotency, financial systems]
author: eugene
categories: [Engineering, Fintech]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/your-billing-system-probably-isnt-an-accounting-system.png
    alt: "Your Billing System Probably Isn't an Accounting System"
---

*Most teams build a wallet. They think they built a ledger. The difference shows up the day you need to explain where the money went.*

---

## The question that breaks most billing systems

Here's a question I now ask in every backend audit that touches money:

> Can you reconstruct every customer's balance, from scratch, using nothing but the transaction history?

Not "do you have transactions." Not "do you have a `balance` column." Can you take an empty database, replay every event in order, and arrive at the exact balance the customer sees right now.

Most teams answer "yes" instinctively, then go quiet when they actually try it.

That gap between "we have transaction records" and "our balance is *derived* from transaction records" – is the entire difference between a billing system and an accounting system. And it's invisible until the day you need it, which is usually the day a customer disputes a charge, finance asks for a reconciliation, or a chargeback shows up six weeks after the original transaction.

## The pattern that looks like accounting but isn't

Almost every billing system I've reviewed converges on the same four models:

```ruby
class Wallet < ApplicationRecord
  # balance:decimal, currency:string, customer_id:bigint
end

class WalletTransaction < ApplicationRecord
  # wallet_id, amount, transaction_type, metadata
end

class Invoice < ApplicationRecord
  # customer_id, amount_due, status
end

class Payment < ApplicationRecord
  # invoice_id, amount, status, provider_reference
end
```

This looks like a bank. It has transactions. It has balances. It has invoices and payments. Surely that's accounting.

Here's the tell. Go look at how the balance actually gets updated:

```ruby
class CreditWalletService
  def call(wallet:, amount:, reason:)
    ApplicationRecord.transaction do
      wallet.lock!
      wallet.balance += amount
      wallet.save!

      WalletTransaction.create!(
        wallet: wallet,
        amount: amount,
        transaction_type: reason,
        balance_after: wallet.balance
      )
    end
  end
end
```

This is the line that matters:

```ruby
wallet.balance += amount
```

The `WalletTransaction` row isn't the source of truth. It's a **receipt**. The source of truth is whatever number currently sits in `wallets.balance`. The transaction log is a courtesy – a thing you write *after* the real mutation, for audit purposes, that you hope stays in sync with reality forever.

It usually does. Until a retry double-applies a credit, a background job re-runs after a deploy, or two requests race past the lock in a way nobody anticipated. At that point the `WalletTransaction` table tells you a story that the `balance` column quietly disagrees with and there's no mechanism that would ever have caught the disagreement, because nothing in the system ever checks transactions against balance. They were never actually linked. They just happen to usually agree.

## The thing real accounting does that billing systems skip

Double-entry accounting has exactly one rule that matters here:

```text
Σ debits = Σ credits, always, for every entry, forever.
```

Every entry touches at least two accounts. Money doesn't get created or destroyed – it moves. If it doesn't balance, the entry is rejected before it's written, not investigated after the fact.

```ruby
class JournalEntry < ApplicationRecord
  has_many :postings

  after_create :verify_balance!

  private

  def verify_balance!
    debits  = postings.where(direction: "debit").sum(:amount)
    credits = postings.where(direction: "credit").sum(:amount)

    raise UnbalancedEntryError unless debits == credits
  end
end

class Posting < ApplicationRecord
  belongs_to :journal_entry
  belongs_to :account
  # direction: "debit" | "credit", amount:decimal
end
```

A customer wallet, in this model, isn't a number you mutate. It's an **account**, and its balance is a query:

```ruby
class Account < ApplicationRecord
  has_many :postings

  def balance
    debits  = postings.where(direction: "debit").sum(:amount)
    credits = postings.where(direction: "credit").sum(:amount)
    debits - credits
  end
end
```

Crediting a customer now looks like this:

```ruby
class CreditCustomerService
  def call(customer_account:, revenue_account:, amount:, reason:)
    ApplicationRecord.transaction do
      entry = JournalEntry.create!(reason: reason)
      entry.postings.create!(account: customer_account, direction: "credit", amount: amount)
      entry.postings.create!(account: revenue_account,  direction: "debit",  amount: amount)
    end
  end
end
```

Notice what's gone: there's no `wallet.balance += amount` anywhere in this codebase. There's no field to get out of sync, because there's no field. The balance is always, by construction, the sum of history. You cannot end up with a balance that the transaction log can't explain, because the balance *is* the transaction log, computed.

This is, structurally, a tiny thing. One join table and a query instead of a column and an increment. It is also the entire reason most billing systems can't actually answer "show me how this customer's balance got here" without a developer reading code and guessing.

## Why almost nobody actually does this

If double-entry is this straightforward, why does almost every Rails billing app I've seen skip it?

Three honest reasons:

**It's slower to ship.** `wallet.balance += amount` is one line and ships a feature today. A proper ledger means an `accounts` table, a `postings` table, balance-as-query (or a carefully maintained materialized balance with reconciliation jobs), and journal entry validation. For a v1 wallet feature, that's a hard sell against a sprint deadline.

**The happy path never reveals the problem.** Charge → invoice → payment → success. That loop can run in production for two years without a single inconsistency surfacing, because nothing is actively trying to break it. The mutable-balance pattern isn't *wrong* under normal load – it's wrong under the conditions that show up later.

**Nobody asks the reconstruction question until they're forced to.** Usually that's a finance team doing a SOC 2 audit, an investor's due diligence, or, most often, a customer support ticket that starts with "your invoice doesn't match what I was charged" and ends three engineers deep in transaction logs trying to figure out who's right.

## Where the cracks actually show up: not charging, reversing

Here's the part that surprised me the first time I traced it carefully: the happy path is almost never where billing systems break. Money going *in* is easy. Money coming back *out*, and money getting corrected after the fact, is where the architecture gets tested.

```text
refund
partial refund
credit note
chargeback
voided invoice
duplicate webhook
replayed webhook (after a timeout, a deploy, a retry queue)
```

Every one of these is a case where the system has to undo or adjust something it already considered final. And "undo" is exactly the operation a mutable-balance system was never designed for.

### Refunds on a mutable balance

```ruby
class RefundService
  def call(payment:, amount:)
    ApplicationRecord.transaction do
      wallet = payment.invoice.customer.wallet
      wallet.lock!
      wallet.balance -= amount   # <- which balance is this undoing, exactly?
      wallet.save!

      WalletTransaction.create!(
        wallet: wallet,
        amount: -amount,
        transaction_type: "refund",
        metadata: { payment_id: payment.id }
      )
    end
  end
end
```

This works fine. Right up until the refund webhook from your payment provider fires twice, because providers retry on timeout and don't guarantee exactly-once delivery. Now you've decremented the balance twice for one refund, and the only thing standing between you and a phantom balance is whatever idempotency check you remembered to add.

### Idempotency isn't a nice-to-have here. It's the financial control

```ruby
class ProcessRefundWebhookJob < ApplicationJob
  def perform(webhook_payload)
    event_id = webhook_payload["id"]

    # The unique index, not this check, is what actually saves you.
    return if WebhookEvent.exists?(provider_event_id: event_id)

    ApplicationRecord.transaction do
      WebhookEvent.create!(provider_event_id: event_id)  # unique index on provider_event_id
      RefundService.new.call(
        payment: Payment.find_by!(provider_reference: webhook_payload["payment_id"]),
        amount: webhook_payload["amount"]
      )
    end
  end
end
```

```ruby
# migration
add_index :webhook_events, :provider_event_id, unique: true
```

The `return if exists?` line is a convenience. The `unique: true` index is the actual control. If two webhook deliveries race each other, one `INSERT` wins and the other raises `ActiveRecord::RecordNotUnique` – which you catch and discard, rather than two refunds silently both going through.

This is worth sitting with for a second: **a database unique constraint is doing more for your financial correctness here than your business logic is.** That's not a knock on the business logic. It's just where the real guarantee lives.

### Why a `lock_version` doesn't save you here either

Optimistic locking is the other thing teams reach for, and it solves a real problem, just not this one.

```ruby
class Wallet < ApplicationRecord
  # lock_version:integer (Rails optimistic locking)
end

wallet.balance += amount
wallet.save!  # raises StaleObjectError if another process updated it first
```

`lock_version` protects you from a **lost update** – two concurrent writers stepping on each other's change to the same row. It does nothing for:

- The same refund webhook processed twice, ten minutes apart, with no concurrency involved at all.
- A credit note issued against an invoice that was already voided by a different process.
- A chargeback that arrives after the original payment's wallet transaction has already been reversed by a manual support action.

These aren't concurrency bugs. They're **sequencing and idempotency** bugs – the system has no concept of "this financial event already happened," only "no one else is touching this row right now." Optimistic locking and financial idempotency solve adjacent but different problems, and a lot of teams ship the first and assume they got the second for free.

## "Event sourced" in name only

There's a specific flavor of this I see often enough that it deserves its own name: the **almost-event-sourced wallet**.

```ruby
class WalletTransaction < ApplicationRecord
  # looks exactly like an event log:
  # wallet_id, amount, transaction_type, occurred_at, metadata
end
```

Every signal says event sourcing: immutable rows, append-only, a `transaction_type` enum, timestamps. Teams describe it that way in design docs. But the source of truth still isn't the event log – it's `wallet.balance`, mutated directly, with the event log written alongside as documentation. If you deleted every row in `wallet_transactions` tomorrow, the system would keep running and nobody would notice for months, because nothing reads from that table to compute anything that matters. It's a black box flight recorder, not a ledger.

Real event sourcing means the **only** way to know the current balance is to fold over the events. If your balance is reachable through a column read instead of an event replay, you don't have event sourcing – you have a mutable balance with good logging.

## What this actually costs, and what it doesn't

To be direct about the trade-off, because the ledger model isn't free: it costs you query performance (sum-over-postings is slower than a column read, until you add a materialized balance with a reconciliation job that re-derives it periodically and asserts it still matches), and it costs you implementation time up front.

What it buys you:

- **An answer to the reconstruction question**, on demand, for a support ticket, an audit, or your own debugging, instead of "let me read the code and guess."
- **A natural double-check.** `Σ debits = Σ credits` is a single query you can run as a scheduled job, alerting on a discrepancy before finance or a customer finds it.
- **Refunds, credit notes, and chargebacks become entries, not exceptions.** They're journal entries that happen to move money the other direction, not special-cased decrements bolted onto a mutable field.

You do not need this everywhere. A loyalty-points balance with no cash-out option and no regulatory exposure can probably stay a mutable integer forever and nobody will ever care. The moment real money, refunds, or anything resembling "we owe this customer an explanation of their balance" enters the picture, the calculus changes.

## If you're already in production with a mutable balance

You're not rewriting this in a sprint, and you shouldn't try to. The path I've used to migrate teams off this pattern without a big-bang rewrite:

1. **Add the ledger alongside the existing balance**, write to both for a while, and run a scheduled job that asserts `wallet.balance == sum_of_postings(account)`. This is purely diagnostic – it costs you nothing and tells you, within days, how often and how badly the two are already diverging in your *current* system. (For most teams I've walked through this, the answer is "more often than they expected," which is usually the moment the migration gets prioritized.)
2. **Make the ledger authoritative for reads** in one low-stakes code path first – a support-facing balance explanation page is a good first candidate, because it's read-only and the audience is internal.
3. **Cut writes over service by service**, starting with the ones that touch refunds and credit notes first, since that's where the mutable-balance model was already weakest.
4. **Retire the mutable column last**, once nothing writes to it and the reconciliation job has shown zero drift for a meaningful stretch.

The point of doing it in this order is that you get the safety property. The ability to reconstruct and double-check balances, almost immediately, in step 1, before you've changed a single write path. Everything after that is risk reduction on a system that's already telling you the truth.

## The actual claim

Strip away the code and this is the whole argument:

> Most billing systems are optimized for charging customers successfully. Very few are optimized for explaining, with certainty, where every cent went.

Those are different engineering problems, and the second one only gets harder under exactly the conditions you'd expect. Refunds, retries, disputes, audits – none of which show up in a demo, all of which show up eventually in production.

If your billing system has never been asked the reconstruction question, that's not evidence it would pass. It's evidence it hasn't been tested yet.

---

*I help engineering teams audit and de-risk the systems that move money before a chargeback, an audit, or a support escalation forces the question. If you're staring down a wallet/billing layer that's never been asked "can you reconstruct this balance," I'm taking on a limited number of fractional CTO and backend audit engagements this quarter – [happy to look at it](https://t.me/eugene_the_engineer?direct).*
