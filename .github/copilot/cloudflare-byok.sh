#!/bin/bash
# Cloudflare Workers AI BYOK setup for GitHub Copilot CLI
# Usage: source .github/copilot/cloudflare-byok.sh [mode: direct|9router] [model]

# Reuse existing GitHub CLI login if no token is exported
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  if gh_token="$(gh auth token 2>/dev/null)"; then
    export GH_TOKEN="${gh_token}"
    export GITHUB_TOKEN="${GITHUB_TOKEN:-$GH_TOKEN}"
  fi
fi

# Helper to read Cloudflare credentials stored in 9router DB
_cf_db_credentials() {
  python3 - "$HOME/.9router/db/data.sqlite" <<'PY' 2>/dev/null
import sqlite3, sys, json
try:
    c = sqlite3.connect(sys.argv[1])
    row = c.execute("SELECT data FROM providerConnections WHERE provider='cloudflare-ai' AND isActive=1 ORDER BY updatedAt DESC LIMIT 1").fetchone()
    if row and row[0]:
        d = json.loads(row[0])
        api_key = d.get('apiKey', '')
        account_id = d.get('providerSpecificData', {}).get('accountId', '')
        print(f"{api_key}|{account_id}")
except Exception:
    pass
PY
}

_9router_api_key() {
  python3 - "$HOME/.9router/db/data.sqlite" <<'PY' 2>/dev/null
import sqlite3, sys
try:
    c = sqlite3.connect(sys.argv[1])
    row = c.execute("SELECT key FROM apiKeys WHERE isActive=1 ORDER BY createdAt DESC LIMIT 1").fetchone()
    if row and row[0]:
        print(row[0])
except Exception:
    pass
PY
}

MODE="${1:-direct}"
MODEL_ARG="${2:-}"

# Parse credentials from environment or 9router DB
CF_CREDS="$(_cf_db_credentials)"
CF_KEY="${CLOUDFLARE_API_KEY:-${CF_CREDS%%|*}}"
CF_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_CREDS##*|}}"

if [[ "$MODE" == "9router" ]]; then
  # Option A: Routed through local 9Router instance
  export COPILOT_PROVIDER_BASE_URL="http://127.0.0.1:20128/v1"
  export COPILOT_PROVIDER_API_KEY="$(_9router_api_key)"
  export COPILOT_PROVIDER_TYPE="openai"
  export COPILOT_MODEL="${MODEL_ARG:-cf/@cf/qwen/qwen3.8-27b}"
  export COPILOT_PROVIDER_WIRE_MODEL="${COPILOT_MODEL}"
  export COPILOT_PROVIDER_MODEL_ID="gpt-4o"
  export COPILOT_MODEL_SEQUENCE="${COPILOT_MODEL} cf/@cf/deepseek-ai/deepseek-v4-pro-0813"
  export COPILOT_PROVIDER_MODEL_SEQUENCE="${COPILOT_MODEL_SEQUENCE}"
else
  # Option B: Direct Cloudflare Workers AI OpenAI-compatible endpoint
  if [[ -z "$CF_KEY" || -z "$CF_ACCOUNT_ID" ]]; then
    echo "⚠️  Cloudflare credentials not found."
    echo "   Set them via: export CLOUDFLARE_API_KEY=... and export CLOUDFLARE_ACCOUNT_ID=..."
    return 1 2>/dev/null || exit 1
  fi

  export COPILOT_PROVIDER_BASE_URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1"
  export COPILOT_PROVIDER_API_KEY="${CF_KEY}"
  export COPILOT_PROVIDER_TYPE="openai"
  export COPILOT_MODEL="${MODEL_ARG:-@cf/qwen/qwen3.8-27b}"
  export COPILOT_PROVIDER_WIRE_MODEL="${COPILOT_MODEL}"
  export COPILOT_PROVIDER_MODEL_ID="gpt-4o"
  export COPILOT_MODEL_SEQUENCE="${COPILOT_MODEL} @cf/deepseek-ai/deepseek-v4-pro-0813"
  export COPILOT_PROVIDER_MODEL_SEQUENCE="${COPILOT_MODEL_SEQUENCE}"
fi

export COPILOT_PROVIDER_MAX_PROMPT_TOKENS="128000"
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS="8192"

# Cloudflare's OpenAI schema validator does not support proprietary grammar tools ('apply_patch').
# Alias copilot to automatically exclude apply_patch for seamless tool execution.
alias copilot-cf='copilot --excluded-tools apply_patch'

echo "Cloudflare Workers AI BYOK configured (${MODE} mode):"
echo "  Base URL:            ${COPILOT_PROVIDER_BASE_URL}"
echo "  Model:               ${COPILOT_MODEL}"
echo "  Provider Model ID:   ${COPILOT_PROVIDER_MODEL_ID}"
echo "  Provider Wire Model: ${COPILOT_PROVIDER_WIRE_MODEL}"
echo "  Tokens:              ${COPILOT_PROVIDER_MAX_PROMPT_TOKENS} prompt / ${COPILOT_PROVIDER_MAX_OUTPUT_TOKENS} output"
echo ""
echo "💡 Usage tip: Use 'copilot-cf' or add '--excluded-tools apply_patch' when running prompts:"
echo "   copilot-cf -p \"Your prompt here\""
echo "   copilot -p \"Your prompt here\" --excluded-tools apply_patch"
