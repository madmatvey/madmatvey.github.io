# Content distribution workflow

Every new post on eugenetheengineer.com should reach at least three channels within **48 hours** of publish. No paid budget — time and consistency only.

## Checklist (per post)

Copy [`docs/distribution-checklist-template.md`](distribution-checklist-template.md) for each publish.

### Before merge — PostgreSQL series posts

Hub links are **automatic** from `categories: [PostgreSQL Performance]` on the scheduled publish date.

Optional curation only:

- [ ] Slug in `_data/clusters.yml` → `PostgreSQL Performance` (`featured` / `problems` / `related` if applicable)
- [ ] `ruby tools/audit_clusters.rb`

Playbook and cluster links appear automatically on the first cron build **after** the post `date`.

### Hour 0 — Publish

- [ ] Post live on eugenetheengineer.com
- [ ] IndexNow fires via GitHub Actions (automatic on deploy)
- [ ] Request indexing in GSC for high-priority posts (Billing, PostgreSQL pillars)

### Hours 0–24

| Channel | Action | Time | Notes |
|---------|--------|------|-------|
| **Telegram** | Short summary + link `?utm_source=telegram&utm_medium=social` | 15 min | [t.me/eugene_the_engineer](https://t.me/eugene_the_engineer) |
| **LinkedIn** | Native post: hook + 3 bullets + link in first comment | 45 min | Tag: Rails, PostgreSQL, or Billing as relevant |
| **DEV.to** | Canonical republish (see below) | 30 min | Only for technical pillars |

### Hours 24–48

| Channel | Action | Time | Notes |
|---------|--------|------|-------|
| **Reddit** | r/rails, r/PostgreSQL, r/programming — follow sub rules | 30 min | Genuine summary, not title-only link |
| **X** | Thread or single post with code snippet image | 15 min | Link to post |
| **Hacker News** | Submit for pillar posts only (billing, PG series) | 15 min | Title = post title, no clickbait |

### Optional (weekly cadence)

- Stack Overflow answers linking to relevant posts (when genuinely helpful)
- GitHub README updates (gasfree_sdk, jekyll-ai-visible-content) for related releases

## DEV.to canonical republish

1. Create article on [DEV.to](https://dev.to)
2. Paste markdown body (or import from GitHub)
3. Set **canonical URL** to `https://eugenetheengineer.com/posts/<slug>/`
4. Tags: `rails`, `postgresql`, `billing`, etc. (max 4)
5. Publish — do not edit canonical after publish

Ready-to-publish draft for SQL whale: [`devto-sql-optimization-republish.md`](devto-sql-optimization-republish.md)

## Reddit guidelines

- Read subreddit rules before posting
- r/rails — production stories, Rails + Postgres
- r/PostgreSQL — EXPLAIN, indexing, performance posts
- r/programming — broader engineering leadership with technical depth
- Engage in comments for 30+ minutes after posting

## LinkedIn format

```
[Hook — one sentence from the post's opening]

What I cover:
• [bullet 1]
• [bullet 2]
• [bullet 3]

Full write-up (link in comments): [title]

#RubyOnRails #PostgreSQL #BackendEngineering
```

Put URL in **first comment**, not post body (better reach).

## Hacker News

- Best candidates: billing cluster, PostgreSQL case studies, staff-engineer technical posts
- Submit Tue–Thu 8–10am US Eastern
- Respond thoughtfully to comments — HN traffic converts when author engages

## Metrics (weekly)

| Metric | Source |
|--------|--------|
| Organic clicks | GSC Performance |
| Referral traffic by channel | GTM / GA via GTM container |
| Telegram joins | `utm_source=telegram` |
| DEV.to views | DEV dashboard |
| Indexed URLs | GSC Pages |

## Do not

- Buy links or use link farms
- Mass-post identical text to 10 subreddits
- Publish on Medium without canonical URL
- Submit every post to HN (burns account credibility)
