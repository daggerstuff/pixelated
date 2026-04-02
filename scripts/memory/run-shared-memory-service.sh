#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AI_PROJECT_ROOT="${REPO_ROOT}/ai"
UV_BIN="${UV_BIN:-$(command -v uv || true)}"

require_env() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        echo "Missing required environment variable: ${name}" >&2
        exit 1
    fi
}

require_env MEMORY_PROVIDER
require_env HINDSIGHT_LOCAL_DB_PATH
require_env LOCAL_MEMORY_ACTOR_TOKENS_JSON
require_env LOCAL_MEMORY_ACTOR_POLICIES_JSON

if [[ -z "${UV_BIN}" ]]; then
    for candidate in \
        /home/linuxbrew/.linuxbrew/bin/uv \
        /usr/local/bin/uv \
        /usr/bin/uv
    do
        if [[ -x "${candidate}" ]]; then
            UV_BIN="${candidate}"
            break
        fi
    done
fi

if [[ -z "${UV_BIN}" || ! -x "${UV_BIN}" ]]; then
    echo "Could not find an executable uv binary. Set UV_BIN explicitly." >&2
    exit 1
fi

if [[ "${MEMORY_PROVIDER}" != "local_hindsight" ]]; then
    echo "MEMORY_PROVIDER must be local_hindsight, got: ${MEMORY_PROVIDER}" >&2
    exit 1
fi

if [[ ! -d "$(dirname "${HINDSIGHT_LOCAL_DB_PATH}")" ]]; then
    echo "Database directory does not exist: $(dirname "${HINDSIGHT_LOCAL_DB_PATH}")" >&2
    echo "Pre-provision it or run the install script after creating the env file." >&2
    exit 1
fi

export PYTHONPATH="${REPO_ROOT}:${PYTHONPATH:-}"

exec "${UV_BIN}" run --project "${AI_PROJECT_ROOT}" python -m uvicorn \
    ai.api.mcp_server.memory_server:app \
    --host "${MEMORY_SERVER_HOST:-127.0.0.1}" \
    --port "${MEMORY_SERVER_PORT:-5003}"
