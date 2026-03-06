#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

if [[ ! -f "${LIB_DIR}/persona-regeneration-helpers.sh" ]]; then
  echo "ERROR: missing helper library at ${LIB_DIR}/persona-regeneration-helpers.sh" >&2
  exit 1
fi

source "${LIB_DIR}/persona-regeneration-helpers.sh"
source "${LIB_DIR}/runners/lightning-persona-runner.sh"

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
Usage: scripts/ovh/run-persona-regeneration-lightning.sh [options]
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

: "${TARGET_HOST:=lightning}"
TARGET_HOST_LOWER="$(echo "${TARGET_HOST}" | tr '[:upper:]' '[:lower:]')"
if [[ "${TARGET_HOST_LOWER}" != "lightning" && "${TARGET_HOST_LOWER}" != "lightning_ai" && "${TARGET_HOST_LOWER}" != "lightning-ai" ]]; then
  echo "ERROR: TARGET_HOST for this script must be one of: lightning." >&2
  exit 1
fi

if [[ "${RESUME_OVERRIDE}" == "0" ]]; then
  RESUME_FLAG=""
elif [[ "${RESUME_OVERRIDE}" == "1" ]]; then
  RESUME_FLAG="--resume"
fi

: "${MAX_RECORDS:=10000}"
: "${OUTPUT_KEY:=final_dataset/shards/curriculum/stage2/synthetic_persona_batch_${MAX_RECORDS}.jsonl}"

if [[ -z "${CHECKPOINT_JOB_NAME:-}" ]]; then
  timestamp="${TIMESTAMP:-$(date +%s)}"
  CHECKPOINT_JOB_NAME="persona-regen-${timestamp}"
fi
if [[ -z "${CHECKPOINT_S3_KEY:-}" ]]; then
  CHECKPOINT_JOB_NAME_FALLBACK="${CHECKPOINT_JOB_NAME}"
  CHECKPOINT_S3_KEY="checkpoints/persona-regeneration/${CHECKPOINT_JOB_NAME_FALLBACK}.json"
fi
export TARGET_HOST
export OUTPUT_KEY
export CHECKPOINT_JOB_NAME
export CHECKPOINT_S3_KEY

log_info "🔎 Running Persona Re-Generation launcher preflight checks."

load_env_file

if [[ -z "${OVH_S3_ACCESS_KEY:-}" || -z "${OVH_S3_SECRET_KEY:-}" ]]; then
  echo "ERROR: OVH_S3_ACCESS_KEY / OVH_S3_SECRET_KEY must be set." >&2
  exit 1
fi

NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"
DEFENSE_MODEL_S3_KEY="${DEFENSE_MODEL_S3_KEY:-}"
DEFENSE_MODEL_PATH="${DEFENSE_MODEL_PATH:-/app/tmp/model.ckpt}"

GPU_COUNT="${GPU_COUNT:-1}"
GPU_FLAVOR="${GPU_FLAVOR:-l40s-1-gpu}"
CHECKPOINT_PREFIX="${CHECKPOINT_PREFIX:-checkpoints/persona-regeneration}"
CHECKPOINT_JOB_NAME="${CHECKPOINT_JOB_NAME:-${JOB_NAME:-persona-regen-${CHECKPOINT_PREFIX##*/}}}"
CHECKPOINT_S3_KEY="${CHECKPOINT_S3_KEY:-${CHECKPOINT_PREFIX%/}/${CHECKPOINT_JOB_NAME}.json}"
CHECKPOINT_FREQUENCY="${CHECKPOINT_FREQUENCY:-250}"
INPUT_PREFIX="${INPUT_PREFIX:-final_dataset/shards/curriculum/stage2/}"
MAX_RECORDS="${MAX_RECORDS:-10000}"
S3_BUCKET="${OVH_S3_BUCKET:-pixel-data}"
S3_ENDPOINT="${OVH_S3_ENDPOINT:-https://s3.us-east-va.io.cloud.ovh.us}"
S3_REGION="${OVH_S3_REGION:-us-east-va}"

PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BATCH_SCRIPT="${LIGHTNING_BATCH_SCRIPT:-${PROJECT_ROOT}/ai/training/scripts/batch_regenerate.py}"
SLACK_NOTIFY_CONTEXT="${SLACK_NOTIFY_CONTEXT:-Persona Re-Generation}"

log_info "Checkpoint plan:"
log_info "  - Prefix: ${CHECKPOINT_PREFIX}"
log_info "  - Job name: ${CHECKPOINT_JOB_NAME}"
log_info "  - Resolved checkpoint key: ${CHECKPOINT_S3_KEY}"
log_info "  - Checkpoint write frequency: ${CHECKPOINT_FREQUENCY}"
preflight_check_env "DEFENSE_MODEL_S3_KEY" "${DEFENSE_MODEL_S3_KEY}" "defense model S3 key"

cat <<MSG
🚀 Launching Persona Re-Generation job (Lightning)
- Job Name: ${CHECKPOINT_JOB_NAME}
- Input: s3://${S3_BUCKET}/${INPUT_PREFIX}
- Output: s3://${S3_BUCKET}/${OUTPUT_KEY}
- Resume flag: ${RESUME_FLAG}
MSG

BATCH_PYTHON=""
BATCH_RUNNER_MODE="uv"
if [[ -n "${LIGHTNING_PYTHON_BIN:-}" ]]; then
  BATCH_PYTHON="$(resolve_python "${LIGHTNING_PYTHON_BIN}")"
  if [[ -z "${BATCH_PYTHON}" ]]; then
    log_warning "Configured LIGHTNING_PYTHON_BIN=${LIGHTNING_PYTHON_BIN} is not usable. Falling back to uv runtime."
  elif python_has_torch "${BATCH_PYTHON}"; then
    BATCH_RUNNER_MODE="python"
  else
    log_warning "Resolved Python interpreter (${BATCH_PYTHON}) cannot import torch. Falling back to uv."
  fi
else
  log_info "LIGHTNING_PYTHON_BIN is not set. Using uv runtime by default on Lightning."
fi

if [[ "${BATCH_RUNNER_MODE}" == "uv" ]] && ! command -v uv >/dev/null; then
  echo "ERROR: lightning host fallback requires uv, but uv is not installed."
  echo "Tip: set LIGHTNING_PYTHON_BIN to a torch-enabled python interpreter, or install uv."
  exit 1
fi

if [[ "${BATCH_RUNNER_MODE}" == "python" && ! -x "${BATCH_PYTHON}" ]]; then
  echo "ERROR: resolved Python executable is not executable: ${BATCH_PYTHON}."
  exit 1
fi

if [[ ! -f "${BATCH_SCRIPT}" ]]; then
  echo "ERROR: batch script not found at ${BATCH_SCRIPT}."
  exit 1
fi

send_conditional_slack \
  "🚀 ${SLACK_NOTIFY_CONTEXT} Starting" \
  "Target=${TARGET_HOST_LOWER}; Job=${CHECKPOINT_JOB_NAME}; Output=s3://${S3_BUCKET}/${OUTPUT_KEY}; Checkpoint=${CHECKPOINT_S3_KEY}; Max records=${MAX_RECORDS}"

run_lightning_persona_job BATCH_EXIT_STATUS
if [[ "${BATCH_EXIT_STATUS}" -eq 0 ]]; then
  if s3_object_exists "${S3_BUCKET}" "${OUTPUT_KEY}"; then
    send_conditional_slack \
      "✅ ${SLACK_NOTIFY_CONTEXT} Completed" \
      "Output artifact is now available: s3://${S3_BUCKET}/${OUTPUT_KEY}"
  else
    send_conditional_slack \
      "✅ ${SLACK_NOTIFY_CONTEXT} Completed" \
      "Job completed successfully, but s3://${S3_BUCKET}/${OUTPUT_KEY} was not yet visible in object storage."
  fi
  echo "✅ Local execution complete."
else
  send_conditional_slack \
    "❌ ${SLACK_NOTIFY_CONTEXT} Failed" \
    "Job=${CHECKPOINT_JOB_NAME} failed with exit code ${BATCH_EXIT_STATUS}. Check logs and latest checkpoint: s3://${CHECKPOINT_S3_KEY}"
  exit "${BATCH_EXIT_STATUS}"
fi
