---
layout: post
title: "Exactly-Once Is an Illusion: Rails Payments"
date: 2026-07-22 11:42:00 +0400
last_modified_at: 2026-07-22
description: "Idempotency is not exactly-once. Walk a Rails payment path API, outbox, jobs, Stripe, webhooks, ledger, reconciliation and why exactly-once is architecture, not a header."
tags: [ruby, rails, postgresql, billing, fintech, idempotency, exactly-once, stripe, sidekiq, solid queue, outbox, ledger, reconciliation, backend engineering, fractional cto]
author: eugene
categories: [Billing & Fintech]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/exactly-once-is-an-illusion-rails-payments.png
    alt: "Exactly-once processing pipeline: Client through API, payments, immutable ledger, outbox, workers, provider, webhook inbox, and reconciliation–with duplicates rejected at each hop"
---

*Ask a room of backend engineers how they guarantee exactly-once payment processing. Most will say "use an idempotency key." The strongest answers leave that sentence behind within a minute – state machines, ledgers, provider callbacks, chargebacks, reconciliation. Those engineers already know: idempotency is one layer, not the system.*

---

Part of [Billing Systems for Rails Engineers](/billing-systems-for-rails-engineers/). [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/) covered how unique indexes stop duplicate webhooks from moving money twice. This post is the architectural claim underneath that tactic:

> **Exactly-once is not a delivery guarantee. It is the emergent property of at-least-once delivery, idempotent commands, atomic transactions, UNIQUE constraints, an immutable ledger, outbox/inbox, and reconciliation.**

If you searched for **exactly-once payment processing in Rails**, that sentence is the answer. Everything below is why.

---

## Idempotency ≠ exactly once

These are different jobs, and most articles collapse them into one bullet.

**Idempotency** answers: *What do we do if the same message arrives twice?*

**Exactly-once processing** answers: *How do we guarantee the business operation happened once, no matter how many delivery attempts occurred?*

An `Idempotency-Key` header, a `SETNX`, or `UNIQUE(event_id)` gives you **deduplication at a boundary**. That is necessary. It is not sufficient. Deduping one hop does not make the payment path exactly-once end to end – and distributed systems do not offer exactly-once *delivery* anyway. Stripe's API keeps idempotency keys for **24 hours** and then removes them; Sidekiq's own best practices tell you to design for **at-least-once** execution. The infrastructure is honest. Marketing slides often are not.

---

## The race everyone still ships

Before the architecture diagram, the failure mode that still ships in production Rails apps:

```ruby
return if ProcessedEvent.exists?(event_id)

ProcessedEvent.create!(event_id: event_id)
process_payment
```

It looks correct. Under concurrency it is not:

```text
Worker A                         Worker B
────────                         ────────
SELECT … nothing found
                                 SELECT … nothing found
INSERT
                                 INSERT  ← second financial effect
```

The existence check is not a lock. Two workers both observe "absent," both proceed. The mechanism that actually synchronizes concurrent writers is the **UNIQUE constraint** (or `INSERT … ON CONFLICT DO NOTHING` in PostgreSQL) – not the Ruby `if`. In Rails 8.1, a violating insert raises `ActiveRecord::RecordNotUnique`; `upsert_all(..., on_duplicate: :skip)` and `insert_all` with skip-on-duplicate are the bulk equivalents. Treat the constraint as the control plane.

I covered the webhook ingest pattern – persist with unique index, return 200 on duplicate, apply money with its own `idempotency_key` – in [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/). The rest of this post assumes that layer exists and asks what still goes wrong when it does.

---

## Exactly-once is a property of the whole path

Walk every hop where a duplicate can appear. At each one, ask: *What happens if this message arrives twice?*

![Exactly-once processing pipeline: Client through API, payments, immutable ledger, outbox, workers, provider, webhook inbox, and reconciliation–with duplicates rejected at each hop](/assets/img/exactly-once-is-an-illusion-rails-payments.png)
{: .normal}

```text
Client
  ↓
API  (Idempotency-Key)
  ↓
Payments table
  ↓
Ledger  (immutable postings)
  ↓
Outbox
  ↓
Active Job  (Sidekiq / Solid Queue)
  ↓
Provider  (Stripe PaymentIntent, …)
  ↓
Webhook Inbox
  ↓
Projection  (wallet UI, entitlements)
  ↓
Reconciliation Job
```

Shallow articles stop at:

```text
Client → Idempotency-Key → Payment
```

A billing system that has to survive chargebacks, support tickets, and provider retries looks more like this:

```text
Client
  ↓
Idempotency Key
  ↓
Payments
  ↓
Ledger
  ↓
Outbox
  ↓
Provider
  ↓
Webhook Inbox
  ↓
Projection
  ↓
Reconciliation Job
```

That is not "another Stripe tutorial." It is the shape of a system someone designed to explain money under failure.

### Client → API

Browser double-submit, mobile retry, load balancer timeout. Your API accepts an `Idempotency-Key` (or derives one from `checkout_session_id`) and stores it with a unique index before any money moves. Without that, two HTTP requests create two payment rows before Stripe ever sees a request.

### API → payments row → ledger

Creating a `payments` row is not the same as recording money. The financial fact lives in the [double-entry ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/): balanced postings with an `idempotency_key` unique across journal entries. Idempotency stops you from *running the command twice*. The ledger lets you *prove* the amount was booked once.

### Outbox → Active Job → provider

Calling Stripe inside the same request that commits the ledger couples your HTTP latency to their API and leaves you with "committed locally, never charged" or "charged, never committed" on crash. The outbox pattern writes the ledger postings and an `outbox_messages` row in **one transaction**; a worker drains the outbox and calls the provider.

Sidekiq is at-least-once: retries after success-but-crash are expected. Solid Queue is the same class of problem – DB-backed Active Job with retries via Active Job, plus optional `limits_concurrency` / `on_conflict: :discard`. Job-level concurrency controls are not a substitute for a financial UNIQUE constraint. They reduce duplicate *work*; they do not prove the ledger was posted once.

Outbound Stripe calls get their own key in request opts (stripe-ruby):

```ruby
Stripe::PaymentIntent.create(
  {
    amount: payment.amount_cents,
    currency: payment.currency,
    customer: payment.stripe_customer_id,
    metadata: { payment_id: payment.id }
  },
  { idempotency_key: "payment_intent:#{payment.id}" }
)
```

Stripe will not create two PaymentIntents for the same key within the 24-hour window. Your outbox worker must still treat a retry after a successful create as "load existing PI," not "create again with a new key."

### Provider → webhook inbox → projection

Stripe webhooks are at-least-once and **not ordered**. A `payment_intent.succeeded` may arrive twice; a `charge.refunded` may arrive before a delayed `payment_intent.succeeded` on a different worker. Inbox tables with `UNIQUE(provider, provider_event_id)` dedupe delivery. Projections (customer balance cache, entitlement flags) must be derived from ledger state or updated idempotently from the same keys – not incremented on every webhook body that looks new.

### Reconciliation

The honesty layer. Nightly (or hourly) jobs compare provider settlement reports to ledger aggregates and projection caches. When they disagree, you have a ticket with evidence – not a `wallet.balance` that drifted for six months. Reconciliation does not *create* exactly-once semantics; it detects when the composition failed.

Outbox and inbox deserve their own posts in this series. Here they are named layers in the composition, not full implementations.

---

## Idempotency prevents re-execution. Ledger proves the money.

Teams mix these concepts constantly.

| Mechanism | Question it answers |
|-----------|---------------------|
| Idempotency key / UNIQUE on operation | Did we already *attempt* this command? |
| Immutable ledger postings | Can we *reconstruct* what was booked? |
| Reconciliation | Does our book match the provider's? |

A duplicate journal entry that is still balanced (`Σ debits = Σ credits`) will pass a naïve "double-entry invariant" check and still over-credit the customer. The reconstruction test from the [ledger post](/posts/double-entry-ledger-in-rails-minimal-production-model/) – empty database, replay every posting, land on the balance the UI shows – is how you notice. Idempotency at the event boundary is what prevents the bad replay from being written in the first place.

One sentence to keep:

> **Idempotency prevents re-executing a command. A ledger lets you prove the money was recorded exactly once.**

---

## Composition, not a magic flag

Nobody ships a queue labeled `exactly_once: true` that makes billing safe. What people call "exactly-once payments" is this stack:

| Layer | Role |
|-------|------|
| At-least-once delivery | HTTP retries, Sidekiq/Solid Queue retries, Stripe webhook retries |
| Idempotent commands | Same key → same outcome; no second side effect |
| Atomic transactions | Ledger + outbox (or inbox + posting) commit together |
| UNIQUE constraints | Concurrent writers synchronize in PostgreSQL |
| Immutable ledger | History you can replay and audit |
| Outbox / Inbox | Decouple commit from provider I/O; dedupe inbound events |
| Reconciliation | Detect drift when any layer fails open |

[PostgreSQL's `ON CONFLICT`](https://www.postgresql.org/docs/current/sql-insert.html) and Rails' `RecordNotUnique` are synchronization tools. Stripe's [idempotent requests](https://docs.stripe.com/api/idempotent_requests) protect *their* side of a POST for 24 hours. Your architecture still has to compose the rest.

**Exactly-once is not an infrastructure guarantee. It is an architecture property.**

---

## Short Answer

Exactly-once payment processing in Rails is not an `Idempotency-Key` header. It is the composition of at-least-once delivery, idempotent commands, UNIQUE constraints, an immutable ledger, outbox/inbox boundaries, and reconciliation. Deduplication at one hop is necessary and insufficient.

---

## Final Answer: How to Aim for Exactly-Once Payments in Rails

1. **Name the illusion.** Demand "exactly-once delivery" from Sidekiq, Solid Queue, or Stripe webhooks and you will design the wrong system. Design for at-least-once + idempotent effects.
2. **Protect every hop.** Client retries, job retries, provider API calls, and webhooks each need an identity and a UNIQUE constraint (or `ON CONFLICT DO NOTHING`) where a duplicate would move money.
3. **Separate command from proof.** Idempotency keys stop re-execution. Ledger postings are the proof. Link them with the same business key.
4. **Use outbox for outbound provider calls.** Commit ledger + outbox together; drain with a worker that passes `idempotency_key:` in stripe-ruby opts.
5. **Use inbox for webhooks.** Persist `evt_…` uniquely, return 2xx on duplicates, project from ledger – details in [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/).
6. **Reconcile on a schedule.** Compare Stripe (or PSP) totals to ledger aggregates; alert on drift before customers do.
7. **Do not confuse job concurrency with financial correctness.** Solid Queue `limits_concurrency` and Sidekiq uniqueness middleware reduce duplicate work; they do not replace UNIQUE + ledger.

---

## FAQ: Exactly-once payments in Rails

**Is exactly-once delivery real in distributed systems?**
Not as a general property of queues and HTTP. What teams call exactly-once *processing* is at-least-once delivery plus idempotent handlers and durable constraints.

**Are idempotency keys enough for billing?**
No. They protect one boundary (often the HTTP or provider API call). Payments still need ledger identity, webhook inbox uniqueness, and reconciliation.

**How long does Stripe keep an Idempotency-Key?**
24 hours from first use, then the key is removed. Retries after expiry can create a second object if you reuse the key carelessly – store your mapping and load the existing PaymentIntent by id.

**Does Sidekiq or Solid Queue provide exactly-once jobs?**
No. Sidekiq documents at-least-once execution and asks you to make jobs idempotent. Solid Queue relies on Active Job retries and optional concurrency limits; money safety still lives in PostgreSQL uniqueness and the ledger.

**What is the difference between outbox and inbox?**
Outbox: reliably publish *outbound* work (call Stripe) after a local commit. Inbox: reliably accept *inbound* events (webhooks) once. Both are usually UNIQUE-keyed tables plus workers.

**Why isn't `exists?` before `create!` enough?**
Two workers can both see "missing" before either inserts. Only a unique constraint (or `ON CONFLICT`) makes check-and-set atomic under concurrency.

**How does a ledger help if postings are balanced?**
Balance (`Σ debits = Σ credits`) does not imply the *correct* customer amount. Duplicate balanced journals over-credit. Unique `idempotency_key` on journal entries plus reconciliation catch that.

**Where should I start if I only have a wallet column today?**
Add unique constraints on webhook/event and operation identities first ([Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/)), then introduce append-only postings ([Double-Entry Ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/)), then reconciliation. Outbox/inbox deepen the same path.

---

*More in this series: [Billing Systems for Rails Engineers](/billing-systems-for-rails-engineers/) · [Billing Idempotency](/posts/billing-idempotency-webhooks-unique-indexes/) · [Double-Entry Ledger](/posts/double-entry-ledger-in-rails-minimal-production-model/) · [Inventory Ledger](/posts/building-an-inventory-ledger-in-rails-8-why-quantity-columns-lie/)*

*I audit Rails billing paths for the gap between "we have idempotency keys" and money that can still move twice. If you're shipping payments this quarter, [happy to review the architecture](https://t.me/eugene_the_engineer?direct).*
