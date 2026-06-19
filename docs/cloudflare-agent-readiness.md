# Cloudflare Agent Readiness (eugenetheengineer.com)

GitHub Pages cannot set custom response headers or serve `/.well-known/*` with correct MIME types. This site uses a **Cloudflare Worker** on the Free plan to implement agent discovery and Markdown content negotiation at the edge.

## What is enabled

| Feature | Standard | Implementation |
| --- | --- | --- |
| Markdown for Agents | `Accept: text/markdown` | Worker + Workers AI `toMarkdown()` |
| Link headers (RFC 8288) | `Link` on HTML responses | Worker |
| API catalog (RFC 9727) | `/.well-known/api-catalog` | Worker (`application/linkset+json`) |
| Agent skills index | `/.well-known/agent-skills/index.json` | Worker |
| DNS-AID (draft) | `_index._agents` SVCB/HTTPS | Cloudflare DNS (manual) |

**Not enabled** (no backend APIs): OAuth/OIDC discovery (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`) and `/auth.md`. Add these when a real API and identity provider exist.

## Prerequisites

- Domain `eugenetheengineer.com` is active in Cloudflare (Free plan is sufficient)
- DNS record for the site is **Proxied** (orange cloud)
- Workers enabled for the zone
- GitHub secret `CLOUDFLARE_API_TOKEN` with **Workers Scripts Edit**, **Workers Routes Edit**, and **Workers AI** permissions (for CI deploy)

## 1. Deploy the Worker

### Option A — GitHub Actions (recommended)

Push changes under `worker/` to `master`. The workflow [`.github/workflows/cloudflare-worker.yml`](../.github/workflows/cloudflare-worker.yml) runs `wrangler deploy`.

### Option B — Local deploy

```bash
cd worker
npm ci
npx wrangler login
npm run deploy
```

Worker source: [`worker/`](../worker/). Route: `eugenetheengineer.com/*`.

### Verify the route is active

After deploy, this must return `application/linkset+json` (not HTML 404):

```bash
curl -sI https://eugenetheengineer.com/.well-known/api-catalog | grep -i content-type
```

If you still get `text/html` and 404, the route is missing — see [Add route in dashboard](#add-route-in-dashboard) below.

### Add route in dashboard

Cloudflare renamed the UI: there is no **Triggers** tab anymore. Per [Workers Routes docs](https://developers.cloudflare.com/workers/configuration/routing/routes/):

**Path A — from the Worker (recommended)**

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Open **eugenetheengineer-agent-readiness**
3. **Settings** → **Domains & Routes**
4. **Add** → **Route**
5. Zone: `eugenetheengineer.com`
6. Route: `eugenetheengineer.com/*`
7. **Add route**

**Path B — from the zone (legacy)**

1. Select zone **eugenetheengineer.com**
2. **Workers Routes** (sidebar under *Workers* or *Compute*)
3. **Add route**
4. Route: `eugenetheengineer.com/*`
5. Worker: `eugenetheengineer-agent-readiness`

Prerequisites: DNS record for `eugenetheengineer.com` must be **Proxied** (orange cloud).

`wrangler.toml` must use `[[routes]]` table syntax (not inline `routes = [...]`):

```toml
[[routes]]
pattern = "eugenetheengineer.com/*"
zone_name = "eugenetheengineer.com"
```

Then redeploy: `cd worker && npm run deploy`.

## 2. Markdown for Agents

Agents request any HTML page with:

```http
Accept: text/markdown
```

The Worker fetches HTML from GitHub Pages origin (with `Accept: text/html` to avoid recursion), converts via Workers AI, and returns:

```http
Content-Type: text/markdown; charset=utf-8
Vary: Accept
x-markdown-tokens: <estimated tokens>
```

Example:

```bash
curl -sI https://eugenetheengineer.com/ -H "Accept: text/markdown" \
  | grep -iE 'content-type|x-markdown-tokens|vary'

curl -s https://eugenetheengineer.com/ -H "Accept: text/markdown" | head -40
```

Browsers without the header still receive `text/html`.

**Limits:** HTML only; responses over 2 MB are not converted. Workers AI free tier: ~10k Neurons/day.

## 3. Link headers (RFC 8288)

HTML responses include:

```http
Link: <https://eugenetheengineer.com/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json", <https://eugenetheengineer.com/.well-known/agent-skills/index.json>; rel="describedby"; type="application/json", <https://eugenetheengineer.com/feed.xml>; rel="alternate"; type="application/atom+xml"
```

Verify:

```bash
curl -sI https://eugenetheengineer.com/ | grep -i '^link:'
```

## 4. API catalog (RFC 9727)

```bash
curl -s https://eugenetheengineer.com/.well-known/api-catalog | jq .
curl -sI https://eugenetheengineer.com/.well-known/api-catalog | grep -i content-type
```

Expected `Content-Type: application/linkset+json`. The minimal catalog points to the blog homepage (`service-doc`), agent skills index (`describedby`), Atom feed, and sitemap.

## 5. Agent skills index

```bash
curl -s https://eugenetheengineer.com/.well-known/agent-skills/index.json | jq .
curl -s https://eugenetheengineer.com/.well-known/agent-skills/markdown-negotiation/SKILL.md | head
```

Skills are defined in [`worker/src/skills.js`](../worker/src/skills.js). SHA-256 digests are computed at runtime from the bundled `SKILL.md` content.

## 6. DNS-AID (DNS for AI Discovery, draft)

Optional experimental discovery via DNS. Configure in the Cloudflare dashboard:

1. **DNS** → **Records** → **Add record**
2. Type: **HTTPS** (SVCB ServiceMode)
3. Name: `_index._agents`
4. Priority: `1`
5. Target: `eugenetheengineer.com` (or `.` for same origin)
6. Add parameters as supported by the dashboard (e.g. `alpn=h2`, path to `/.well-known/api-catalog` if an `endpoint` field is available)

Repeat for `_a2a._agents` if you later expose an A2A endpoint.

### Enable DNSSEC

1. **DNS** → **Settings** → **DNSSEC**
2. Click **Enable DNSSEC**
3. Add DS records at your registrar if Cloudflare is not the registrar

Verify:

```bash
dig +short HTTPS _index._agents.eugenetheengineer.com
dig +dnssec eugenetheengineer.com SOA | grep -i 'ad\|RRSIG'
```

## 7. Full verification checklist

```bash
# Markdown negotiation
curl -sI https://eugenetheengineer.com/ -H "Accept: text/markdown" | grep -iE 'content-type|x-markdown-tokens|vary'

# Link headers
curl -sI https://eugenetheengineer.com/ | grep -i '^link:'

# API catalog
curl -s https://eugenetheengineer.com/.well-known/api-catalog | jq .
curl -sI https://eugenetheengineer.com/.well-known/api-catalog | grep -i content-type

# Agent skills
curl -s https://eugenetheengineer.com/.well-known/agent-skills/index.json | jq .

# Browser default unchanged
curl -sI https://eugenetheengineer.com/ | grep -i content-type
```

## Notes

- The Worker runs on every request to `eugenetheengineer.com/*` (including HTML passthrough). Free tier: 100k requests/day.
- Native Cloudflare “Markdown for Agents” (zone setting `content_converter`) requires Pro+; this Worker is the Free-plan equivalent.
- See also [cloudflare-security-headers.md](cloudflare-security-headers.md) for HSTS, CSP, and other edge headers.
