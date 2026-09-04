#!/bin/bash
# Nvidia NIM BYOK setup for GitHub Copilot CLI
# Usage: source .github/copilot/nim-byok.sh

# If this shell has stale legacy helper functions from an older version, drop them
# so the fixed zsh-compatible implementations below always win in long-lived sessions.
if typeset -f sanitize_model_sequence >/dev/null 2>&1; then
  unset -f sanitize_model_sequence sanitize_model is_forbidden_model 2>/dev/null || true
fi

# Reuse an existing GitHub CLI login when no token is exported yet.
# This keeps Copilot auth working across new terminals without hardcoding a PAT.
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  if gh_token="$(gh auth token 2>/dev/null)"; then
    export GH_TOKEN="${gh_token}"
    export GITHUB_TOKEN="${GITHUB_TOKEN:-$GH_TOKEN}"
  fi
fi

# Derive the live 9Router API key from its own DB instead of hardcoding it.
# Keeps this script correct even if the key is rotated in the Dashboard.
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

# 9Router endpoint (OpenAI-compatible)
export COPILOT_PROVIDER_BASE_URL="http://127.0.0.1:20128/v1"
export COPILOT_PROVIDER_API_KEY="$(_9router_api_key)"
export COPILOT_PROVIDER_TYPE="openai"

# Keep qwen/GPT-4o mini drift from being reused as default for this project.
_nim_byok_is_forbidden_model() {
  local candidate="$1"
  [[ "$candidate" == "gpt-5.4-mini" || "$candidate" == *qwen* ]]
}

_nim_byok_sanitize_model() {
  local candidate="$1"
  candidate="$(printf '%s' "$candidate" | xargs)"
  if _nim_byok_is_forbidden_model "$candidate"; then
    echo "$NIM_DEFAULT_MODEL"
    return
  fi
  echo "$candidate"
}

_nim_byok_sanitize_model_sequence() {
  local raw_sequence="$1"
  local token normalized
  local normalized_sequence
  local output=""

  if [[ -z "$raw_sequence" ]]; then
    echo "$NIM_DEFAULT_MODEL"
    return
  fi

  normalized_sequence="${raw_sequence//,/ }"
  for token in $normalized_sequence; do
    normalized="$(_nim_byok_sanitize_model "$token")"
    [[ -z "$normalized" ]] && continue
    if [[ " $output " != *" $normalized "* ]]; then
      output="${output:+$output }$normalized"
    fi
  done

  if [[ -z "${output// }" ]]; then
    echo "$NIM_DEFAULT_MODEL"
    return
  fi

  echo "$output"
}

# Backwards-compatible aliases for any scripts/commands still invoking old helper names.
sanitize_model() {
  _nim_byok_sanitize_model "$@"
}

sanitize_model_sequence() {
  _nim_byok_sanitize_model_sequence "$@"
}

is_forbidden_model() {
  _nim_byok_is_forbidden_model "$@"
}

# Wire model — exact ID sent to 9Router. Environment can override these
# values if you need to temporarily switch providers/models.
export NIM_DEFAULT_MODEL="${NIM_DEFAULT_MODEL:-nvidia/z-ai/glm-5.2}"
export NIM_MODEL_SEQUENCE="$(_nim_byok_sanitize_model_sequence "${NIM_MODEL_SEQUENCE:-nvidia/z-ai/glm-5.2 groq/llama-3.3-70b-versatile nvidia/deepseek-ai/deepseek-v4-flash nvidia/moonshotai/kimi-k2.6 nvidia/minimaxai/minimax-m3}")"
export COPILOT_MODEL="$(_nim_byok_sanitize_model "${COPILOT_MODEL:-${NIM_DEFAULT_MODEL}}")"

# Provider model ID used by Copilot's BYOK wiring.
# Default to the NIM baseline model so provider/model ids stay on the NIM side.
export COPILOT_PROVIDER_MODEL_ID="$(_nim_byok_sanitize_model "${COPILOT_PROVIDER_MODEL_ID:-${NIM_DEFAULT_MODEL}}")"

# Optional fallback sequence for rate-limit recovery (space/comma separated).
export COPILOT_MODEL_SEQUENCE="$(_nim_byok_sanitize_model_sequence "${COPILOT_MODEL_SEQUENCE:-${NIM_MODEL_SEQUENCE}}")"
export COPILOT_PROVIDER_MODEL_SEQUENCE="$(_nim_byok_sanitize_model_sequence "${COPILOT_PROVIDER_MODEL_SEQUENCE:-${NIM_MODEL_SEQUENCE}}")"

# Token limits for the NIM model.
export COPILOT_PROVIDER_MAX_PROMPT_TOKENS="120000"
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS="8192"

echo "9Router BYOK configured:"
echo "  Base URL: ${COPILOT_PROVIDER_BASE_URL}"
echo "  Model:    ${COPILOT_MODEL}"
echo "  Provider Model ID: ${COPILOT_PROVIDER_MODEL_ID}"
echo "  Fallback Models: ${COPILOT_MODEL_SEQUENCE}"
echo "  Fallback Provider IDs: ${COPILOT_PROVIDER_MODEL_SEQUENCE}"
echo "  Tokens:   ${COPILOT_PROVIDER_MAX_PROMPT_TOKENS} prompt / ${COPILOT_PROVIDER_MAX_OUTPUT_TOKENS} output"
echo ""
echo "Switch model: export COPILOT_MODEL=<model-id>"
echo "  GLM 5.2:         nvidia/z-ai/glm-5.2"
echo "  Llama 3.3 70B:   groq/llama-3.3-70b-versatile"
echo "  GLM-5.2:         nvidia/z-ai/glm-5.2"
echo "  DeepSeek V4:     nvidia/deepseek-ai/deepseek-v4-flash"
echo "  Kimi K2.6:       nvidia/moonshotai/kimi-k2.6"
echo "  MiniMax 2.7:     nvidia/minimaxai/minimax-m2.7"
