#!/bin/bash
# Neon Ai Gateway "Bring Your Own Key" setup script
# This script sets environment variables for using Neon Ai Gateway
# with the GitHub Copilot CLI

# Quick Start
# ---------
# To configure your environment for Neon Ai Gateway:
#
#   source .github/copilot/neon-byok.sh
#
# This script sets the following environment variables:
#
# - NEON_AI_GATEWAY_BASE_URL - your branch's AI Gateway host URL
#   (e.g., https://br-<name>-api.ai.c-2.us-east-2.aws.neon.tech)
# - NEON_AI_GATEWAY_TOKEN - your Neon credential with ai_gateway:invoke scope
# - COPILOT_PROVIDER_BASE_URL - mapped from NEON_AI_GATEWAY_BASE_URL
# - COPILOT_PROVIDER_API_KEY - mapped from NEON_AI_GATEWAY_TOKEN
# - COPILOT_PROVIDER_TYPE - "openai" (Neon is OpenAI-compatible)
# - COPILOT_MODEL - default model from Neon's catalog

set -euo pipefail

# Exit if NEON_AI_GATEWAY_TOKEN is not set (required)
if [ -z "${NEON_AI_GATEWAY_TOKEN:-}" ]; then
  echo "⚠️  NEON_AI_GATEWAY_TOKEN is not set."
  echo "   Set it via: export NEON_AI_GATEWAY_TOKEN=nt_live_..."
  echo "   Get a credential from the Neon Console: "
  echo "   Branch → Credentials → Create credential (check ai_gateway:invoke)"
  return 1 2>/dev/null || exit 1
fi

# Set Neon Ai Gateway base URL if not already set
if [ -z "${NEON_AI_GATEWAY_BASE_URL:-}" ]; then
  echo "⚠️  NEON_AI_GATEWAY_BASE_URL is not set."
  echo "   Set it via: export NEON_AI_GATEWAY_BASE_URL=https://br-<name>-api.ai.c-2.us-east-2.aws.neon.tech"
  echo "   Find your branch's host in the Neon Console on the AI Gateway page."
  return 1 2>/dev/null || exit 1
fi

# Export environment variables for Copilot CLI
export NEON_AI_GATEWAY_BASE_URL="${NEON_AI_GATEWAY_BASE_URL}"
export NEON_AI_GATEWAY_TOKEN="${NEON_AI_GATEWAY_TOKEN}"

# Map to Copilot CLI environment variables
export COPILOT_PROVIDER_BASE_URL="${NEON_AI_GATEWAY_BASE_URL}"
export COPILOT_PROVIDER_API_KEY="${NEON_AI_GATEWAY_TOKEN}"
export COPILOT_PROVIDER_TYPE="openai"

# Set default model - can be overridden by user
if [ -z "${COPILOT_MODEL:-}" ]; then
  export COPILOT_MODEL="openai/gpt-oss-120b"
fi

# Export provider model ID (alias for COPILOT_MODEL for compatibility)
export COPILOT_PROVIDER_MODEL_ID="${COPILOT_MODEL}"

echo "✅ Neon Ai Gateway environment configured successfully!"
echo "   Provider URL:  $COPILOT_PROVIDER_BASE_URL"
echo "   Model:         $COPILOT_MODEL"
echo "   Provider Type: $COPILOT_PROVIDER_TYPE"