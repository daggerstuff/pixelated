#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/devops/start_lightning_stage1.sh

Launch Stage 1 foundation training using the Lightning CLI.

Required:
  - LIGHTNING_STUDIO=<studio_name>  (to run against a studio), or
  - LIGHTNING_IMAGE=<docker_image>  (to run against a container image)

Optional:
  LIGHTNING_STUDIO_PATH=<path>   Working directory inside the studio (when using studio)
  LIGHTNING_STAGE=1              Training stage (default: 1)
  LIGHTNING_MAX_STEPS=100000     Max training steps (default: 100000)
  LIGHTNING_DRY_RUN=1            Set to 1 for GPU smoke run
  LIGHTNING_MACHINE=H100          Lightning machine flavor (default: H100)
  LIGHTNING_JOB_NAME=<name>       Custom job name
  LIGHTNING_REPO_URL=<url>        Git URL to clone when using image mode
  LIGHTNING_REPO_DIR=<dir>        Local clone directory in image mode (default: pixelated-lightning)

Examples:
  LIGHTNING_STUDIO=my-studio uv run lightning run ...  # use studio
  LIGHTNING_IMAGE=ghcr.io/org/image:tag LIGHTNING_REPO_URL=https://github.com/org/repo.git uv run ...
  # Secrets (WANDB_API_KEY, OVH_S3_SECRET_KEY, HF_TOKEN, etc.) must be configured in your Lightning workspace/env, not passed on the command line.
USAGE
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv is required for this launch flow."
  exit 1
fi
if ! uv run lightning --help >/dev/null 2>&1; then
  echo "ERROR: lightning CLI is not available in uv environment."
  exit 1
fi

JOB_NAME="${LIGHTNING_JOB_NAME:-pixelated-stage1-foundation-$(date +%Y%m%d-%H%M%S)}"
MACHINE="${LIGHTNING_MACHINE:-H100}"
STAGE="${LIGHTNING_STAGE:-1}"
DRY_RUN_FLAG="${LIGHTNING_DRY_RUN:-0}"
MAX_STEPS="${LIGHTNING_MAX_STEPS:-100000}"
BASE_COMMAND="uv run python ai/orchestrator/targets/lightning_production/train_therapeutic_ai.py --stage ${STAGE} --compute-backend gpu --max-steps ${MAX_STEPS}"

if [[ "${DRY_RUN_FLAG}" == "1" ]]; then
  BASE_COMMAND="${BASE_COMMAND} --dry-run --data-path ai/data/compress/processed/sample_conversations.json --base-model gpt2 --skip-lora"
fi

LIGHTNING_IMAGE="${LIGHTNING_IMAGE:-}"
LIGHTNING_STUDIO="${LIGHTNING_STUDIO:-}"
LIGHTNING_STUDIO_PATH="${LIGHTNING_STUDIO_PATH:-}"

if [[ -z "${LIGHTNING_IMAGE}" && -z "${LIGHTNING_STUDIO}" ]]; then
  echo "ERROR: Set either LIGHTNING_IMAGE (docker image) or LIGHTNING_STUDIO (preconfigured studio) before launch."
  exit 1
fi

if [[ -n "${LIGHTNING_IMAGE}" && -n "${LIGHTNING_STUDIO}" ]]; then
  echo "ERROR: LIGHTNING_IMAGE and LIGHTNING_STUDIO are mutually exclusive."
  exit 1
fi

echo "⚡ Launching Stage 1 training via lightning CLI."
echo "Machine: ${MACHINE}"
echo "Job name: ${JOB_NAME}"

LIGHTNING_ENV_ARGS=()
for env_key in \
  WANDB_ENTITY \
  WANDB_PROJECT \
  WANDB_DISABLED \
  WANDB_NAME \
  S3_BUCKET \
  OVH_S3_ACCESS_KEY \
  OVH_S3_ENDPOINT \
  OVH_S3_REGION \
  OVH_S3_BUCKET \
  TRAIN_DATA_PATH \
  CUDA_VISIBLE_DEVICES; do
  if [[ -n "${!env_key:-}" ]]; then
    LIGHTNING_ENV_ARGS+=(--env "${env_key}=${!env_key}")
  fi
done

if [[ -n "${LIGHTNING_IMAGE}" ]]; then
  if [[ -z "${LIGHTNING_REPO_URL:-}" ]]; then
    echo "ERROR: LIGHTNING_REPO_URL is required when using LIGHTNING_IMAGE."
    exit 1
  fi
  REPO_DIR="${LIGHTNING_REPO_DIR:-pixelated-lightning}"
  LAUNCH_COMMAND="git clone --depth 1 ${LIGHTNING_REPO_URL} ${REPO_DIR} && cd ${REPO_DIR} && ${BASE_COMMAND}"
  uv run lightning run job \
    --name "${JOB_NAME}" \
    --machine "${MACHINE}" \
    --image "${LIGHTNING_IMAGE}" \
    "${LIGHTNING_ENV_ARGS[@]}" \
    --command "${LAUNCH_COMMAND}"
  exit 0
fi

if [[ -n "${LIGHTNING_STUDIO_PATH}" ]]; then
  LAUNCH_COMMAND="cd ${LIGHTNING_STUDIO_PATH} && ${BASE_COMMAND}"
else
  LAUNCH_COMMAND="${BASE_COMMAND}"
fi

uv run lightning run job \
  --name "${JOB_NAME}" \
  --machine "${MACHINE}" \
  --studio "${LIGHTNING_STUDIO}" \
  "${LIGHTNING_ENV_ARGS[@]}" \
  --command "${LAUNCH_COMMAND}"
