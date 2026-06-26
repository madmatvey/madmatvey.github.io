# Redirect verification results

Verified: 2026-06-26 via `tools/verify_redirects.sh`

## Summary

| Check | Status | Action |
|-------|--------|--------|
| `madmatvey.github.io` → `eugenetheengineer.com` | **PASS** (301) | Optional: ensure target is `https://` not `http://` |
| Date-based URLs `/YYYY/MM/DD/slug/` → `/posts/slug/` | **PARTIAL** | `sql-optimization` date URL → 301 → `/posts/` **PASS**; `leadership-hats` date URL still **200** at old path |
| Legacy category slugs → new taxonomy | **PASS** (301) | `/categories/leadership/` → `/categories/engineering-leadership/` |
| New permalinks `/posts/:slug/` | **PASS** (200) | — |
| Cluster hub `/postgresql-performance-playbook/` | **PASS** (200) | — |
| Cluster hub `/billing-systems-for-rails-engineers/` | **PENDING** (404 on prod) | Deploy cluster hub changes |

Jekyll `redirect_from` serves content at legacy paths with HTTP 200 (meta refresh), not 301. **Cloudflare edge 301 rules** are still required for remaining date URLs — see [cloudflare-redirect-rules.md](cloudflare-redirect-rules.md).

## Sample results (2026-06-26)

```
madmatvey.github.io/2020/07/03/sql-optimization-or-criminal-tracking/
  → 301 → http://eugenetheengineer.com/2020/07/03/sql-optimization-or-criminal-tracking/

eugenetheengineer.com/2020/07/03/sql-optimization-or-criminal-tracking/
  → 301 → https://eugenetheengineer.com/posts/sql-optimization-or-criminal-tracking/  (IMPROVED)

eugenetheengineer.com/2024/07/16/leadership-hats/
  → 200 (should be 301 → /posts/leadership-hats/)

eugenetheengineer.com/categories/leadership/
  → 301 → https://eugenetheengineer.com/categories/engineering-leadership/  (IMPROVED)

eugenetheengineer.com/postgresql-performance-playbook/
  → 200

eugenetheengineer.com/billing-systems-for-rails-engineers/
  → 404 (not yet deployed)
```

## Re-run

```bash
./tools/verify_redirects.sh
```

After applying Cloudflare rules, all date URLs should end at `/posts/<slug>/` with HTTP 200.
