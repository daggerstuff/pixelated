#!/usr/bin/env bash
# Start the eve-agent locally against Cloudflare Workers AI.
#
# - Loads agents/eve-agent/.env (Cloudflare creds, EVE_AUTH_*, model override).
# - Strips AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN so agent/lib/workers-ai.ts
#   resolves the Workers AI model instead of the AI Gateway string.
# - Binds 127.0.0.1:2015, matching agents/px.config.json.
set -euo pipefail

cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
source ./.env
set +a

unset AI_GATEWAY_API_KEY VERCEL_OIDC_TOKEN

exec pnpm exec eve start --host 127.0.0.1 --port "${EVE_PORT:-2015}"
