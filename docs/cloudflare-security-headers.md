# Cloudflare Security Headers Setup (eugenetheengineer.com)

GitHub Pages does not let you set HTTP response headers from the repository. Because the site is proxied through Cloudflare (`server: cloudflare`), configure the headers below in the Cloudflare dashboard.

## Prerequisites

- Domain `eugenetheengineer.com` is active in Cloudflare
- DNS record for the site is **Proxied** (orange cloud)

## 1. Enable HSTS

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → select **eugenetheengineer.com**
2. Go to **SSL/TLS** → **Edge Certificates**
3. Scroll to **HTTP Strict Transport Security (HSTS)**
4. Click **Enable HSTS**
5. Recommended settings:
   - **Max Age**: `12 months` (31536000 seconds)
   - **Include subdomains**: ON
   - **Preload**: ON (only after confirming HTTPS works everywhere)
   - **No-Sniff header**: ON (can also be set separately below)
6. Save and confirm the warning dialog

Expected header:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## 2. Add X-Content-Type-Options

1. Go to **Rules** → **Transform Rules** → **Modify Response Header**
2. Click **Create rule**
3. Rule name: `Security - X-Content-Type-Options`
4. **When incoming requests match**: `Hostname equals eugenetheengineer.com`
5. **Then** → **Set static**:
   - Header name: `X-Content-Type-Options`
   - Value: `nosniff`
6. Deploy

## 3. Add Content-Security-Policy (phased rollout)

Start in report-only mode to avoid breaking ads, Disqus, fonts, or analytics.

### Phase A — Report Only

1. **Rules** → **Transform Rules** → **Modify Response Header**
2. Create rule: `Security - CSP Report Only`
3. Match: `Hostname equals eugenetheengineer.com`
4. Set header:

```text
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://cdn.jsdelivr.net https://platform.twitter.com https://pagead2.googlesyndication.com https://*.disqus.com https://*.disquscdn.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com https://cloudflareinsights.com https://*.disqus.com; frame-src https://googleads.g.doubleclick.net https://*.disqus.com; object-src 'none'; base-uri 'self'; form-action 'self'
```

5. Deploy and browse the site for 24–48 hours. Check browser console for CSP violations.

### Phase B — Enforce

1. Duplicate the rule as `Security - CSP Enforce`
2. Change header name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
3. Disable or delete the report-only rule after no critical violations remain

## 4. Optional performance hardening

For transient `Timeout` / slow TTFB on static assets (e.g. `crypto-donations.css`):

1. **Caching** → **Cache Rules**
2. Create rule for `URI Path contains /assets/`
3. Cache eligibility: **Eligible for cache**
4. Edge TTL: respect origin or set `1 month` for fingerprinted/static assets

## 5. Verification

After deployment, verify headers:

```bash
curl -sI https://eugenetheengineer.com/ | grep -iE 'strict-transport|content-type-options|content-security-policy'
```

Re-run SEOnaut crawl. Expected fixes:

- Missing HSTS header (382)
- Missing X-Content-Type-Options (302)
- Missing CSP (302)

## Notes

- **LinkedIn 999 responses** to bots are expected; not fixable from your site.
- **`feed.xml` media type** (`text/xml` vs `application/xml`) is controlled by GitHub Pages and is a low-priority false positive.
- **Underscores in asset filenames** are cosmetic; avoid underscores in new assets only.
