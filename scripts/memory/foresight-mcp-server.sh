#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
FORESIGHT_ROOT="${REPO_ROOT}/foresight-mcp"

load_env() {
  [[ -f "${REPO_ROOT}/.env" ]] && source "${REPO_ROOT}/.env"
  [[ -f "${REPO_ROOT}/.env.local" ]] && source "${REPO_ROOT}/.env.local"
}

find_uv() {
  if command -v uv >/dev/null 2>&1; then
    echo "uv"
    return
  fi

  local candidates=(
    "${REPO_ROOT}/.venv/bin/uv"
    "${REPO_ROOT}/ai/.venv/bin/uv"
    "${HOME}/.venv/bin/uv"
    "${HOME}/.gemini/tools/bin/uv"
    /usr/local/bin/uv
    /usr/bin/uv
  )

  for candidate in "${candidates[@]}"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return
    fi
  done
}

load_env

UV_BIN="$(find_uv || true)"
if [[ -z "${UV_BIN}" ]]; then
  echo "uv not found in PATH or standard install locations." >&2
  exit 1
fi

export UV_CACHE_DIR="/home/vivi/.gemini/tmp/uv-cache"

cd "${FORESIGHT_ROOT}"
exec "${UV_BIN}" run --project "${FORESIGHT_ROOT}" --active -m foresight_mcp "$@"

