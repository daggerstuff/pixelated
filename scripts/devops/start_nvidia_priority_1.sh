#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(realpath "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"
cd "$REPO_ROOT"

log() { printf '%b\n' "$1"; }

warn() {
  printf '%b\n' "$1"
}

if ! command -v docker >/dev/null; then
  warn "⚠️ docker command not found"
  exit 1
fi

if [[ "${PIXELATED_DOCKER_RETRY:-0}" != "1" ]]; then
  if ! docker info >/dev/null 2>&1; then
    if command -v sg >/dev/null; then
      log "ℹ️  Docker socket access denied, retrying under docker group."
      exec sg docker -c "PIXELATED_DOCKER_RETRY=1 \"$SCRIPT_PATH\""
    fi
    if ! docker info >/dev/null 2>&1; then
      warn "⚠️ Docker is unavailable in this shell. Add your user to docker group and re-login, or use root."
      exit 1
    fi
  fi
fi

if [[ -f .env ]]; then
  log "📦 Loading environment from .env"
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

if [[ -f "$SCRIPT_DIR/lib/nemo-vault-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/lib/nemo-vault-env.sh"
else
  warn "⚠️ Missing helper script: $SCRIPT_DIR/lib/nemo-vault-env.sh"
  exit 1
fi

if ! load_nemo_vault_env; then
  exit 1
fi

if [[ -z "${NVIDIA_API_KEY:-}" ]]; then
  warn "⚠️ NVIDIA_API_KEY is required to run NeMo services."
  exit 1
fi

NEMO_POSTGRES_HOST="${NEMO_POSTGRES_HOST:-nemo-postgres}"
NEMO_POSTGRES_PORT="${NEMO_POSTGRES_PORT:-5432}"
NEMO_POSTGRES_USER="${NEMO_POSTGRES_USER:-${POSTGRES_USER:-}}"
NEMO_POSTGRES_PASSWORD="${NEMO_POSTGRES_PASSWORD:-${POSTGRES_PASSWORD:-}}"
NEMO_EVALUATOR_DATABASE="${NEMO_EVALUATOR_DATABASE:-evaluator}"
NEMO_ENTITY_STORE_DATABASE="${NEMO_ENTITY_STORE_DATABASE:-entitystore}"

if [[ -z "${NEMO_POSTGRES_USER}" || -z "${NEMO_POSTGRES_PASSWORD}" ]]; then
  warn "⚠️ NEMO_POSTGRES_USER and NEMO_POSTGRES_PASSWORD must be set (POSTGRES_USER/POSTGRES_PASSWORD fallback supported)."
  exit 1
fi

NEMO_EVALUATOR_IMAGE="${NEMO_EVALUATOR_IMAGE:-nvcr.io/nvidia/nemo-microservices/evaluator:25.12}"
NEMO_ENTITY_STORE_IMAGE="${NEMO_ENTITY_STORE_IMAGE:-nvcr.io/nvidia/nemo-microservices/entity-store:25.12}"
NEMO_NAMESPACE="${NEMO_NAMESPACE:-nemo}"
NEMO_EVALUATOR_DATA_STORE_URL="${NEMO_EVALUATOR_DATA_STORE_URL:-http://nemo-datastore:3000/v1/hf}"

if [[ -z "${DOCKER_CONFIG:-}" ]]; then
  DOCKER_CONFIG="$(mktemp -d /tmp/pixelated-docker.XXXXXX)"
  export DOCKER_CONFIG
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT
fi
cat >"${DOCKER_CONFIG}/config.json" <<'JSON'
{
  "auths": {}
}
JSON

if ! printf '%s' "$NVIDIA_API_KEY" | docker login nvcr.io -u '$oauthtoken' --password-stdin >/dev/null 2>&1; then
  warn "⚠️ NVCR login failed. This may block image pulls."
fi

if ! docker network inspect nemo-network >/dev/null 2>&1; then
  log "🌐 Creating nemo-network"
  docker network create nemo-network
fi

check_image() {
  local image=$1
  local manifest_output

  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi

  if manifest_output="$(docker manifest inspect "$image" 2>&1)"; then
    return 0
  fi

  case "$manifest_output" in
    *"not found"*|*"manifest unknown"*)
      return 1
      ;;
    *)
      warn "⚠️ Could not verify image availability for $image; attempting launch anyway."
      return 0
      ;;
  esac
}

run_evaluator_migrations() {
  log "🧱 Running evaluator schema migrations..."
  docker run --rm \
    --network nemo-network \
    -e "POSTGRES_URI=postgresql://${NEMO_POSTGRES_USER}:${NEMO_POSTGRES_PASSWORD}@${NEMO_POSTGRES_HOST}:${NEMO_POSTGRES_PORT}/${NEMO_EVALUATOR_DATABASE}" \
    -e "EVALUATOR_IMAGE=$NEMO_EVALUATOR_IMAGE" \
    -e "DATA_STORE_URL=$NEMO_EVALUATOR_DATA_STORE_URL" \
    -e "NAMESPACE=$NEMO_NAMESPACE" \
    --entrypoint /app/.venv/bin/alembic \
    "$NEMO_EVALUATOR_IMAGE" \
    -c /app/services/evaluator/alembic.ini upgrade head
}

run_entity_store_migrations() {
  log "🧱 Running entity-store schema migrations..."
  docker run --rm \
    --network nemo-network \
    -e "POSTGRES_URI=postgresql://${NEMO_POSTGRES_USER}:${NEMO_POSTGRES_PASSWORD}@${NEMO_POSTGRES_HOST}:${NEMO_POSTGRES_PORT}/${NEMO_ENTITY_STORE_DATABASE}" \
    --entrypoint /app/.venv/bin/python3 \
    "$NEMO_ENTITY_STORE_IMAGE" \
    -c 'import os; from alembic.config import Config; from alembic import command; cfg=Config(); cfg.set_main_option("script_location", "/app/services/entity-store/alembic"); cfg.set_main_option("sqlalchemy.url", os.environ["POSTGRES_URI"]); command.upgrade(cfg, "head")'
}

compose_files=(
  docker/docker-compose.nemo-infra.yml
)

main_compose_files=(
  docker/docker-compose.nemo-infra.yml
  docker/docker-compose.nemo-customizer.yml
  docker/docker-compose.nemo-evaluator.yml
  docker/docker-compose.nemo-retriever.yml
)

legacy_containers=(
  nemo-minio
  nemo-postgres
  nemo-datastore
  nemo-entity-store
  nemo-customizer
  nemo-evaluator
  nim-embedding
  nim-reranking
)

if [[ "${NEMO_ENABLE_CURATOR:-0}" == "1" ]]; then
  legacy_containers+=(nemo-curator)
fi

if [[ "${NEMO_ENABLE_CURATOR:-0}" == "1" ]] && check_image "${NEMO_CURATOR_IMAGE:-nvcr.io/nvidia/nemo-curator:25.09}"; then
  main_compose_files+=(docker/docker-compose.nemo-curator.yml)
else
  warn "⚠️ Curator disabled (set NEMO_ENABLE_CURATOR=1 with a valid image) to enable."
fi

for container in "${legacy_containers[@]}"; do
  if docker ps -aq --filter "name=^/${container}$" | grep -q .; then
    warn "🧹 Removing existing container $container to allow clean restart."
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
done

compose_infra=(docker compose --project-name nemo)
for f in "${compose_files[@]}"; do
  compose_infra+=( -f "$f")
done

compose_main=(docker compose --project-name nemo)
for f in "${main_compose_files[@]}"; do
  compose_main+=( -f "$f")
done

log "🚀 Starting NeMo infrastructure..."
"${compose_infra[@]}" up -d

log "⏳ Waiting for Postgres readiness..."
postgres_ready=0
for i in {1..30}; do
  if docker exec nemo-postgres pg_isready -U "$NEMO_POSTGRES_USER" >/dev/null 2>&1; then
    postgres_ready=1
    break
  fi
  sleep 1
done
if [[ "$postgres_ready" -ne 1 ]]; then
  warn "⚠️ Postgres did not become ready before migration step."
  exit 1
fi

log "🧱 Ensuring required NeMo databases exist..."
for db in customizer evaluator entitystore; do
  docker exec nemo-postgres psql -U "$NEMO_POSTGRES_USER" -tc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1 || \
    docker exec nemo-postgres psql -U "$NEMO_POSTGRES_USER" -c "CREATE DATABASE ${db};"
done

run_entity_store_migrations
run_evaluator_migrations

log "🚀 Starting Priority 1 NeMo services..."
"${compose_main[@]}" up -d

if ! "${compose_main[@]}" ps; then
  warn "⚠️ Could not read service status after launch."
fi

log "✅ NeMo Priority 1 stack launch command complete."
