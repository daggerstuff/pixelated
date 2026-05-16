#!/usr/bin/env bash
# NVIDIA mixed‑model environment for ZYNTHOS (2026)
# Sets per‑role model IDs, excluding Llama 3.2 and Ising.

export COPILOT_PROVIDER_BASE_URL="https://integrate.api.nvidia.com/v1"

# Role‑specific models
export ZYNTHOS_LEAD_MODEL="nvidia/nemotron-3-super"   # large text model (no Llama)
export ZYNTHOS_HUNTER_MODEL="nvidia/nemotron-3-nano-omni"   # multimodal vision/audio
export ZYNTHOS_BUILDER_MODEL="deepseek/v4-flash"          # cost‑effective code generation
export ZYNTHOS_OUTREACH_MODEL="moonshot/kimi-k2.6"       # concise sales copy
export ZYNTHOS_NEGOTIATOR_MODEL="mistral/large-2"        # reasoning on RAG data
export ZYNTHOS_PAYMENT_MODEL="cohere/command-r-plus"   # fast short messages

# Optional fallback for cheap tasks
export ZYNTHOS_FALLBACK_MODEL="minimax/2.7"

echo "Mixed‑model environment variables set (Llama 3.2 and Ising excluded)."
