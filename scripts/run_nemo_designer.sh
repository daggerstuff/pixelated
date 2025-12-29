#!/usr/bin/env bash
# Helper to launch NVIDIA NeMo Data Designer with the correct shared volumes.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

usage() {
  cat <<'USAGE'
Usage: scripts/run_nemo_designer.sh [--standalone]

  --standalone   Use docker-compose.nemo-data-designer.yml instead of the training stack file.

This script:
  • Ensures required directories exist (prompt corpus, edge-case output, stage exports)
  • Verifies NVIDIA_API_KEY is set
  • Starts the nemo-data-designer service in the chosen compose file
USAGE
}

COMPOSE_FILE="docker/docker-compose.training.yml"
SERVICE_NAME="nemo-data-designer"

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
elif [[ "${1:-}" == "--standalone" ]]; then
  COMPOSE_FILE="docker/docker-compose.nemo-data-designer.yml"
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file '$COMPOSE_FILE' not found. Run from project root or adjust the script." >&2
  exit 1
fi

if [[ -z "${NVIDIA_API_KEY:-}" ]]; then
  echo "NVIDIA_API_KEY must be exported in your shell before starting NeMo Data Designer." >&2
  exit 1
fi

mkdir -p ai/dataset_pipeline/prompt_corpus
mkdir -p ai/pipelines/edge_case_pipeline_standalone/output
mkdir -p ai/training_data_consolidated/final

echo "Starting $SERVICE_NAME via $COMPOSE_FILE ..."
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME"
echo "NeMo Data Designer is now available on http://localhost:8000"

