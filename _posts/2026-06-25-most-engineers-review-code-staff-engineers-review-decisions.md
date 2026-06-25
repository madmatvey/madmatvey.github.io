---
layout: post
redirect_from:
  - /2026/06/25/most-engineers-review-code-staff-engineers-review-decisions/
  - /2026/06/25/most-engineers-review-code-staff-engineers-review-decisions.html
title: "Most Engineers Review Code. Staff Engineers Review Decisions."
date: 2026-06-25 14:42:00 +0400
last_modified_at: 2026-06-25
description: "Code review isn't about polishing the diff. It's about what merging does to the codebase – five questions, fewer comments, and where AI fits the mechanical layer."
tags: [code review, engineering leadership, staff engineer, fractional cto, software architecture, ai-assisted development, opencode, engineering culture, decision making, pull requests, technical leadership]
author: eugene
categories: [Backend Engineering]
comments: true
pin: false
render_with_liquid: false
image:
    path: /assets/img/most-engineers-review-code-staff-engineers-review-decisions.png
    alt: "Review the decision – code diff vs system architecture"
---

*People ask me how I run code reviews that engineers actually appreciate. They expect an answer about tone.*

---

## That's not the mechanism.

Engineers don't appreciate a review because it's polite. They appreciate it because it doesn't waste their time on things that don't matter, and it catches the thing that would have mattered in six months. Tone is a side effect of that. It's not the mechanism.

The mechanism is where you point your attention.

I learned this the hard way at [Appbooster](https://appbooster.com), on a high-load Rails product where I spent years being the person who could find the slow query and ship the patch. My reviews were thorough. They were detailed. Engineers read them carefully.

And then we'd have an incident six months later on code I'd approved – because I'd optimized the diff in front of me while missing the decision buried inside it. I wrote about the same pattern-matching instinct in a different context in [Stop Reading EXPLAIN ANALYZE](/posts/stop-reading-explain-analyze-start-cross-examining-it/): I knew the vocabulary, I commented on the operators, and I missed what the evidence was actually saying. Code review had the same blind spot. I was reading lines. I wasn't reading consequences.

The shift that changed my reviews wasn't a communication framework. It was a reframe about what the review is *for*.

---

## The diff is not the thing you're reviewing

Most reviews operate at the level of the diff. You can tell, because the comments all sound the same:

> "This loop can be simplified."
>
> "Naming could be better here."
>
> "Extract this into a method."

None of these are wrong. All of them are also beside the point. They optimize the patch in front of you while the codebase around it keeps getting worse, one approved PR at a time. The code gets cleaner. The architecture doesn't.

The reframe I work from:

**The goal of code review is not to improve the pull request. The goal is to improve the codebase.**

Those sound similar. They're not.

A PR-level review asks "is this diff good." A codebase-level review asks "what does merging this diff do to the system I'm responsible for." The first question is about a few hundred lines. The second is about every future PR that will pattern-match against this one.

This is the same ownership shift I described in [From Senior Engineer to CTO](/posts/from-senior-engineer-to-cto-the-real-skill-gap-isnt-technical/) – the moment when your career stops being limited by execution and starts being limited by consequences. Code review is one of the few places that shift becomes visible every single day. A senior engineer reviews the implementation. A staff engineer reviews the decision the implementation encodes.

---

## The worst comment in code review

If I had to name the single most common failure mode in reviews I read from other people, it's some version of:

> "This isn't how I would have done it."

That's not a review comment. It's a taste statement wearing a review comment's clothes. It doesn't identify a bug, a risk, a maintenance cost, or a violated constraint – it identifies a stylistic disagreement and presents it with the authority of a technical objection.

The tell is simple: if you can't articulate what concretely gets worse because of the choice – not "I prefer X," but "X causes Y under conditions Z" – you don't have a review comment. You have a preference. Preferences are fine to share. They're not fine to gate a merge on, and they're definitely not fine to dress up as architecture concerns.

I still catch myself writing these. The habit dies slowly. The fix isn't "be nicer." It's forcing yourself to finish the sentence: *what breaks, for whom, and when?* If you can't finish it, delete the comment or downgrade it to a non-blocking note.

---

## The five questions I actually ask

When I open a PR, I don't ask "is this code good." That question is too small and too subjective to be useful. I ask five narrower ones.

**1. System impact.** Does this change reduce complexity or add to it? Does it introduce a new pattern, or extend an existing one? If it's new, am I comfortable seeing this pattern repeated fifty times across the codebase – because it will be.

**2. Maintenance cost.** Who inherits this decision a year from now, and what does it cost them? A lot of PRs look excellent right up until the first incident that depends on understanding the part nobody asked about during review. I've lived through that on a [250ms Postgres query](/posts/how-we-reduced-postgresql-query-time-from-250ms-to-20ms/) that passed every local check until production traffic told a different story.

**3. Knowledge transfer.** Does the team learn something from this merge, or does the knowledge stay locked in one person's head? Review is one of the few structural mechanisms an engineering org has for spreading context. If every review is purely gatekeeping, you're wasting that mechanism.

**4. Future optionality.** Does this change open doors or close them? Some perfectly correct PRs quietly foreclose three reasonable architectural directions for no real benefit. That's a cost even when nothing is "wrong" with the code. It's the engineering version of *eventually* – the word I wrote about in [The Biggest Engineering Wins Were Things We Didn't Build](/posts/the-biggest-engineering-wins-were-things-we-didnt-build/) – borrowed against a future the team may never need.

**5. Problem-solution alignment.** Is this actually solving the stated problem, or just producing code that looks like a solution? Plenty of PRs pass every other check and still don't address the thing that was supposed to get fixed.

None of these five questions are about syntax, style, or "could this be cleaner." They're about what happens to the system after the diff lands. That's the level a staff engineer reviews at, and it's also – not coincidentally – the level that makes engineers feel like their work was actually understood rather than nitpicked.

---

## Fewer comments is usually the better signal

There's a pattern I've noticed across review styles: the review with the most comments is rarely the most valuable one.

A junior-leaning review on a moderately complex PR might generate a dozen-plus comments – half of them legitimate, half of them formatting and naming preferences mixed in at the same visual weight as the real issues. The author has to triage your review before they can act on it.

A senior review on the same PR might leave two comments. But those two comments are the ones that prevent a production incident or a six-month refactor. Comment count isn't a proxy for review quality – and treating it as one is exactly why so many reviews feel exhausting to receive without feeling useful.

If your review consistently runs long, it's worth asking whether you're finding more problems, or whether you've stopped distinguishing "wrong" from "not how I'd write it."

I see the same trap in technical leadership: new leads stay in every PR because the Architect Hat is comfortable. I wrote about that incentive structure in [The Hat Technical Leaders Refuse to Wear](/posts/the-hat-technical-leaders-refuse-to-wear/). Reviewing every line feels like leadership. Often it's the opposite – it's avoiding the harder work of setting review standards the team can run without you.

---

## Where I've started letting AI carry the mechanical layer

The five questions above are judgment calls. They don't fully delegate to a tool. But a meaningful chunk of what happens *before* you get to apply that judgment – checking the PR description against the actual diff, scanning for N+1 patterns, missing test coverage, unhandled edge cases, inconsistent naming against the codebase's own conventions – is mechanical enough that it's a good fit for AI-assisted review.

That's the same split I argued for in [The AI Model Is No Longer The Bottleneck](/posts/the-ai-model-is-no-longer-the-bottleneck/): the model is replaceable, the workflow isn't. Review is a workflow problem now. When I shifted from writing code to [guiding an AI junior](/posts/ai-junior/) through tasks, the bottleneck moved to review overnight – not because the generated code was bad, but because I needed a repeatable way to separate "inventory the diff" from "judge whether this decision scales."

Lately I've been using the [`staff-engineer-review` skill](https://github.com/TheArchitectit/awesome-opencode-skills/tree/master/staff-engineer-review) from the [awesome-opencode-skills](https://github.com/TheArchitectit/awesome-opencode-skills#development--code-tools) collection – the same ecosystem I contribute to in the Security & Systems section. It's structured around a workflow that maps closely to how I already think about review, which is exactly why it's worth discussing rather than just using quietly:

- It starts by comparing the PR description (the stated plan) against the actual diff, and flags each planned item as done, partial, missing, or extra – before it even gets to code quality.
- It runs a dedicated architectural pass: separation of concerns, coupling and cohesion, consistency with existing patterns, and explicit flags for overengineering, underengineering, and hidden complexity.
- It separates correctness and risk (logic errors, race conditions, missing validation, security exposure) from performance concerns (N+1s, missing indexes, blocking calls in hot paths) and from test coverage – instead of dumping all of it into one undifferentiated comment list.
- The output format forces an alignment score, a risk level, and a plan-vs-reality table rather than a wall of prose, which is the same complaint I have about most human-written reviews.

What this gets right: it operationalizes a chunk of questions 1, 2, and 5 from my list above – system impact (via the architecture pass), maintenance cost (via hidden complexity and pattern-consistency checks), and problem-solution alignment (via the plan-vs-implementation comparison) – as a repeatable checklist instead of something that depends on the reviewer remembering to ask.

What it doesn't replace: it can tell you a pattern is inconsistent with the codebase. It can't tell you whether that inconsistency is a mistake or the first instance of a deliberate migration the team agreed on last quarter. It can flag "future optionality" as a category, but it can't actually weigh which future you should be optimizing for – that depends on context the model doesn't have and, frankly, that most reviewers only get from sitting in the planning meetings, not from reading the diff.

This is the same boundary I draw in [AI Won't Replace Your Architectural Thinking](/posts/ai-assited-coding-statement/): decomposition and task clarity are yours. The tool handles the leaves. You keep ownership of the trunk and the roots.

So the split I've landed on: let the tool own the inventory – what changed, what's missing, what's risky, what's untested. Keep the judgment calls – is this the right problem, is this pattern one we want to scale, what does this cost the team in a year – as the part that still requires a human who's accountable for the system, not just the PR.

---

## The open question

Here's the part I'd actually like to argue about: how much of "system impact" and "future optionality" is genuinely irreducible to a checklist, versus how much of it is just context a tool hasn't been given yet – team history, prior incidents, the unwritten reasons a pattern was banned two years ago?

If you've run AI-assisted review against a codebase with real history behind it, where did it hold up, and where did it confidently flag the wrong thing because it didn't know what it didn't know?

---

*If you're building out review practices for a growing engineering org – or trying to figure out which parts of that process can responsibly move to AI-assisted tooling and which can't – that's the kind of system-level problem I work on with engineering teams as a fractional CTO. [Happy to compare notes](https://www.linkedin.com/in/eugeneleontev).*
