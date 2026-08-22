#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
FORESIGHT_ROOT="${REPO_ROOT}/foresight"

load_env() {
  local -A _pre
  while IFS=$'\n' read -r line; do
    [[ -z "$line" ]] && continue
    local key="${line%%=*}"
    if [[ "${key}" == "FORESIGHT_DB_URL" ]]; then
      continue
    fi
    _pre["${key}"]="${line#*=}"
  done < <(env | grep '^FORESIGHT_' || true)

  set -a
  [[ -f "${REPO_ROOT}/.env" ]] && source "${REPO_ROOT}/.env"
  [[ -f "${REPO_ROOT}/.env.local" ]] && source "${REPO_ROOT}/.env.local"
  set +a

  for key in "${!_pre[@]}"; do
    export "${key}=${_pre[$key]}"
  done
}

find_uv() {
  if command -v uv >/dev/null 2>&1; then
    echo "uv"
    return
  fi

  local candidates=(
    "${REPO_ROOT}/.venv/bin/uv"
    "${REPO_ROOT}/ai/.venv/bin/uv"
    "${HOME}/.local/bin/uv"
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

# This wrapper is the repo-local stdio entrypoint used by agent tooling. Those
# clients do not have a safe channel to attach a per-call API key, so keep local
# stdio usable by default while preserving an explicit auth opt-in.
if [[ -z "${FORESIGHT_REQUIRE_API_KEY:-}" && -z "${FORESIGHT_ALLOW_UNAUTHENTICATED:-}" ]]; then
  export FORESIGHT_ALLOW_UNAUTHENTICATED=1
fi

# Local stdio mode: allow Postgres backend when FORESIGHT_DB_URL is set in .env.
# The DB_URL now routes through get_db_connection() which handles both backends.

UV_BIN="$(find_uv || true)"
if [[ -z "${UV_BIN}" ]]; then
  echo "uv not found in PATH or standard install locations." >&2
  exit 1
fi

export UV_CACHE_DIR="${UV_CACHE_DIR:-/home/vivi/.gemini/tmp/uv-cache}"

# Force the project-local venv (foresight/.venv) regardless of any
# ambient VIRTUAL_ENV — agent transports frequently run with the workspace
# .venv exported, which lacks the full fastmcp.server package and causes
# ImportError on lazy task-routing imports. --no-active guarantees uv creates
# or reuses ONLY the project's own .venv.
unset VIRTUAL_ENV
unset VIRTUAL_ENV_DIR

cd "${FORESIGHT_ROOT}"

# Switch to streamable-http transport when FORESIGHT_PORT is set (default: stdio).
# Use stateless HTTP so the server keeps no per-client session state: HTTP MCP
# clients (e.g. the Copilot CLI transport) cache the Mcp-Session-Id from the
# initial handshake and never re-handshake, so any server restart that wipes the
# in-memory session dict would strand the client with HTTP 404 "Session expired"
# errors forever. Stateless mode sidesteps session tracking entirely, making
# server restarts safe without requiring the client to re-initialize.
if [[ -n "${FORESIGHT_PORT:-}" ]]; then
  export FASTMCP_STATELESS_HTTP=1
  set -- "--host" "${FORESIGHT_HOST:-0.0.0.0}" "--port" "${FORESIGHT_PORT}" "$@"
fi

exec "${UV_BIN}" run --project "${FORESIGHT_ROOT}" --no-active -m foresight "$@"
