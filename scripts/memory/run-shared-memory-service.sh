#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AI_PROJECT_ROOT="${REPO_ROOT}/ai"

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

exec uv run --project "${AI_PROJECT_ROOT}" python -m uvicorn \
    ai.api.mcp_server.memory_server:app \
    --host "${MEMORY_SERVER_HOST:-127.0.0.1}" \
    --port "${MEMORY_SERVER_PORT:-5003}"
