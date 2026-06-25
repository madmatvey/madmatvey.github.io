# Redirect verification results

Verified: 2026-06-25 via `tools/verify_redirects.sh`

## Summary

| Check | Status | Action |
|-------|--------|--------|
| `madmatvey.github.io` → `eugenetheengineer.com` | **PASS** (301) | Optional: ensure target is `https://` not `http://` |
| Date-based URLs `/YYYY/MM/DD/slug/` → `/posts/slug/` | **FAIL** (200 at old path) | Apply [cloudflare-redirect-rules.md](cloudflare-redirect-rules.md) |
| Legacy category slugs → new taxonomy | **FAIL** (404 on `/categories/leadership/`) | Apply Cloudflare category redirect rules |
| New permalinks `/posts/:slug/` | **PASS** (200) | — |

Jekyll `redirect_from` serves content at legacy paths with HTTP 200 (meta refresh), not 301. **Cloudflare edge 301 rules are required** to pass link equity to `/posts/` URLs.

## Sample results

```
madmatvey.github.io/2020/07/03/sql-optimization-or-criminal-tracking/
  → 301 → http://eugenetheengineer.com/2020/07/03/sql-optimization-or-criminal-tracking/

eugenetheengineer.com/2024/07/16/leadership-hats/
  → 200 (should be 301 → /posts/leadership-hats/)

eugenetheengineer.com/2020/07/03/sql-optimization-or-criminal-tracking/
  → 200 (should be 301 → /posts/sql-optimization-or-criminal-tracking/)

eugenetheengineer.com/categories/leadership/
  → 404 (should be 301 → /categories/engineering-leadership/)
```

## Re-run

```bash
./tools/verify_redirects.sh
```

After applying Cloudflare rules, all date URLs should end at `/posts/<slug>/` with HTTP 200.
