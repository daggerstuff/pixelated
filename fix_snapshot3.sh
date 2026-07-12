#!/bin/bash
set -uo pipefail

PREVIEW_PORT=4323
PREVIEW_URL="http://127.0.0.1:${PREVIEW_PORT}"
PREVIEW_LOG=/tmp/pixelated-preview.log
rm -f "${PREVIEW_LOG}"

cleanup() {
  local exit_code=$?
  if [[ -n "${PREVIEW_PID:-}" ]] && kill -0 "${PREVIEW_PID}" > /dev/null 2>&1; then
    kill "${PREVIEW_PID}" > /dev/null 2>&1 || true
    wait "${PREVIEW_PID}" > /dev/null 2>&1 || true
  fi
  return "${exit_code}" 2>/dev/null
}

trap cleanup EXIT

echo "Starting preview server on ${PREVIEW_URL}..."
env HOST=127.0.0.1 PORT="${PREVIEW_PORT}" WEBSITES_PORT="${PREVIEW_PORT}" pnpm run preview > "${PREVIEW_LOG}" 2>&1 &
PREVIEW_PID=$!

echo "Waiting for preview server to be ready..."
for attempt in $(seq 1 60); do
  if ! kill -0 "${PREVIEW_PID}" > /dev/null 2>&1; then
    return 1 2>/dev/null
  fi
  if curl -sS --connect-timeout 2 --max-time 5 "${PREVIEW_URL}" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

export NODE_ENV=test
export DISABLE_AUTH=true
export DISABLE_PLAYWRIGHT_WEBSERVER=true
export DISABLE_WEB_FONTS=true
export SKIP_MSW=true
export BASE_URL="${PREVIEW_URL}"
pnpm exec playwright test --config=config/playwright.config.ts tests/browser/auth.spec.ts --project=chromium --update-snapshots
