#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${HINDSIGHT_REPO_ROOT:-$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)}"
if [[ -z "${REPO_ROOT}" ]]; then
    REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi
DEFAULT_AI_PROJECT_ROOT="${REPO_ROOT}/ai"
AI_PROJECT_ROOT="${HINDSIGHT_AI_PROJECT_ROOT:-${DEFAULT_AI_PROJECT_ROOT}}"
DEFAULT_PYTHON_BIN="${AI_PROJECT_ROOT}/.venv/bin/python3"
PYTHON_BIN="${HINDSIGHT_MCP_PYTHON_BIN:-${DEFAULT_PYTHON_BIN}}"

MEMORY_ENV_KEYS=(
    MEMORY_PROVIDER
    HINDSIGHT_LOCAL_DB_PATH
    HINDSIGHT_BANK_ID
    HINDSIGHT_COMPAT_ENABLE_BEARER
    HINDSIGHT_COMPAT_BEARER_ACTOR_ID
    HINDSIGHT_COMPAT_DEFAULT_USER_ID
    HINDSIGHT_MCP_STDIO_TRUST
    LOCAL_MEMORY_ACTOR_TOKENS_JSON
    LOCAL_MEMORY_ACTOR_POLICIES_JSON
)

load_memory_env_file_if_present() {
    local env_path="$1"
    [[ -f "${env_path}" ]] || return 0

    set -a
    # shellcheck disable=SC1090
    source "${env_path}"
    set +a
}

missing_env_vars=()

check_env() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        missing_env_vars+=("${name}")
    fi
}

load_memory_env_file_if_present "${REPO_ROOT}/.env"
load_memory_env_file_if_present "${REPO_ROOT}/.env.local"

check_env MEMORY_PROVIDER
check_env HINDSIGHT_LOCAL_DB_PATH
check_env LOCAL_MEMORY_ACTOR_TOKENS_JSON
check_env LOCAL_MEMORY_ACTOR_POLICIES_JSON
check_env HINDSIGHT_MCP_STDIO_TRUST

if [[ ${#missing_env_vars[@]} -gt 0 ]]; then
    printf 'Hindsight MCP setup is incomplete. Missing: %s\n' "${missing_env_vars[*]}" >&2
    echo "Copy ai/config/staging/memory-service.env.example to .env.local and fill in the required values." >&2
    exit 1
fi

if [[ ! -x "${PYTHON_BIN}" ]]; then
    PYTHON_BIN="$(command -v python3 || true)"
fi

if [[ -z "${PYTHON_BIN}" || ! -x "${PYTHON_BIN}" ]]; then
    echo "Missing Python interpreter for the Hindsight MCP server. Set HINDSIGHT_MCP_PYTHON_BIN or ensure ${AI_PROJECT_ROOT}/.venv/bin/python3 exists." >&2
    exit 1
fi



export PYTHONPATH="${REPO_ROOT}${PYTHONPATH:+:${PYTHONPATH}}"

exec "${PYTHON_BIN}" -m ai.api.mcp_server.fastmcp_app
