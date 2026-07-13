#!/usr/bin/env bash
# Live API smoke test for transaction filters (login + real DB).
#
# Usage:
#   cd server
#   EMAIL=you@example.com PASSWORD='yourpass' ./scripts/curl_test_transaction_filters.sh
#
# Optional:
#   BASE_URL=http://127.0.0.1:8000
#   ACCESS_TOKEN=...   # skip login if you already have a token
#
# Admin routes need an admin account. Consumer /transactions works for any user.

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

json_get() {
  python3 -c "
import json, sys
doc = json.load(sys.stdin)
path = sys.argv[1].split('.')
cur = doc
for key in path:
    if key == '':
        continue
    if cur is None:
        cur = None
        break
    cur = cur.get(key) if isinstance(cur, dict) else None
print(cur if cur is not None else '')
" "$1"
}

section() {
  echo ""
  echo "=== $1 ==="
}

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

login() {
  if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
    fail "Set EMAIL and PASSWORD, or pass ACCESS_TOKEN=..."
  fi
  section "Login as $EMAIL"
  local resp http_code body
  body=$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  http_code=$(echo "$body" | tail -n1)
  body=$(echo "$body" | sed '$d')

  if [[ "$http_code" != "200" ]]; then
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    fail "Login failed (HTTP $http_code)"
  fi

  local requires_totp
  requires_totp=$(echo "$body" | json_get "data.requires_totp")
  if [[ "$requires_totp" == "True" || "$requires_totp" == "true" ]]; then
    fail "Account has 2FA — use ACCESS_TOKEN from the browser instead"
  fi

  ACCESS_TOKEN=$(echo "$body" | json_get "data.access_token")
  [[ -n "$ACCESS_TOKEN" ]] || fail "No access_token in login response"
  echo "OK — got access token (${#ACCESS_TOKEN} chars)"
}

call_api() {
  local label="$1"
  local path="$2"
  shift 2
  section "$label"
  echo "GET $path"
  local resp http_code body
  body=$(curl -sS -w "\n%{http_code}" "$BASE_URL$path" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$@")
  http_code=$(echo "$body" | tail -n1)
  body=$(echo "$body" | sed '$d')

  echo "HTTP $http_code"
  echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"

  if [[ "$http_code" == "403" ]]; then
    echo "(403 = not allowed for this user — e.g. admin route with non-admin account)"
    return 0
  fi
  if [[ "$http_code" != "200" ]]; then
    fail "Request failed: $label"
  fi
}

main() {
  echo "Heap transaction filter live test"
  echo "Base URL: $BASE_URL"

  if [[ -z "$ACCESS_TOKEN" ]]; then
    login
  else
    section "Using ACCESS_TOKEN from env"
  fi

  # Consumer — any logged-in user
  call_api "Consumer list (no filters)" "/transactions?page=1&page_size=5"
  call_api "Consumer list (status_id=2 if exists)" "/transactions?page=1&page_size=5&status_id=2&sort=newest"

  # Admin — requires admin role
  call_api "Admin stats (no filters)" "/transactions/stats?months=6"
  call_api "Admin stats (user segment=consumer)" "/transactions/stats?months=6&user_role_name=user"
  call_api "Admin list (newest)" "/transactions/all?page=1&page_size=5&sort=newest"
  call_api "Admin list (date + status)" "/transactions/all?page=1&page_size=5&status_id=2&from_date=2026-01-01&to_date=2026-12-31"

  section "Done"
  echo "If admin calls returned 403, log in with an admin account or set ACCESS_TOKEN from an admin session."
}

main "$@"
