---
layout: post
redirect_from:
  - /2026/06/17/the-biggest-engineering-wins-were-things-we-didnt-build/
  - /2026/06/17/the-biggest-engineering-wins-were-things-we-didnt-build.html
title: "Biggest Engineering Wins Were Things We Didn't Build"
date: 2026-06-17 13:42:00 +0400
last_modified_at: 2026-06-17
description: "On decision economics, the Hypothetical Future, and why \"eventually\" is the most expensive word in engineering."
tags: [engineering leadership, decision economics, product-minded engineer, technical debt, engineering productivity, fractional cto, product development, automation, architecture, team management, engineering culture, senior engineer]
author: eugene
categories: [Architecture]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/the-most-expensive-word.png
    alt: "The most expensive word in engineering – eventually"
---

*On decision economics, the Hypothetical Future, and why "eventually" is the most expensive word in engineering.*

---

There's a story engineers tell themselves about what good work looks like.

It involves shipping. Moving fast. Building things that scale. Systems that are clean, extensible, ready for what comes next. The narrative has a beginning, a middle, and a satisfying end where something that didn't exist now does – and it works.

I've told that story too. And some of it is true.

But the most valuable work I've done in the last several years? Most of it never shipped. It was the decision to stop. To ask a harder question before writing a line of code. To recognize that a system you don't build can't become a system you have to maintain, migrate, or untangle at the worst possible moment.

This is about **decision economics**: why the quality of engineering decisions matters more than the speed of their execution, and why the best teams I've worked with share one uncomfortable trait – they're not in a hurry to build anything.

---

## Engineering Productivity Is Measured Wrong

The default metric for engineering productivity is throughput. Story points closed. Features shipped. Pull requests merged. Velocity.

These are all proxy metrics for something we actually care about: **outcomes**.

And outcomes are downstream of decisions, not code.

One well-placed product hypothesis can save more engineering time than a year of CI/CD optimization. One honest conversation about whether a feature should exist at all can prevent a six-month detour into an architectural dead end. One question – "what breaks first if we do nothing?" – is worth more than a dozen well-formatted Jira tickets.

The shift I had to make – and I don't think I made it fully until I was responsible for system outcomes rather than just system outputs – was from measuring what we built to measuring what we decided.

That's the difference between a team that's busy and a team that's effective.

---

## The Enemy: The Hypothetical Future

Here's what makes this genuinely hard: premature investment doesn't look like a mistake. It looks like responsibility.

The patterns are familiar to anyone who's spent time on a product engineering team:

- *We should design this to be multi-tenant.* (You have three customers.)
- *Let's make the permissions system extensible.* (Current requirements fit in a spreadsheet.)
- *We need a proper workflow engine.* (The workflow has two steps.)
- *This should be a plugin architecture.* (Nobody has asked for a plugin.)

Every one of these sounds professional. It sounds like forward thinking. It sounds like engineering maturity.

What it actually is, most of the time, is a bet on a future that hasn't happened and may never happen. It's speculative load-bearing – designing for a weight the system may never carry. And speculative work is expensive, not because it's hard to write, but because it's almost impossible to unwrite. Abstractions accumulate. Generality hardens. The system that was designed to be flexible becomes the thing that's hardest to change.

The Hypothetical Future is the single biggest source of wasted engineering time I've witnessed across teams at different scales and stages. And the insidious thing is that it often comes from the best engineers – the ones who've been burned before, who've seen the 2 AM incident where the system couldn't scale, who are trying to be responsible.

The fix isn't to stop thinking ahead. It's to distinguish between real constraints and imagined ones. It's to ask: do we have evidence this will matter, or are we solving a problem that belongs to a company we haven't become yet?

---

## Three Decisions That Changed How We Build

These aren't principles I developed in the abstract. They came from specific moments where a team I was part of chose differently – and the choice was measurable.

---

### Decision #1: Optimize for learning, not automation

We had a process that was repetitive enough that someone suggested automating it. The case was reasonable: the work was manual, the steps were predictable, and engineering had the capacity.

Before any work started, one question got asked:

*What will we know after we ship this that we don't know now?*

The answer, honestly, was: *not much*. We'd automate a process we didn't fully understand, which meant we'd get faster at doing something we hadn't confirmed was worth doing.

So we didn't automate. We ran the manual process for another six weeks, intentionally, with the goal of learning what was actually painful, what varied, and what assumptions we'd been carrying that weren't true. When we did eventually build, we built something much smaller and much more accurate.

The formula that came out of that: **don't automate uncertainty.**

Automation is a force multiplier. If you multiply something you don't understand, you get more of something you don't understand, faster. The value of running a process manually for longer than feels comfortable is that the process teaches you what to build. It's a form of cheap due diligence on an expensive commitment.

This is not an argument against automation. It's an argument for sequencing: understand first, then automate.

---

### Decision #2: Build for today's bottleneck

At some point in most product conversations, the horizon starts shifting. The question moves from "what breaks now?" to "what might break if we grow?" And that shift, while intuitive, is where a lot of time gets lost.

The framing I've found most useful is this:

> *What breaks first if we do nothing?*

Not: what might break in eighteen months if we hit our growth targets. Not: what will we need at Series B. Not: what would a much larger company need in our position.

What breaks *first*, in *production*, *now*.

This sounds obvious. It rarely gets practiced. Because the actual bottleneck is usually unglamorous – a slow query, a synchronous call that should be async, a database table that's grown too large for the indexes that made sense two years ago. The Hypothetical Future is more interesting to work on. It feels more significant. It makes for a better engineering design doc.

But the bottleneck that's breaking your product today is the one that's costing you users, degrading trust, and creating operational noise that pulls engineers out of productive work. Solving it is more valuable than designing for a scale you haven't reached.

The teams I've seen execute this well have a shared discipline: they refuse to let planning conversations drift from concrete present-tense problems into abstract future-tense scenarios without a forcing function. "What does this cost us now if we don't solve it?" is the question that keeps the work grounded.

---

### Decision #3: Every feature has to survive a reality check

The check is simple. For any proposed feature, before any design work begins, one question:

> *What manual process does this replace?*

If the answer exists – if there's a human doing something by hand that this feature would automate or improve – the problem is understood well enough to build for. Not necessarily well enough to build the full vision, but well enough to start.

If the answer doesn't exist – if the feature has no manual equivalent because nobody's actually tried to do the thing yet – that's a signal. It means you're about to invest engineering time in a solution to a problem nobody has confirmed is real.

This is not a rule against innovation. Some of the most valuable features don't have precedent. But for operational software, for backend systems, for product work that touches real users in repeatable ways: if you can't do it manually first, you probably don't understand it well enough to automate it well.

The other thing this check does is compress the feedback loop. Running the manual process means you encounter the edge cases, the exception states, the things users actually do versus the things you assumed they'd do. That knowledge is worth more than the engineering time you save by building first and learning later.

---

## The Most Expensive Word in Engineering

It's not a technical term. It appears in planning documents, design reviews, roadmap conversations, and architecture proposals. It sounds responsible. It implies foresight.

The word is *eventually*.

> *Eventually we'll need multi-tenancy.*
> *Eventually we'll need microservices.*
> *Eventually we'll need a proper event-sourcing layer.*
> *Eventually this will need to scale to millions of users.*

"Eventually" is how speculative work gets funded by present-tense credibility. It borrows against an uncertain future using today's engineering capacity as collateral. And the debt is real – it's just invisible until you're trying to change a system that was built for a company you never became.

I've seen teams lose more time to *eventually* than to any incident, any bad hire, any architectural mistake. Because mistakes are visible. "Eventually" hides in the design doc as a feature.

The antidote is specificity. *Eventually* at what scale? By what date? Under what conditions? What do we lose if we defer this? What's the cheapest way to find out whether eventually ever arrives?

---

## Three Levels of Engineering Maturity

I've watched teams approach the same product problem in fundamentally different ways, and the difference usually comes down to which question they're asking.

**Junior teams** ask: *How do we build this?*

They're solving the implementation problem. The solution space is technical: which library, which architecture, which data model. This is valuable – execution matters. But it starts downstream of a decision that may not have been made yet.

**Strong teams** ask: *Should this exist at all?*

They're interrogating the premise before committing to the solution. They've learned that the cost of building the wrong thing exceeds the cost of the delay required to question it. This is where a lot of good product engineering happens.

**Elite teams** ask: *What's the cheapest way to learn whether this should exist?*

They're running the problem through a due diligence filter before anything else. The question reframes the work: instead of starting with implementation, they start with learning. The artifact might be a manual process, a prototype, a five-question user conversation, a spreadsheet. Whatever generates the signal fastest at the lowest cost.

This last mode is genuinely uncomfortable for engineers who are good at building. It can feel like avoidance. But it's the opposite – it's precision. It's focusing engineering effort on things that are confirmed to matter rather than things that seem like they should.

---

## What We Actually Saved

The post-mortem on these decisions usually gets framed as: *we saved six months of engineering work.*

But that framing undersells the actual value and somewhat misses the point.

What we saved was six months of building the wrong thing.

That's different. Engineering time spent on the right problem – even imperfectly – generates learning, surfaces real constraints, builds institutional knowledge. Engineering time spent on the wrong problem generates none of that. It generates code that has to be maintained, migrated around, or deleted. It generates mental overhead. It generates the sunk-cost pressure to defend decisions that shouldn't have been made.

Saving six months of engineering work is a scheduling win. Saving six months of building the wrong thing is a strategic win. The difference is whether what you didn't build would have mattered.

Most of the time, the Hypothetical Future doesn't need to be built. Not because growth doesn't happen, not because scale doesn't come, but because by the time it does, you understand the problem well enough to solve it correctly – and you haven't spent your finite engineering capacity on a version of it that was mostly speculation.

---

## A Closing Thought

The most useful thing a technical leader can do in a planning conversation is not to solve the problem.

It's to establish whether the problem is worth solving, what "solved" would actually look like, and what the cheapest path to finding out is.

That sounds like restraint. In practice, it's the most aggressive possible orientation toward impact: it refuses to let engineering effort dissipate into work that doesn't matter.

The teams I've seen do this consistently – not once, but as a discipline – are the ones where engineering decisions feel coherent months later. Where the architecture makes sense given the company's actual history. Where there's less of the ambient technical debt that comes from building confidently in the wrong direction.

It's a harder discipline than shipping fast. It requires a different kind of ownership – not just of the code, but of the decision behind the code.

But it's where the real leverage is.

---

*If this framing resonates with problems your team is navigating – scaling, architectural decisions under resource pressure, or the relationship between product and engineering velocity – I'm occasionally open to consulting engagements. The best way to start is a [direct conversation](https://t.me/eugene_the_engineer?direct).*
