#!/usr/bin/env bash
# Helper to launch the full training compose stack (training service + infra + NeMo designer).

set -euo pipefail

PROJECT_ROOT="/home/vivi/pixelated"
cd "$PROJECT_ROOT"

REDIS_AUDIT="${PROJECT_ROOT}/scripts/check-redis-hardening.sh"
if ! "$REDIS_AUDIT"; then
  echo "Redis hardening audit failed"
  exit 1
fi

usage() {
  cat <<'USAGE'
Usage: scripts/deploy/run-training-stack.sh [--build]

Options:
  --build   Rebuild the training-service image before starting containers.

Always:
  • Ensures shared directories exist
  • Starts redis, db, prometheus, grafana, training-service, and nemo-data-designer
USAGE
}

BUILD_FLAG=""
if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
elif [[ "${1:-}" == "--build" ]]; then
  BUILD_FLAG="--build"
fi

COMPOSE_FILE="docker/docker-compose.training.yml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file '$COMPOSE_FILE' not found." >&2
  exit 1
fi

if [[ -z "${NVIDIA_API_KEY:-}" ]]; then
  echo "Reminder: export NVIDIA_API_KEY before running to enable NeMo Data Designer." >&2
fi

mkdir -p ai/data/training models checkpoints
mkdir -p ai/dataset_pipeline/prompt_corpus
mkdir -p ai/pipelines/edge_case_pipeline_standalone/output
mkdir -p ai/training_ready/data/training_data_consolidated/final

SERVICES=(
  redis
  db
  prometheus
  grafana
  training-service
  nemo-data-designer
)

echo "Starting training stack (${SERVICES[*]}) ..."
docker compose -f "$COMPOSE_FILE" up -d $BUILD_FLAG "${SERVICES[@]}"
docker compose -f "$COMPOSE_FILE" ps
