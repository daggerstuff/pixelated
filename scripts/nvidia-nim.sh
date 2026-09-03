#!/usr/bin/env bash
# NVIDIA NIM environment setup for ZYNTHOS
# Sets base URL and model IDs for all agents

# Derive the live 9Router API key from its own DB instead of hardcoding it.
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

export COPILOT_PROVIDER_BASE_URL="http://127.0.0.1:20128/v1"
export COPILOT_PROVIDER_API_KEY="$(_9router_api_key)"
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
