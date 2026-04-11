#!/usr/bin/env bash
set -euo pipefail
HETZNER_AI_CLI="${HETZNER_AI_CLI:-ovhai}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

if [[ ! -f "${LIB_DIR}/persona-regeneration-helpers.sh" ]]; then
  echo "ERROR: missing helper library at ${LIB_DIR}/persona-regeneration-helpers.sh" >&2
  exit 1
fi

source "${LIB_DIR}/persona-regeneration-helpers.sh"
source "${LIB_DIR}/runners/hetzner-persona-runner.sh"

RUN_MODE="${RUN_MODE:-manual}"
AUTOMATION_MODE="${AUTOMATION_MODE:-0}"
SEND_STARTUP_NOTIFICATION="${SEND_STARTUP_NOTIFICATION:-1}"
if [[ "${RUN_MODE}" == "scheduler" || "${AUTOMATION_MODE}" == "1" ]]; then
  SEND_STARTUP_NOTIFICATION="0"
fi
RESUME_OVERRIDE=""
RESUME_FLAG="--resume"

parse_runtime_overrides() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --target|--host)
        TARGET_HOST="$2"
        shift 2
        ;;
      --mode)
        RUN_MODE="$2"
        shift 2
        ;;
      --job-name)
        JOB_NAME="$2"
        shift 2
        ;;
      --output-key)
        OUTPUT_KEY="$2"
        shift 2
        ;;
      --max-records)
        MAX_RECORDS="$2"
        shift 2
        ;;
      --checkpoint-job-name)
        CHECKPOINT_JOB_NAME="$2"
        shift 2
        ;;
      --checkpoint-s3-key)
        CHECKPOINT_S3_KEY="$2"
        shift 2
        ;;
      --resume)
        RESUME_OVERRIDE=1
        RESUME_FLAG="--resume"
        shift
        ;;
      --no-resume)
        RESUME_OVERRIDE=0
        RESUME_FLAG=""
        shift
        ;;
      --notify-on-start)
        SEND_STARTUP_NOTIFICATION=1
        shift
        ;;
      --no-notify)
        SEND_STARTUP_NOTIFICATION=0
        shift
        ;;
      --help|-h)
        cat <<'USAGE'
Usage: scripts/hetzner/run-persona-regeneration-hetzner.sh [options]
  --job-name <name>
  --output-key <s3 key>
  --max-records <n>
  --checkpoint-job-name <name>
  --checkpoint-s3-key <s3 key>
  --mode manual|scheduler
  --resume / --no-resume
  --notify-on-start / --no-notify
USAGE
        exit 0
        ;;
      *)
        echo "WARNING: unknown argument '$1' ignored" >&2
        shift
        ;;
    esac
  done
}

send_conditional_slack() {
  local title="$1"
  local message="$2"
  if [[ "${SEND_STARTUP_NOTIFICATION}" != "1" ]]; then
    return 0
  fi
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    send_slack_notification "${title}" "${message}"
  fi
}

parse_runtime_overrides "$@"

if [[ "${RUN_MODE}" == "scheduler" || "${AUTOMATION_MODE}" == "1" ]]; then
  SEND_STARTUP_NOTIFICATION="0"
fi

TARGET_HOST="${TARGET_HOST:-${TRAINING_HOST:-hetzner}}"
TARGET_HOST_LOWER="$(echo "${TARGET_HOST}" | tr '[:upper:]' '[:lower:]')"
case "${TARGET_HOST_LOWER}" in
  hetzner)
    ;;
  *)
    echo "ERROR: TARGET_HOST for this script must be: hetzner." >&2
    exit 1
    ;;
esac

if ! command -v docker >/dev/null; then
  echo "ERROR: docker is required but not found in PATH." >&2
  exit 1
fi

if ! command -v ${HETZNER_AI_CLI} >/dev/null; then
  echo "ERROR: ${HETZNER_AI_CLI} CLI is required for Hetzner target and was not found in PATH." >&2
  exit 1
fi

# Keep legacy builder by default for stable image builds in this environment.
DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}"
export DOCKER_BUILDKIT
log_info "🔎 Running Persona Re-Generation launcher preflight checks."
log_info "Using legacy Docker builder setting: DOCKER_BUILDKIT=${DOCKER_BUILDKIT}"

if [[ -z "${HETZNER_AI_REGISTRY:-}" ]]; then
  # Default to docker.io if not set, but warn
  echo "WARNING: HETZNER_AI_REGISTRY not set. Defaulting to docker.io/pixelatedempathy/"
  export HETZNER_AI_REGISTRY="docker.io/pixelatedempathy/"
fi

load_env_file

if [[ -z "${HETZNER_S3_ACCESS_KEY:-}" || -z "${HETZNER_S3_SECRET_KEY:-}" ]]; then
  echo "ERROR: HETZNER_S3_ACCESS_KEY / HETZNER_S3_SECRET_KEY must be set." >&2
  exit 1
fi

if [[ -n "${HETZNER_AI_TOKEN:-}" ]]; then
  if ${HETZNER_AI_CLI} --token "${HETZNER_AI_TOKEN}" me >/tmp/hetzner_ai_preflight.log 2>&1; then
    log_info "${HETZNER_AI_CLI} authentication preflight check passed using HETZNER_AI_TOKEN."
  elif ! ${HETZNER_AI_CLI} me >/tmp/hetzner_ai_preflight.log 2>&1; then
    echo "ERROR: ${HETZNER_AI_CLI} authentication is not valid. Run: ${HETZNER_AI_CLI} login" >&2
    echo "----- begin hetzner_ai preflight output -----"
    cat /tmp/hetzner_ai_preflight.log
    echo "----- end hetzner_ai preflight output -----"
    exit 1
  else
    log_info "${HETZNER_AI_CLI} authentication preflight check passed using active session."
  fi
else
  if ! ${HETZNER_AI_CLI} me >/tmp/hetzner_ai_preflight.log 2>&1; then
    echo "ERROR: ${HETZNER_AI_CLI} authentication is not valid. Run: ${HETZNER_AI_CLI} login" >&2
    echo "----- begin hetzner_ai preflight output -----"
    cat /tmp/hetzner_ai_preflight.log
    echo "----- end hetzner_ai preflight output -----"
    exit 1
  fi
  log_info "${HETZNER_AI_CLI} authentication preflight check passed."
fi

NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"
DEFENSE_MODEL_S3_KEY="${DEFENSE_MODEL_S3_KEY:-}"
DEFENSE_MODEL_PATH="${DEFENSE_MODEL_PATH:-/app/tmp/model.ckpt}"

VERSION_TAG="v$(date +%s)"
IMAGE_NAME="training-node"
FULL_IMAGE_NAME="${HETZNER_AI_REGISTRY}${IMAGE_NAME}:${VERSION_TAG}"

echo "🔨 Building image: ${FULL_IMAGE_NAME}"
docker build --target production -t "${FULL_IMAGE_NAME}" ./ai

echo "⬆️ Pushing image: ${FULL_IMAGE_NAME}"
docker push "${FULL_IMAGE_NAME}"

JOB_NAME="${JOB_NAME:-persona-regen-${VERSION_TAG}}"
GPU_COUNT="${GPU_COUNT:-1}"
GPU_FLAVOR="${GPU_FLAVOR:-l40s-1-gpu}"
CHECKPOINT_PREFIX="${CHECKPOINT_PREFIX:-checkpoints/persona-regeneration}"
CHECKPOINT_JOB_NAME="${CHECKPOINT_JOB_NAME:-${JOB_NAME}}"
CHECKPOINT_S3_KEY="${CHECKPOINT_S3_KEY:-${CHECKPOINT_PREFIX%/}/${CHECKPOINT_JOB_NAME}.json}"
CHECKPOINT_FREQUENCY="${CHECKPOINT_FREQUENCY:-250}"

log_info "Checkpoint plan:"
log_info "  - Prefix: ${CHECKPOINT_PREFIX}"
log_info "  - Job name: ${CHECKPOINT_JOB_NAME}"
log_info "  - Resolved checkpoint key: ${CHECKPOINT_S3_KEY}"
log_info "  - Checkpoint write frequency: ${CHECKPOINT_FREQUENCY}"
preflight_check_env "DEFENSE_MODEL_S3_KEY" "${DEFENSE_MODEL_S3_KEY}" "defense model S3 key"

INPUT_PREFIX="${INPUT_PREFIX:-final_dataset/shards/curriculum/stage2/}"
OUTPUT_KEY="${OUTPUT_KEY:-final_dataset/shards/curriculum/stage2/synthetic_persona_batch_5k.jsonl}"
MAX_RECORDS="${MAX_RECORDS:-5000}"

S3_BUCKET="${HETZNER_S3_BUCKET:-pixel-data}"
S3_ENDPOINT="${HETZNER_S3_ENDPOINT:-https://hel1.your-objectstorage.com}"
S3_REGION="${HETZNER_S3_REGION:-hel1}"
S3_CA_BUNDLE="${HETZNER_S3_CA_BUNDLE:-false}"

PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BATCH_SCRIPT="${LIGHTNING_BATCH_SCRIPT:-${PROJECT_ROOT}/ai/training/scripts/batch_regenerate.py}"
SLACK_NOTIFY_CONTEXT="${SLACK_NOTIFY_CONTEXT:-Persona Re-Generation}"

cat <<MSG
🚀 Launching Persona Re-Generation job (Hetzner)
- Job Name: ${JOB_NAME}
- Image: ${FULL_IMAGE_NAME}
- GPU: ${GPU_COUNT} (${GPU_FLAVOR})
- Input: s3://${S3_BUCKET}/${INPUT_PREFIX}
- Output: s3://${S3_BUCKET}/${OUTPUT_KEY}
MSG

if [[ ! -f "${BATCH_SCRIPT}" ]]; then
  echo "ERROR: batch script not found at ${BATCH_SCRIPT}."
  exit 1
fi

BATCH_PYTHON="${LIGHTNING_PYTHON_BIN:-/app/.venv/bin/python}"
BATCH_RUNNER_MODE="python"
if [[ -z "${BATCH_PYTHON}" || ! -x "${BATCH_PYTHON}" ]]; then
  echo "ERROR: no usable python executable found for Hetzner host." >&2
  exit 1
fi

run_hetzner_persona_job
echo "✅ Job submitted with UUID recorded in Hetzner dashboard."
send_conditional_slack \
  "⚪ ${SLACK_NOTIFY_CONTEXT} Submitted" \
  "Target=${TARGET_HOST_LOWER}; Job=${JOB_NAME}; Output=s3://${S3_BUCKET}/${OUTPUT_KEY}; Checkpoint=${CHECKPOINT_S3_KEY}; Max records=${MAX_RECORDS}"
