# Cloudflare Redirect Rules (eugenetheengineer.com)

GitHub Pages redirects `madmatvey.github.io` → `eugenetheengineer.com` at the domain level. These rules fix paths that would otherwise 404 after the permalink migration from `/:year/:month/:day/:slug/` to `/posts/:slug/`.

Configure in [Cloudflare Dashboard](https://dash.cloudflare.com) → **eugenetheengineer.com** → **Rules** → **Redirect Rules**.

## 1. Legacy post URLs (date-based permalinks)

**Rule name:** `Legacy post date URLs → /posts/slug`

**When incoming requests match** (Expression Editor):

```txt
(http.host eq "eugenetheengineer.com" and http.request.uri.path matches "^/[0-9]{4}/[0-9]{2}/[0-9]{2}/[^/]+/?$")
```

**Then:** Dynamic redirect

- **Type:** Static
- **URL:** `concat("/posts/", regex_replace(http.request.uri.path, "^/[0-9]{4}/[0-9]{2}/[0-9]{2}/([^/.]+)(\\.html)?/?$", "${1}"), "/")`
- **Status code:** `301`

If the dynamic expression UI is unavailable, use **Bulk Redirects** with a CSV or add two simpler rules:

| Source path | Target | Status |
|-------------|--------|--------|
| `/:year/:month/:day/:slug/` | `/posts/:slug/` | 301 |
| `/:year/:month/:day/:slug.html` | `/posts/:slug/` | 301 |

> **Note:** Jekyll `redirect_from` stubs also exist per post as a fallback (client-side redirect). Cloudflare 301 is preferred for SEO.

## 2. Legacy category URLs (after taxonomy migration)

**Rule name:** `Legacy category slugs`

Add one redirect rule per row (Static redirect, 301):

| Source | Target |
|--------|--------|
| `/categories/leadership/` | `/categories/engineering-leadership/` |
| `/categories/tutorial/` | `/categories/postgresql-performance/` |
| `/categories/engineering/` | `/categories/backend-engineering/` |
| `/categories/read-this/` | `/categories/engineering-leadership/` |
| `/categories/personal/` | `/categories/personal/` |
| `/categories/self-knowledge/` | `/categories/personal/` |
| `/categories/ai/` | `/categories/backend-engineering/` |
| `/categories/product/` | `/categories/architecture/` |
| `/categories/career/` | `/categories/engineering-leadership/` |
| `/categories/cybersecurity/` | `/categories/personal/` |

## 3. Verification

```bash
# Date-based URL should end at /posts/slug/ with HTTP 200
curl -sI "https://eugenetheengineer.com/2024/07/16/leadership-hats/" | head -5
curl -sI "https://madmatvey.github.io/2024/07/16/leadership-hats/" | head -5

# Category redirect
curl -sI "https://eugenetheengineer.com/categories/leadership/" | head -5
```

Expected after rules are live:

1. `madmatvey.github.io` → `eugenetheengineer.com` (301, GitHub Pages)
2. Date path → `/posts/leadership-hats/` (301, Cloudflare)
3. Final page HTTP 200

## 4. HTTPS

Enable **SSL/TLS** → **Edge Certificates** → **Always Use HTTPS** so GitHub Pages redirects to `http://eugenetheengineer.com` are upgraded immediately.
