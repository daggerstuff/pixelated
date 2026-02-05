#!/bin/bash
# Quick script to extract authentication cookies for Lighthouse CI
# Usage: ./get-auth-cookie.sh <production-url> <email> <password>

set -euo pipefail

PRODUCTION_URL="${1:-}"
EMAIL="${2:-}"
PASSWORD="${3:-}"

if [ -z "$PRODUCTION_URL" ] || [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "❌ Usage: $0 <production-url> <email> <password>"
  echo ""
  echo "Example:"
  echo "  $0 https://pixelated.example.com user@example.com mypassword"
  exit 1
fi

echo "🔐 Authenticating to $PRODUCTION_URL..."
echo ""

# Create a temporary cookie jar
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

# Attempt to login and capture cookies
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" \
  -X POST "${PRODUCTION_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  2>/dev/null || echo "000")

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ]; then
  echo "❌ Login failed with HTTP $HTTP_CODE"
  echo ""
  echo "Please verify:"
  echo "  1. The production URL is correct"
  echo "  2. The email and password are valid"
  echo "  3. The /api/auth/login endpoint exists"
  exit 1
fi

echo "✅ Login successful (HTTP $HTTP_CODE)"
echo ""

# Extract the authentication cookies
ACCESS_TOKEN=$(grep -o 'sb-access-token[[:space:]]*[^[:space:]]*' "$COOKIE_JAR" | awk '{print $NF}' || echo "")
REFRESH_TOKEN=$(grep -o 'sb-refresh-token[[:space:]]*[^[:space:]]*' "$COOKIE_JAR" | awk '{print $NF}' || echo "")

if [ -z "$ACCESS_TOKEN" ] && [ -z "$REFRESH_TOKEN" ]; then
  echo "⚠️  No authentication cookies found in response"
  echo ""
  echo "Cookie jar contents:"
  cat "$COOKIE_JAR"
  echo ""
  echo "This might mean:"
  echo "  1. Your app uses different cookie names"
  echo "  2. The login endpoint doesn't set cookies"
  echo "  3. You need to follow redirects or use a different auth flow"
  exit 1
fi

# Format the cookie string
COOKIE_STRING=""
if [ -n "$ACCESS_TOKEN" ]; then
  COOKIE_STRING="sb-access-token=$ACCESS_TOKEN"
fi
if [ -n "$REFRESH_TOKEN" ]; then
  if [ -n "$COOKIE_STRING" ]; then
    COOKIE_STRING="$COOKIE_STRING; sb-refresh-token=$REFRESH_TOKEN"
  else
    COOKIE_STRING="sb-refresh-token=$REFRESH_TOKEN"
  fi
fi

echo "✅ Authentication cookies extracted!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 LH_AUTH_COOKIE value (copy this):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$COOKIE_STRING"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo "  1. Copy the cookie string above"
echo "  2. Go to: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/settings/secrets/actions"
echo "  3. Click 'New repository secret'"
echo "  4. Name: LH_AUTH_COOKIE"
echo "  5. Value: Paste the cookie string"
echo "  6. Click 'Add secret'"
echo ""
echo "⚠️  Security reminder:"
echo "  - These tokens expire in 7 days (based on your sessionDuration config)"
echo "  - Consider creating a dedicated test/monitoring user account"
echo "  - Rotate this secret regularly for security"
echo ""
