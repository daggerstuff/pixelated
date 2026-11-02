#!/usr/bin/env bash
# scripts/ci/build-cloudflare.sh
#
# Cloudflare Workers build for the Astro app (DEPLOY_TARGET=cloudflare).
# Produces dist/server (SSR entry + generated wrangler.json) + dist/client via
# the canonical build wrapper. This is the build used by
# .github/workflows/deploy-cloudflare.yml; run locally for a deployable bundle.
#
# Usage: bash scripts/ci/build-cloudflare.sh
# Exit codes:
#   0 — build succeeded
#   1 — build failed

set -euo pipefail

echo "🔵 Starting Cloudflare Workers build (Astro + @astrojs/cloudflare)"

export DEPLOY_TARGET=cloudflare
export CI=true

# Canonical build wrapper: verify-build-contract + astro build +
# ensure-server-entry (which skips on this target — the adapter emits its own
# fetch-handler entry that imports 'cloudflare:workers').
pnpm build

echo "✅ Cloudflare Workers build completed successfully"
