#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET_HOST="${TARGET_HOST:-${TRAINING_HOST:-ovh}}"
PARSED_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target|--host)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --target/--host requires a value." >&2
        exit 1
      fi
      TARGET_HOST="$2"
      PARSED_ARGS+=("$1" "$2")
      shift 2
      ;;
    *)
      PARSED_ARGS+=("$1")
      shift
      ;;
  esac
done

TARGET_HOST_LOWER="$(echo "${TARGET_HOST}" | tr '[:upper:]' '[:lower:]')"

case "${TARGET_HOST_LOWER}" in
  ovh)
    exec "${SCRIPT_DIR}/run-persona-regeneration-ovh.sh" "${PARSED_ARGS[@]}"
    ;;
  lightning|lightning_ai|lightning-ai)
    exec "${SCRIPT_DIR}/run-persona-regeneration-lightning.sh" "${PARSED_ARGS[@]}"
    ;;
  *)
    echo "ERROR: TARGET_HOST must be one of: ovh, lightning." >&2
    exit 1
    ;;
esac
