#!/usr/bin/env bash
# Verify redirect behavior for eugenetheengineer.com migration.
# Usage: ./tools/verify_redirects.sh

set -euo pipefail

check() {
  local label="$1"
  local url="$2"
  echo "=== $label ==="
  curl -sI "$url" | tr -d '\r' | grep -iE '^(HTTP|location)' || true
  echo
}

echo "# Redirect verification — $(date -u +%Y-%m-%dT%H:%MZ)"
echo

check "madmatvey.github.io date URL" \
  "https://madmatvey.github.io/2020/07/03/sql-optimization-or-criminal-tracking/"

check "eugenetheengineer.com date URL (expect 301 → /posts/)" \
  "https://eugenetheengineer.com/2024/07/16/leadership-hats/"

check "eugenetheengineer.com legacy date URL" \
  "https://eugenetheengineer.com/2020/07/03/sql-optimization-or-criminal-tracking/"

check "eugenetheengineer.com /posts/ permalink" \
  "https://eugenetheengineer.com/posts/leadership-hats/"

check "legacy category /categories/leadership/" \
  "https://eugenetheengineer.com/categories/leadership/"

check "new category /categories/engineering-leadership/" \
  "https://eugenetheengineer.com/categories/engineering-leadership/"

check "cluster hub /postgresql-performance-playbook/" \
  "https://eugenetheengineer.com/postgresql-performance-playbook/"

check "cluster hub /billing-systems-for-rails-engineers/" \
  "https://eugenetheengineer.com/billing-systems-for-rails-engineers/"
