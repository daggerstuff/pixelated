#!/usr/bin/env bash
# Start the supervisor eve agent locally against Cloudflare Workers AI.
set -euo pipefail
cd "$(dirname "$0")"
set -a
# shellcheck disable=SC1091
source ./.env
set +a
unset AI_GATEWAY_API_KEY VERCEL_OIDC_TOKEN
exec pnpm exec eve start --host 127.0.0.1 --port "${EVE_PORT:-2000}"
