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
LAST_ASSET_ERROR=""

cleanup() {
    rm -f "${HOMEPAGE_HTML}" "${CSS_HEADERS}"
}
trap cleanup EXIT

verify_static_assets_once() {
    : > "${HOMEPAGE_HTML}"
    : > "${CSS_HEADERS}"

    if ! curl -f -s "${SITE_URL}/" > "${HOMEPAGE_HTML}"; then
        LAST_ASSET_ERROR="Homepage unreachable at ${SITE_URL}/"
        return 1
    fi

    # Collect EVERY /_astro/* asset the homepage references (CSS AND JS).
    # A page can reference multiple UnoCSS/JS bundles; checking only the
    # first one (as before) let a 404 on a *later* bundle slip through CI
    # while prod served broken pages. We must verify all of them.
    mapfile -t ASSET_PATHS < <(grep -oE '/_astro/[^"]+\.(css|js)' "${HOMEPAGE_HTML}" | sort -u)
    if [[ ${#ASSET_PATHS[@]} -eq 0 ]]; then
        LAST_ASSET_ERROR="No /_astro/ asset references found on homepage"
        return 1
    fi

    for ASSET_PATH in "${ASSET_PATHS[@]}"; do
        : > "${CSS_HEADERS}"
        if ! curl -sS -D "${CSS_HEADERS}" -o /dev/null "${SITE_URL}${ASSET_PATH}"; then
            LAST_ASSET_ERROR="Asset request failed at ${SITE_URL}${ASSET_PATH}"
            return 1
        fi

        if ! grep -qE '^HTTP/.* 200' "${CSS_HEADERS}"; then
            LAST_ASSET_ERROR="Asset returned non-200 at ${SITE_URL}${ASSET_PATH}"
            return 1
        fi
    done

    # Content-type sanity check on the first stylesheet we found.
    FIRST_CSS="$(grep -oE '/_astro/[^"]+\.css' "${HOMEPAGE_HTML}" | head -n 1)"
    if [[ -n "${FIRST_CSS}" ]]; then
        : > "${CSS_HEADERS}"
        curl -sS -D "${CSS_HEADERS}" -o /dev/null "${SITE_URL}${FIRST_CSS}"
        if ! grep -qi '^content-type: text/css' "${CSS_HEADERS}"; then
            LAST_ASSET_ERROR="Stylesheet content-type was not text/css at ${SITE_URL}${FIRST_CSS}"
            return 1
        fi
    fi

    if ! curl -f -s "${SITE_URL}/favicon.svg" > /dev/null; then
        LAST_ASSET_ERROR="Favicon missing at ${SITE_URL}/favicon.svg"
        return 1
    fi

    return 0
}

MAX_ASSET_RETRIES="${MAX_ASSET_RETRIES:-12}"
ASSET_RETRY_DELAY_SECONDS="${ASSET_RETRY_DELAY_SECONDS:-10}"
ASSET_RETRY_COUNT=0

while [[ ${ASSET_RETRY_COUNT} -lt ${MAX_ASSET_RETRIES} ]]; do
    if verify_static_assets_once; then
        echo "✅ Static asset verification passed."
        exit 0
    fi

    ASSET_RETRY_COUNT=$((ASSET_RETRY_COUNT + 1))
    if [[ ${ASSET_RETRY_COUNT} -lt ${MAX_ASSET_RETRIES} ]]; then
        echo "⏳ Static assets not consistent yet (${ASSET_RETRY_COUNT}/${MAX_ASSET_RETRIES}): ${LAST_ASSET_ERROR}"
        sleep "${ASSET_RETRY_DELAY_SECONDS}"
    fi
done

echo "❌ Deployment verification failed: ${LAST_ASSET_ERROR}"
exit 1
