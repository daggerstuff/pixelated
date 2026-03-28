#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_SCRIPT="${SCRIPT_DIR}/start_lightning_stage1.sh"
ENTRYPOINT_SCRIPT="${SCRIPT_DIR}/start_lightning_stage1_entrypoint.sh"

: "${LIGHTNING_STAGE:=2}"
: "${LIGHTNING_JOB_NAME:=pixelated-stage2-reasoning-$(date +%Y%m%d-%H%M%S)}"

export LIGHTNING_STAGE
export LIGHTNING_JOB_NAME

if [[ -f "${TARGET_SCRIPT}" ]]; then
  exec "${TARGET_SCRIPT}" "$@"
fi

if [[ ! -f "${ENTRYPOINT_SCRIPT}" ]]; then
  echo "ERROR: Missing launcher dependency: ${TARGET_SCRIPT}"
  echo "ERROR: Missing fallback entrypoint: ${ENTRYPOINT_SCRIPT}"
  exit 1
fi

echo "WARN: ${TARGET_SCRIPT} not found; running Stage 2 entrypoint directly."
STAGE1_STAGE="${LIGHTNING_STAGE}" exec "${ENTRYPOINT_SCRIPT}" "$@"
