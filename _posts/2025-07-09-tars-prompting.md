---
layout: post
title: "How to Formulate Prompts in Cursor: The TARS Technique"
description: "Learn how to formulate prompts in Cursor using the TARS technique (Task, Assumptions, Requirements, Specification) to get more accurate and helpful results."
tags: [ruby developer, ai, tars, prompting, cursor, development, programming, productivity, innovation, tech, tech blog, software development]
author: eugene
categories: [Tutorial, AI]
comments : True
pin: false
render_with_liquid: false
image:
    path: /assets/img/tars/TARS-Technique-for-AI-Prompts.png
    alt: "TARS technique diagram for formulating AI prompts in Cursor"
---

## How to Formulate Prompts in Cursor: The TARS Technique (Task, Assumptions, Requirements, Specification)

> **TARS** is a simple yet powerful technique that helps developers accurately formulate requests to AI in the Cursor editor and get results that are actually helpful rather than needing rework.
> TARS stands for **Task, Assumptions, Requirements, Specification**.

In this article, I’ll show you how to use this approach to formulate effective, predictable, and reproducible prompts when developing in Ruby (and beyond).

---

## 📌 Why Is This Important?

In AI tools like Cursor, the model doesn’t “read your mind.” The more precisely we explain the context of a task, the better the result.

But in real development, time is limited and tasks are often messy. That’s where TARS comes in: it helps structure a prompt so that the model can "think like an engineer."

---

## 🔧 Components of the TARS Technique

### 1. **Task**

Formulate what exactly you want the model to produce. As if you were explaining the task to a teammate.
**Bad:** "make it nice"
**Good:** "optimize this SQL query to run faster on a 10 million row table"

> 💡 It’s better to frame the task as action + result.

---

### 2. **Assumptions**

Set the boundaries of the task: what’s already in place, which technologies are used, what can be ignored.
This helps the model avoid guessing and focus properly.

**Examples:**

* “This is Rails 7, Postgres 15, Rubocop is already configured”
* “You can use ActiveRecord but not raw SQL”
* “Input data is always valid, edge cases not considered”

---

### 3. **Requirements**

Clear constraints or goals for the output.
What is critical, and what is optional? What must **not** be done?

**Examples:**

* “Code must pass existing tests”
* “Do not include third-party gems”
* “Maintain readability and follow the project’s style guide”

---

### 4. **Specification**

Output format, structure, style — how should the result look?

**Examples:**

* “Answer in the form of a single Ruby method, no explanations”
* “Format as a comment for a Pull Request”
* “Return a Markdown document with sections: Context, Code, Test”

---

## 🧠 Prompt Example Using TARS

Let’s say you want AI to help optimize a background task in Sidekiq.

Here’s how the prompt might look:

---

```
TASK:
Optimize the background task for sending notifications, which slows down under a load of more than 10k jobs.

ASSUMPTIONS:
- The app runs on Ruby on Rails 7
- Using Sidekiq + Redis
- Notifications are sent via HTTP using Faraday
- Retry logic is already implemented
- Database is PostgreSQL 15

REQUIREMENTS:
- No message loss allowed
- Performance must scale across worker nodes
- No third-party gems
- Tests must not break

SPECIFICATION:
Response should be a single method `NotificationSender.perform`, followed by an explanation of the architectural decisions.
```

---

## ✅ What Does the TARS Approach Give You?

* **Fewer follow-up questions.** The model understands the task immediately and doesn’t drift into “fantasy mode.”
* **Better code quality.** Responses are closer to production-level.
* **Documentability.** This kind of prompt can be saved to `.cursor/prompts` as part of the project’s history.
* **Transferability.** You can hand it off to another developer — and they’ll instantly be in the loop.

---

## 💡 Tips for Use in Cursor

* Use **`ask` mode** to clarify a single aspect (e.g. rephrase a part of the condition)
* Use **`agent`** if you want a full implementation, especially with a detailed specification
* **Background** mode is handy for checking assumptions and spotting weak spots in the idea
* For PR discussions — simply paste the entire TARS block into the commit comment

---

## 📎 Template

You can use this template in `.cursor/prompts/tars_template.md`:

```md
TASK:

ASSUMPTIONS:

REQUIREMENTS:

SPECIFICATION:
```

---

## 🏁 Conclusion

The TARS technique is not bureaucracy — it’s a way to think clearly and formulate AI requests in a way that makes them maximally useful. Try using it in combination with Cursor, and you’ll notice a clear improvement in result quality.
