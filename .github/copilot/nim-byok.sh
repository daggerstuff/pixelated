#!/bin/bash
# Nvidia NIM BYOK setup for GitHub Copilot CLI
# Usage: source .github/copilot/nim-byok.sh

# NIM endpoint (OpenAI-compatible)
export COPILOT_PROVIDER_BASE_URL="https://integrate.api.nvidia.com/v1"
export COPILOT_PROVIDER_API_KEY="${NVIDIA_API_KEY}"
export COPILOT_PROVIDER_TYPE="openai"

# Wire model — exact ID sent to Nvidia NIM
export COPILOT_MODEL="nvidia/llama-3.1-nemotron-ultra-253b-v1"

# Model ID for internal config (token limits, tool support, prompting)
# Must match a well-known model so Copilot CLI knows capabilities.
export COPILOT_PROVIDER_MODEL_ID="gpt-5.4"

# Token limits for the NIM model (Nemotron Ultra supports 128K context)
export COPILOT_PROVIDER_MAX_PROMPT_TOKENS="120000"
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS="8192"

echo "Nvidia NIM BYOK configured:"
echo "  Base URL: ${COPILOT_PROVIDER_BASE_URL}"
echo "  Model:    ${COPILOT_MODEL}"
echo "  Model ID: ${COPILOT_PROVIDER_MODEL_ID}"
echo "  Tokens:   ${COPILOT_PROVIDER_MAX_PROMPT_TOKENS} prompt / ${COPILOT_PROVIDER_MAX_OUTPUT_TOKENS} output"
echo ""
echo "Switch model: export COPILOT_MODEL=<model-id>"
echo "  Qwen 3.5 122B:   qwen/qwen3.5-122b-a10b"
echo "  Qwen 3.5 397B:   qwen/qwen3.5-397b-a17b"
echo "  GLM-5:           z-ai/glm5"
echo "  DeepSeek V3.2:   deepseek-ai/deepseek-v3.2"
echo "  Kimi K2.5:       moonshotai/kimi-k2.5"
echo "  Mistral Large 3: mistralai/mistral-large-3-675b-instruct-2512"
