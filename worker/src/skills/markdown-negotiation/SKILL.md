# Markdown Negotiation

This site supports content negotiation for AI agents and crawlers.

## Capability

Any HTML page on `https://eugenetheengineer.com` can be requested as Markdown by sending:

```http
Accept: text/markdown
```

## Example

```bash
curl -s https://eugenetheengineer.com/ -H "Accept: text/markdown"
```

## Response headers

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`
- `x-markdown-tokens` — estimated token count of the Markdown body (when available)

## Discovery

- API catalog: `/.well-known/api-catalog`
- Agent skills index: `/.well-known/agent-skills/index.json`
- Atom feed: `/feed.xml`

## Notes

- HTML remains the default for browsers (no `Accept: text/markdown` header).
- Only HTML responses are converted; other content types are returned unchanged.
- Responses larger than 2 MB are not converted.
