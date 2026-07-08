#!/bin/bash
# verify-deployment.sh
# Performs a more detailed health check on the deployed application.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REDIS_AUDIT="${PROJECT_ROOT}/scripts/check-redis-hardening.sh"

if ! "$REDIS_AUDIT"; then
  echo "Redis hardening audit failed"
  exit 1
fi

HEALTH_URL="${1:-http://localhost:4321/api/health}"
SITE_URL="${2:-${HEALTH_URL%/api/health}}"

echo "🔍 Verifying deployment at ${HEALTH_URL}..."

# Wait for service to be reachable
MAX_RETRIES=5
RETRY_COUNT=0
while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
    if curl -f -s "${HEALTH_URL}" > /dev/null; then
        echo "✅ Service is reachable and healthy."
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ Service not ready yet, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
        sleep 5
    fi
done

if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; then
    echo "❌ Deployment verification failed: Service unreachable at ${HEALTH_URL}"
    exit 1
fi

echo "🔍 Verifying static assets at ${SITE_URL}..."

HOMEPAGE_HTML="$(mktemp)"
CSS_HEADERS="$(mktemp)"

cleanup() {
    rm -f "${HOMEPAGE_HTML}" "${CSS_HEADERS}"
}
trap cleanup EXIT

if ! curl -f -s "${SITE_URL}/" > "${HOMEPAGE_HTML}"; then
    echo "❌ Deployment verification failed: Homepage unreachable at ${SITE_URL}/"
    exit 1
fi

CSS_PATH="$(grep -oE '/_astro/[^"]+\.css' "${HOMEPAGE_HTML}" | head -n 1 || true)"
if [[ -z "${CSS_PATH}" ]]; then
    echo "❌ Deployment verification failed: no Astro stylesheet reference found on homepage"
    exit 1
fi

if ! curl -sS -D "${CSS_HEADERS}" -o /dev/null "${SITE_URL}${CSS_PATH}"; then
    echo "❌ Deployment verification failed: stylesheet request failed at ${SITE_URL}${CSS_PATH}"
    exit 1
fi

if ! grep -qE '^HTTP/.* 200' "${CSS_HEADERS}"; then
    echo "❌ Deployment verification failed: stylesheet returned non-200 at ${SITE_URL}${CSS_PATH}"
    exit 1
fi

if ! grep -qi '^content-type: text/css' "${CSS_HEADERS}"; then
    echo "❌ Deployment verification failed: stylesheet content-type was not text/css at ${SITE_URL}${CSS_PATH}"
    exit 1
fi

if ! curl -f -s "${SITE_URL}/favicon.svg" > /dev/null; then
    echo "❌ Deployment verification failed: favicon missing at ${SITE_URL}/favicon.svg"
    exit 1
fi

echo "✅ Static asset verification passed."

exit 0
