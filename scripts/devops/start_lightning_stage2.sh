#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Stage 2 wrapper delegates to Stage 1 launch path for shared behavior.
# This file intentionally loads system Vault env as optional context before
# delegating, while Stage 1/entrypoint scripts own the actual execution flow.
TARGET_SCRIPT="${SCRIPT_DIR}/start_lightning_stage1.sh"
ENTRYPOINT_SCRIPT="${SCRIPT_DIR}/start_lightning_stage1_entrypoint.sh"

if [[ -f "${SCRIPT_DIR}/lib/vault-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/lib/vault-env.sh"
  load_vault_env 0 || true
else
  echo "⚠️ Missing helper script: ${SCRIPT_DIR}/lib/vault-env.sh"
fi

: "${LIGHTNING_STAGE:=2}"
: "${LIGHTNING_JOB_NAME:=pixelated-stage2-reasoning-$(date +%Y%m%d-%H%M%S)}"

export LIGHTNING_STAGE
export LIGHTNING_JOB_NAME

if [[ -f "${TARGET_SCRIPT}" ]]; then
  # If target exists, it owns full Stage 2 bootstrap + execution flow.
  exec "${TARGET_SCRIPT}" "$@"
fi

if [[ ! -f "${ENTRYPOINT_SCRIPT}" ]]; then
  echo "ERROR: Missing launcher dependency: ${TARGET_SCRIPT}"
  echo "ERROR: Missing fallback entrypoint: ${ENTRYPOINT_SCRIPT}"
  exit 1
fi

echo "WARN: ${TARGET_SCRIPT} not found; running Stage 2 entrypoint directly."
STAGE1_STAGE="${LIGHTNING_STAGE}" exec "${ENTRYPOINT_SCRIPT}" "$@"
