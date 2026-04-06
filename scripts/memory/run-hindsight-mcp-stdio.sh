#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REPO_ROOT="${HINDSIGHT_REPO_ROOT:-}"
export AI_PROJECT_ROOT="${HINDSIGHT_AI_PROJECT_ROOT:-}"
export PYTHON_BIN="${HINDSIGHT_MCP_PYTHON_BIN:-}"

missing_env_vars=()

resolve_roots() {
    if [[ -z "${REPO_ROOT}" ]]; then
        REPO_ROOT="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)"
        if [[ -z "${REPO_ROOT}" ]]; then
            REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
        fi
    fi
    
    if [[ -z "${AI_PROJECT_ROOT}" ]]; then
        AI_PROJECT_ROOT="${REPO_ROOT}/ai"
    fi
}

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

load_environment() {
    local env_path="$1"
    [[ -f "${env_path}" ]] || return 0

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            
            # Strip outer quotes if present
            value="${value#\"}"
            value="${value%\"}"
            value="${value#\'}"
            value="${value%\'}"

            for allowed_key in "${MEMORY_ENV_KEYS[@]}"; do
                if [[ "$key" == "$allowed_key" ]]; then
                    export "$key=$value"
                    break
                fi
            done
        fi
    done < "${env_path}"
}

check_env() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        missing_env_vars+=("${name}")
    fi
}

validate_environment() {
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
}

resolve_python() {
    if [[ -z "${PYTHON_BIN}" ]]; then
        PYTHON_BIN="${AI_PROJECT_ROOT}/.venv/bin/python3"
    fi

    if [[ ! -x "${PYTHON_BIN}" ]]; then
        PYTHON_BIN="$(command -v python3 || true)"
    fi

    if [[ -z "${PYTHON_BIN}" || ! -x "${PYTHON_BIN}" ]]; then
        echo "Missing Python interpreter for the Hindsight MCP server. Set HINDSIGHT_MCP_PYTHON_BIN or ensure ${AI_PROJECT_ROOT}/.venv/bin/python3 exists." >&2
        exit 1
    fi
}

main() {
    resolve_roots
    
    load_environment "${REPO_ROOT}/.env"
    load_environment "${REPO_ROOT}/.env.local"
    
    validate_environment
    resolve_python
    
    export PYTHONPATH="${REPO_ROOT}${PYTHONPATH:+:${PYTHONPATH}}"
    
    exec "${PYTHON_BIN}" -m ai.api.mcp_server.fastmcp_app
}

main "$@"
