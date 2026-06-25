---
layout: post
title: "Billing Idempotency: Webhooks, Unique Indexes, and the Line Between"
date: 2026-07-01 13:42:00 +0400
last_modified_at: 2026-07-01
description: "Stripe webhooks retry. Your billing job runs twice. Here's how unique indexes, idempotency keys, and the database – not your service object – keep money from moving twice."
tags: [ruby, rails, postgresql, billing, fintech, idempotency, webhooks, stripe, backend engineering, fractional cto, financial systems, sidekiq, unique index]
author: eugene
categories: [Billing & Fintech]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/only_one_layer_wins.png
    alt: "Billing idempotency architecture for Rails webhooks and payment retries"
---

*Payment providers retry on timeout. Sidekiq retries on exception. Your `if exists?` check runs twice. Only one layer in the stack actually guarantees the financial effect is applied at most once – and it's usually not the layer you wrote last.*

---

In [Your Billing System Probably Isn't an Accounting System](/posts/your-billing-system-probably-isnt-an-accounting-system/), I argued that most Rails billing apps optimize for charging successfully, not for explaining where every cent went. Idempotency is where that gap shows up first – not in architecture diagrams, but in a support ticket that says *"we were charged twice"* and a `wallet_transactions` table that has two rows for one Stripe event.

This post is the implementation companion: webhooks, background jobs, race conditions, and where the real guarantee lives.

---

## The failure mode everyone has seen

A payment provider sends a webhook. Your app times out before returning 200. The provider retries. Your `ProcessPaymentWebhookJob` runs again.

```ruby
class ProcessPaymentWebhookJob < ApplicationJob
  def perform(payload)
    event_id = payload["id"]

    return if WebhookEvent.exists?(provider_event_id: event_id)

    ApplicationRecord.transaction do
      WebhookEvent.create!(provider_event_id: event_id)
      CreditWalletService.new.call(
        wallet: find_wallet(payload),
        amount: payload["amount"],
        reason: "payment_succeeded"
      )
    end
  end
end
```

This looks correct. It isn't.

The `exists?` check and the `create!` are not atomic. Two job workers processing the same webhook **at the same time** can both pass the guard and both credit the wallet. A delayed retry ten minutes later is a different failure mode – `exists?` usually catches that – but it still fails under concurrency, process crashes between check and insert, and deploys mid-job. Optimistic locking on `wallet.lock_version` doesn't save you here either; that protects concurrent updates to the same row, not *sequencing* of duplicate financial events.

Financial idempotency and concurrency control solve adjacent problems. A lot of teams ship the second and assume they got the first for free.

---

## Three layers, one winner

I think about billing idempotency in three layers:

| Layer | What it protects | Typical failure |
|-------|------------------|-----------------|
| **HTTP / API** | Client retries with same idempotency key | Key stored in Redis with TTL – expires before retry |
| **Application** | `exists?` before insert | Race between check and write |
| **Database** | Unique constraint on event identity | Actually enforced |

Only the database layer survives process crashes, deploys mid-job, and duplicate webhook delivery without relying on timing.

The pattern I reach for in every billing audit:

```ruby
# db/migrate/xxx_create_webhook_events.rb
class CreateWebhookEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :webhook_events do |t|
      t.string :provider_event_id, null: false
      t.string :provider, null: false, default: "stripe"
      t.jsonb :payload, null: false, default: {}
      t.timestamps
    end

    add_index :webhook_events, [:provider, :provider_event_id], unique: true
  end
end
```

```ruby
class ProcessPaymentWebhookJob < ApplicationJob
  def perform(webhook_event_id)
    webhook_event = WebhookEvent.find(webhook_event_id)

    ApplicationRecord.transaction do
      apply_financial_effect(webhook_event)
    end
  rescue ActiveRecord::RecordNotUnique
    # Duplicate delivery or Sidekiq retry – already processed. Safe to ignore.
    Rails.logger.info("Duplicate webhook #{webhook_event.provider_event_id}, skipping")
  end

  private

  def apply_financial_effect(webhook_event)
    TopUpCustomerWalletService.call(
      customer: customer_for(webhook_event),
      amount: webhook_event.payload["amount"],
      reason: "payment_succeeded",
      idempotency_key: webhook_event.provider_event_id
    )
  end
end
```

The `RecordNotUnique` rescue is not a hack. It's the control. The unique index is doing more for financial correctness than the business logic is.

---

## Idempotency keys are not interchangeable

Teams mix up three different keys. They are not the same job.

**Provider event ID** (`evt_...` from [Stripe](https://docs.stripe.com/webhooks), `wh_...` from others). Use this for webhook deduplication. The provider guarantees it identifies one logical event.

**Client idempotency key** (`Idempotency-Key` header on API calls *you* make). Use this when *your* app calls Stripe to create a charge. Store it with a unique index on outbound requests. Stripe keeps keys for 24 hours – see [idempotent requests](https://docs.stripe.com/api/idempotent_requests).

**Internal operation ID** (your own UUID per `CreditWalletService` call). Use this when the same business action can be triggered from multiple entry points – admin panel, API, webhook – and you need one canonical identity.

```ruby
class BillingOperations < ApplicationRecord
  # idempotency_key:string – unique, not null
  # operation_type:string
  # status:string
end

add_index :billing_operations, :idempotency_key, unique: true
```

A refund initiated from a webhook and the same refund clicked by support five minutes later must converge on one `idempotency_key` derived from `(payment_id, operation_type)` – not two separate wallet decrements.

---

## Webhooks: return 200 only after the constraint wins

The ordering mistake I see most often:

1. Process payment
2. Return 200
3. Hope the job doesn't run twice

The safer shape for high-volume webhooks:

1. Persist raw event with unique constraint (fast)
2. Enqueue idempotent job
3. Return 200 immediately

```ruby
class StripeWebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token

  def create
    payload = request.body.read
    event = Stripe::Webhook.construct_event(
      payload, request.env["HTTP_STRIPE_SIGNATURE"], ENV.fetch("STRIPE_WEBHOOK_SECRET")
    )

    webhook_event = WebhookEvent.create!(
      provider: "stripe",
      provider_event_id: event.id,
      payload: event.to_hash
    )

    ProcessPaymentWebhookJob.perform_later(webhook_event.id)
    head :ok
  rescue ActiveRecord::RecordNotUnique
    head :ok  # duplicate – provider should not retry forever
  end
end
```

Stripe will retry until it gets 2xx. Returning 200 on `RecordNotUnique` is correct – the event was already accepted. Failing with 500 on a duplicate causes unnecessary retries and noise, even if your unique index prevents double-crediting. See [Stripe webhook best practices](https://docs.stripe.com/webhooks/best-practices).

---

## Sidekiq retries vs financial side effects

Sidekiq's default retry is a gift for idempotent *reads*. It's a liability for money movement.

If `CreditWalletService` runs, commits, then raises on a downstream notification failure, Sidekiq retries the whole job. Without a unique constraint on the operation, you credit twice.

Options, in order of preference:

1. **Unique index on operation identity** – retry becomes safe; second run hits `RecordNotUnique` and exits.
2. **Split the job** – financial write in one job (no retry or `retry: 0`), notifications in another.
3. **Outbox pattern** – write financial event + outbox row in one transaction; separate consumer processes outbox.

For billing, I default to (1) + (2). Money jobs get `sidekiq_options retry: 0` *after* the unique constraint exists. Notification jobs can retry freely.

---

## Race conditions the unique index catches

Two workers process the same webhook simultaneously. Both pass `exists?`. Both call `create!`. One wins; one gets `RecordNotUnique`. The loser must not apply financial effects.

With the controller-first pattern above, the unique index on `webhook_events` is the gate at ingest. The job still needs its own idempotency constraint on the money movement – `journal_entries.idempotency_key` or `billing_operations.idempotency_key` – so a Sidekiq retry cannot credit twice after the event row already exists.

If you process synchronously in one job instead, financial effects must live *inside* the same transaction as the insert:

```ruby
ApplicationRecord.transaction do
  WebhookEvent.create!(provider_event_id: event_id, ...)
  apply_financial_effect(webhook_event)
end
```

If you insert the webhook event in one transaction and credit the wallet in a second, you have a window. I've seen this in codebases that "optimized" by splitting transactions for performance. The race comes back.

---

## How this connects to ledger vs wallet

In a [mutable-balance wallet](/posts/your-billing-system-probably-isnt-an-accounting-system/), duplicate idempotency failures show up as `wallet.balance` drifting from `wallet_transactions`. In a [double-entry ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/), duplicate journal entries inflate balances – each duplicate is still balanced, so `Σ debits = Σ credits` holds, but the customer wallet is wrong. A reconciliation job catches it within hours instead of months.

Idempotency at the event boundary is necessary in both models. The ledger model just makes failure visible faster.

For reconciliation queries that compare provider summaries to internal aggregates, the same discipline applies: use [`EXPLAIN (ANALYZE, BUFFERS)`](/posts/stop-reading-explain-analyze-start-cross-examining-it/) on those nightly jobs before they become the slow query nobody owns.

---

## Checklist before you ship the next billing feature

- [ ] Every inbound webhook identity has a **unique database constraint**, not just an `exists?` check
- [ ] Duplicate webhook delivery returns **2xx** to stop provider retries
- [ ] Outbound payment API calls store **idempotency keys** with unique index
- [ ] Money-moving Sidekiq jobs are **retry-safe** or `retry: 0` with constraint in place
- [ ] Financial write + idempotency record are in the **same transaction**
- [ ] You can answer: *"show me every wallet credit triggered by event X"* without reading application logs

---

## Short Answer

To make payment webhooks idempotent in Rails, store each provider event ID in a table with a **unique database index** – not an `exists?` check. Persist the raw event at ingest, return **HTTP 200** on duplicates, and apply the financial effect in a job that uses the event ID as an **idempotency key** on the money movement. Rescue `ActiveRecord::RecordNotUnique` and treat it as already processed. Use separate keys for outbound Stripe API calls.

---

## Final Answer: How to Make Payment Webhooks Idempotent in Rails

1. Create a `webhook_events` table with `UNIQUE(provider, provider_event_id)`.
2. On webhook receipt, `INSERT` the raw event, enqueue a job, return 200. On `RecordNotUnique`, return 200 – the event was already accepted.
3. In the job, apply wallet/ledger logic with `idempotency_key = provider_event_id` and its own unique index.
4. Store Stripe's `evt_...` for inbound webhooks; store `Idempotency-Key` separately for outbound charges ([Stripe docs](https://docs.stripe.com/api/idempotent_requests)).
5. Make Sidekiq money jobs retry-safe via the unique constraint, or set `retry: 0` until the constraint exists.

The database unique index is the guarantee. Application-level `exists?` checks and Redis TTL keys are helpful but do not survive races or crashes.

---

## FAQ: Billing idempotency in Rails

**What is billing idempotency?**
Processing the same financial event multiple times produces the same outcome as processing it once – no duplicate charges, credits, or balance mutations.

**How do I make Stripe webhooks idempotent in Rails?**
Persist each `evt_...` with a unique index, return 200 on duplicates, and use the event ID as the idempotency key when crediting the wallet or writing a journal entry.

**Why isn't `exists?` before `create` enough?**
Two workers can both see "not exists" before either inserts. Only a unique constraint makes the check-and-set atomic at the database level.

**Should webhook handlers return 200 on duplicate events?**
Yes. If your unique index rejected a duplicate, the event was already accepted. Returning 5xx causes unnecessary provider retries.

**What's the difference between Stripe's event ID and an idempotency key?**
Event ID deduplicates inbound webhooks. Idempotency-Key deduplicates outbound API calls your app makes to Stripe. You need both, stored separately with unique indexes.

**Should I use Redis for webhook deduplication?**
Only as a cache layer. Redis TTL keys expire, processes crash, and races still happen. The unique index in PostgreSQL is the durable guarantee.

**What if the job fails after the webhook event is saved?**
Sidekiq retries the job. Without a unique constraint on the financial operation, you credit twice. With `idempotency_key` on the journal entry or billing operation, the retry hits `RecordNotUnique` and exits safely.

**Does optimistic locking (`lock_version`) replace idempotency?**
No. `lock_version` prevents lost updates on concurrent writes to the same row. It does not prevent the same refund webhook from being applied twice ten minutes apart.

---

*I audit Rails billing systems for idempotency gaps, webhook races, and wallet/ledger drift before they become chargebacks. If you're shipping money movement this quarter, [happy to review the architecture](https://t.me/eugene_the_engineer?direct).*
