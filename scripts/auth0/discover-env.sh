#!/usr/bin/env bash
# Discover Auth0 .env values via Auth0 CLI (requires: brew install auth0/auth0-cli/auth0)
set -euo pipefail

DOMAIN="${AUTH0_DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Set AUTH0_DOMAIN or run: auth0 login" >&2
  exit 1
fi

echo "Tenant: $DOMAIN"
echo
echo "=== Applications ==="
auth0 apps list --json-compact | jq -r '.[] | "\(.app_type // "unknown")\t\(.name)\t\(.client_id)"'

echo
echo "=== APIs (audiences) ==="
auth0 apis list --json-compact | jq -r '.[] | "\(.name)\t\(.identifier)"'

echo
echo "=== Suggested mapping (edit IDs before exporting secrets) ==="
REGULAR_ID="$(auth0 apps list --json-compact | jq -r '.[] | select(.app_type=="regular_web") | .client_id' | head -1)"
M2M_ID="$(auth0 apps list --json-compact | jq -r '.[] | select(.app_type=="non_interactive") | .client_id' | head -1)"
AUDIENCE="$(auth0 apis list --json-compact | jq -r '.[0].identifier // empty')"
CALLBACK="$(auth0 apps show "$REGULAR_ID" --json 2>/dev/null | jq -r '.callbacks[0] // "http://localhost:4321/api/auth/auth0-callback"')"

cat <<EOF
AUTH0_DOMAIN=$DOMAIN
AUTH0_CLIENT_ID=$REGULAR_ID
AUTH0_CLIENT_SECRET=<auth0 apps show $REGULAR_ID -r --json | jq -r .client_secret>
AUTH0_AUDIENCE=$AUDIENCE
AUTH0_MANAGEMENT_CLIENT_ID=$M2M_ID
AUTH0_MANAGEMENT_CLIENT_SECRET=<auth0 apps show $M2M_ID -r --json | jq -r .client_secret>
AUTH0_CALLBACK_URL=$CALLBACK
PUBLIC_AUTH0_DOMAIN=$DOMAIN
PUBLIC_AUTH0_CLIENT_ID=$REGULAR_ID
VITE_AUTH0_DOMAIN=$DOMAIN
VITE_AUTH0_CLIENT_ID=$REGULAR_ID
EOF
