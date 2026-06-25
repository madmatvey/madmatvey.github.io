# Google Tag Manager — remove AdSense (manual step)

AdSense was removed from the site source (`_includes/head.html`, `ads.txt`). Ads may still load if tags remain active in GTM.

## Steps

1. Open [Google Tag Manager](https://tagmanager.google.com/) → container **GTM-58QNXPRJ**
2. **Tags** → pause or delete:
   - Google AdSense / Auto ads
   - Any display or monetization tags
   - Third-party ad networks
3. Keep active (production only via `JEKYLL_ENV=production`):
   - GA4 configuration
   - PostHog (if configured in GTM)
   - Custom event tags for `article_view`, `article_complete_read`, etc.
4. **Submit** → **Publish** the container version
5. Verify on https://eugenetheengineer.com — no ad iframes, no `googlesyndication.com` requests in Network tab

## Local development

`bundle exec jekyll s` runs with `JEKYLL_ENV=development` — GTM does not load. Use `tools/run -p` to preview production analytics locally.
