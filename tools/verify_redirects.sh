#!/usr/bin/env bash
# Verify SEO redirects for eugenetheengineer.com migration.
# Usage: ./tools/verify_redirects.sh

set -euo pipefail

CURL="${CURL:-/usr/bin/curl}"
DOMAIN="https://eugenetheengineer.com"
LEGACY="https://madmatvey.github.io"

check() {
  local label="$1"
  local url="$2"
  local expect="${3:-}"

  echo "=== $label ==="
  echo "URL: $url"
  headers=$("$CURL" -sI -L --max-redirs 5 "$url" 2>&1 | tr -d '\r')
  echo "$headers" | grep -iE '^(HTTP|location)' || true

  if [[ -n "$expect" ]]; then
    if echo "$headers" | grep -qi "$expect"; then
      echo "RESULT: PASS (contains $expect)"
    else
      echo "RESULT: FAIL (expected $expect)"
    fi
  fi
  echo ""
}

check "Legacy date URL (needs Cloudflare 301)" \
  "$DOMAIN/2024/07/16/leadership-hats/" \
  "/posts/leadership-hats"

check "SQL whale legacy date URL" \
  "$DOMAIN/2020/07/03/sql-optimization-or-criminal-tracking/" \
  "/posts/sql-optimization-or-criminal-tracking"

check "Legacy category slug" \
  "$DOMAIN/categories/leadership/" \
  "/categories/engineering-leadership"

check "GitHub Pages domain redirect" \
  "$LEGACY/2020/07/03/sql-optimization-or-criminal-tracking/" \
  "eugenetheengineer.com"

check "Canonical post URL" \
  "$DOMAIN/posts/leadership-hats/" \
  "200"

check "Billing post canonical" \
  "$DOMAIN/posts/your-billing-system-probably-isnt-an-accounting-system/" \
  "200"
