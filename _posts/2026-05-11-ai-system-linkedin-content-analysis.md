---
layout: post
title: "I Built a Local AI Scorer for My LinkedIn Posts"
last_modified_at: 2026-05-11
description: "LinkedIn metrics lack signal. I built a local pipeline: scrape posts, score against a CTO goal, classify topics—Ruby, Postgres, Ollama, caching, RAG."
tags: [ai, linkedin, content strategy, ruby, postgresql, postgres, pgvector, ollama, engineering leadership, fractional cto, data pipeline, llm, analytics, tech blog, software architecture, product-minded engineer]
author: eugene
categories: [AI, Problem Solving]
comments : True
pin: false
render_with_liquid: false
image:
    path: /assets/img/ai-system-linkedin-content-analysis.png
    alt: "Diagram showing AI system to analyze LinkedIn content"
---

LinkedIn gives you data.

Signal? Not always.

For months I stared at the native analytics dashboard trying to answer one simple question:

*what content actually moves me toward the kind of people I want to work with?*

Not “what got impressions.”
Not “what got dopamine.”
Actual signal.

Because look — dashboards love showing numbers.
Numbers feel smart.
But most analytics are basically a car dashboard that proudly tells you the wheels are spinning without explaining why you're driving into a ditch.

So I built my own evaluation pipeline.

Not because “AI”.
Because I got tired of guessing.

---

## The actual problem

LinkedIn analytics tells you what happened.

It rarely tells you:

* which topics attract CTOs and founders specifically
* what kind of posts generate inbound conversations
* where you're drifting into content noise
* whether you're building positioning or just farming engagement

You get metrics.

You don't get decisions.

Different thing.

---

## What the system does

### 1. Pulls full post content

LinkedIn exports are kinda funny.

You get links, timestamps, reactions.
But not the actual thing people read.

So I use Playwright to scrape every post body into PostgreSQL.

Because analyzing “engagement” without content is like debugging production from CPU graphs only.
Good luck with that.

---

### 2. Scores posts against a real goal

This is the part most “AI analytics” tools quietly skip.

You first need to define:
**what does “good” even mean?**

My goal is simple:

> attract inbound opportunities from CTOs, founders, and technical leadership.

So every post gets scored across six dimensions:

* audience fit
* technical depth
* problem clarity
* business impact
* inbound potential
* signal vs filler

Each score comes with rationale.
No magic black box nonsense.

Basically I wanted something closer to:
“why this worked”
instead of
“congrats, number go up.”

---

### 3. Maps topics against outcomes

Every post gets classified into topic buckets:

* backend scaling
* system design
* engineering leadership
* AI engineering
* hiring
* reliability
* CTO/founder perspective
* etc

Then I compare that against engagement and inbound patterns.

And honestly, some results were uncomfortable.

Some high-effort posts performed terribly against the actual goal.

Meanwhile some simple posts with:

* one real production problem
* one non-obvious insight
* one strong opinion

...worked significantly better.

Which is a useful reminder:

Effort is not value.

Alignment is.

---

## Stack

Nothing exotic, honestly.

* Ruby 4
* PostgreSQL + pgvector
* Sequel
* Playwright
* RubyLLM
* Ollama
* local models
* Solid Queue

No hosted AI APIs.
No “AI SaaS platform”.
No VC-funded abstraction lasagna.

Just boring infrastructure solving a concrete problem.

Funny how often that still works.

---

## The interesting part

The biggest lesson was not about models.

I used open-source models end-to-end.

The important part was the evaluation contract.

Meaning:

* what “good” means
* what success means
* what dimensions matter
* what drift looks like

Honestly, this is where many AI projects go sideways.

Teams spend weeks debating models like they're choosing a religion.

Meanwhile nobody clearly defines:

* goals
* scoring
* failure modes
* feedback loops

So the system produces statistically sophisticated confusion.

---

## The broader pattern

This architecture works almost anywhere you have:

1. a defined goal
2. historical data
3. a scoring system

Content strategy.
Lead scoring.
Hiring funnels.
Support quality.
Sales messaging.
Engineering reviews.

Same loop every time:

> define good → score reality → detect drift → refine

Basically production engineering, just applied to decision systems.

---

## Five questions before building production AI

1. What exactly are you optimizing for?
2. How do you measure “good”?
3. What taxonomy are you using?
4. What score is acceptable without review?
5. How do you detect drift over time?

If these answers are vague, the model is not your bottleneck.

The thinking is.

---

This is also why I increasingly distrust generic “AI strategy” conversations.

A lot of them sound impressive right until you ask:
“Okay. What exact business decision improves because of this?”

And suddenly the room becomes quieter than a Kubernetes cluster after someone accidentally deleted production.
