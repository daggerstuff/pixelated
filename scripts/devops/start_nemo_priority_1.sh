#!/usr/bin/env bash
set -euo pipefail

# NeMo launcher entrypoint wrapper.
# Keeps this script intentionally thin and delegates to start_nvidia_priority_1.sh,
# which performs the strict Vault preflight checks (`NEMO_VAULT_*` required).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/start_nvidia_priority_1.sh"
