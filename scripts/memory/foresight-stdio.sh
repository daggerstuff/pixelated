#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

load_env() {
  [[ -f "${REPO_ROOT}/.env" ]] && set -a && . "${REPO_ROOT}/.env" && set +a
  [[ -f "${REPO_ROOT}/.env.local" ]] && set -a && . "${REPO_ROOT}/.env.local" && set +a
}

load_env

exec uv run python -m ai.foresight.app
