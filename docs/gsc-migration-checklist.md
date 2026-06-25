# Google Search Console — post-migration checklist

After deploying category, redirect, and SEO changes on `eugenetheengineer.com`.

## 1. Change of address (if not done)

1. [Google Search Console](https://search.google.com/search-console)
2. Select property **madmatvey.github.io**
3. **Settings** → **Change of address**
4. Select new site: **eugenetheengineer.com**
5. Complete validation steps

## 2. Verify redirects

Export top URLs from **madmatvey.github.io** property → **Pages** (last 28 days).

For each URL, run:

```bash
URL="/posts/leadership-hats/"  # example
curl -sI "https://madmatvey.github.io${URL}" | tr -d '\r' | grep -iE '^(HTTP|location)'
curl -sI "https://eugenetheengineer.com${URL}" | tr -d '\r' | head -1
```

For legacy date URLs:

```bash
curl -sI "https://eugenetheengineer.com/2024/07/16/leadership-hats/" | tr -d '\r' | grep -iE '^(HTTP|location)'
```

**Pass criteria:** final URL is `/posts/<slug>/` with HTTP 200.

If date URLs still 404, apply [cloudflare-redirect-rules.md](cloudflare-redirect-rules.md).

Record results in [redirect-verification-results.md](redirect-verification-results.md). Re-run: `./tools/verify_redirects.sh`

## 3. Submit sitemap

On **eugenetheengineer.com** property:

1. **Sitemaps** → add `https://eugenetheengineer.com/sitemap.xml`
2. Request indexing for homepage after title/description change

IndexNow runs automatically on deploy via GitHub Actions.

## 4. Monitor (2–4 weeks)

| Report | Watch for |
|--------|-----------|
| **Pages** → Not indexed | Spike in 404s on old paths |
| **Pages** → Indexed | New `/posts/` URLs appearing |
| **Performance** | CTR change on homepage queries |
| **Core Web Vitals** | No regression after Giscus swap |

## 5. Disqus → Giscus

- Old Disqus threads are not migrated
- Export from [Disqus Admin](https://disqus.com/admin/) if archival is needed
- Optional: one-time note on high-traffic posts that comments moved to GitHub Discussions

## 6. Category migration

Confirm `/categories/` shows:

- Backend Engineering
- PostgreSQL Performance
- Architecture
- Engineering Leadership
- Billing & Fintech
- Personal

Old category URLs should 301 per Cloudflare rules (see `docs/cloudflare-redirect-rules.md`).
