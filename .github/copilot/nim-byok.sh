#!/bin/bash
# Nvidia NIM BYOK setup for GitHub Copilot CLI
# Usage: source .github/copilot/nim-byok.sh

# Reuse an existing GitHub CLI login when no token is exported yet.
# This keeps Copilot auth working across new terminals without hardcoding a PAT.
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]] && command -v gh >/dev/null 2>&1; then
  if gh_token="$(gh auth token 2>/dev/null)"; then
    export GH_TOKEN="${gh_token}"
    export GITHUB_TOKEN="${GITHUB_TOKEN:-$GH_TOKEN}"
  fi
fi

# NIM endpoint (OpenAI-compatible)
export COPILOT_PROVIDER_BASE_URL="https://integrate.api.nvidia.com/v1"
export COPILOT_PROVIDER_API_KEY="${NVIDIA_API_KEY}"
export COPILOT_PROVIDER_TYPE="openai"

# Wire model — exact ID sent to Nvidia NIM. Environment can override these
# values if you need to temporarily switch providers/models.
export NIM_DEFAULT_MODEL="${NIM_DEFAULT_MODEL:-openai/gpt-oss-120b}"
export NIM_MODEL_SEQUENCE="${NIM_MODEL_SEQUENCE:-openai/gpt-oss-120b nvidia/llama-3.3-nemotron-super-49b-v1.5 z-ai/glm-5.1 deepseek-ai/deepseek-v3.2 moonshotai/kimi-k2.6 minimaxai/minimax-2.7}"
export COPILOT_MODEL="${COPILOT_MODEL:-${NIM_DEFAULT_MODEL}}"

# Provider model ID used by Copilot's BYOK wiring.
# Default to the NIM baseline model so provider/model ids stay on the NIM side.
export COPILOT_PROVIDER_MODEL_ID="${COPILOT_PROVIDER_MODEL_ID:-${NIM_DEFAULT_MODEL}}"

# Optional fallback sequence for rate-limit recovery (space/comma separated).
export COPILOT_MODEL_SEQUENCE="${COPILOT_MODEL_SEQUENCE:-${NIM_MODEL_SEQUENCE}}"
export COPILOT_PROVIDER_MODEL_SEQUENCE="${COPILOT_PROVIDER_MODEL_SEQUENCE:-${NIM_MODEL_SEQUENCE}}"

# Token limits for the NIM model.
export COPILOT_PROVIDER_MAX_PROMPT_TOKENS="120000"
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS="8192"

echo "Nvidia NIM BYOK configured:"
echo "  Base URL: ${COPILOT_PROVIDER_BASE_URL}"
echo "  Model:    ${COPILOT_MODEL}"
echo "  Provider Model ID: ${COPILOT_PROVIDER_MODEL_ID}"
echo "  Fallback Models: ${COPILOT_MODEL_SEQUENCE}"
echo "  Fallback Provider IDs: ${COPILOT_PROVIDER_MODEL_SEQUENCE}"
echo "  Tokens:   ${COPILOT_PROVIDER_MAX_PROMPT_TOKENS} prompt / ${COPILOT_PROVIDER_MAX_OUTPUT_TOKENS} output"
echo ""
echo "Switch model: export COPILOT_MODEL=<model-id>"
echo "  GPT OSS:         openai/gpt-oss-120b"
echo "  Nemotron Super:  nvidia/llama-3.3-nemotron-super-49b-v1.5"
echo "  NIM default:     ${NIM_DEFAULT_MODEL}"
echo "  GLM-5.1:         z-ai/glm-5.1"
echo "  DeepSeek V3.2:   deepseek-ai/deepseek-v3.2"
echo "  Kimi K2.6:       moonshotai/kimi-k2.6"
echo "  MiniMax 2.7:     minimaxai/minimax-2.7"
