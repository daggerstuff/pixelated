#!/usr/bin/env bash
# NVIDIA NIM environment setup for ZYNTHOS
# Sets base URL and model IDs for all agents
export COPILOT_PROVIDER_BASE_URL="http://127.0.0.1:20128/v1"
export COPILOT_PROVIDER_API_KEY="sk_9router"
# Default model for planning/coordination (large text model)
export COPILOT_MODEL="groq/openai/gpt-oss-120b"
# Model IDs for specific roles (override as needed)
export ZYNTHOS_LEAD_MODEL="nvidia/llama-3.2-90b-instruct"
export ZYNTHOS_HUNTER_MODEL="nvidia/nemotron-3-nano-omni"
export ZYNTHOS_BUILDER_MODEL="nvidia/nemotron-3-nano-omni"
export ZYNTHOS_OUTREACH_MODEL="nvidia/nemotron-3-super"
export ZYNTHOS_NEGOTIATOR_MODEL="nvidia/nemotron-3-super"
export ZYNTHOS_PAYMENT_MODEL="nvidia/nemotron-3-super"
# Load into current shell if sourced
echo "NVIDIA NIM environment variables set."
