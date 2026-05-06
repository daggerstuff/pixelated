#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

if [[ -n "${PNPM_BIN:-}" ]]; then
  read -r -a PNPM_CMD <<< "${PNPM_BIN}"
  if ! command -v "${PNPM_CMD[0]}" >/dev/null 2>&1; then
    echo "Error: pnpm binary not found: ${PNPM_BIN}" >&2
    exit 127
  fi
  : # keep explicitly-set portable binary command
elif command -v pnpm >/dev/null 2>&1; then
  PNPM_CMD=(pnpm)
else
  echo "Error: pnpm binary not found on PATH." >&2
  exit 127
fi

exec "${PNPM_CMD[@]}" dlx @mseep/linear-mcp "$@"
