#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/devops/start_lightning_stage1.sh

Launch Stage 1 foundation training using the Lightning CLI.

Required:
  - LIGHTNING_STUDIO=<studio_name>  (to run against a specific studio), or
  - LIGHTNING_IMAGE=<docker_image>  (to run against a container image)

Optional:
  LIGHTNING_STUDIO_PATH=<path>   Working directory inside the studio (when using studio)
  LIGHTNING_STAGE=1              Training stage (default: 1)
  LIGHTNING_MAX_STEPS=100000     Max training steps (default: 100000)
  LIGHTNING_DRY_RUN=1            Set to 1 for GPU smoke run
  LIGHTNING_MACHINE=<machine>      Machine flavor (default: H100; set A100_X_2 for 2-GPU A100).
  LIGHTNING_MACHINE_FALLBACK=A100_X_2  Machine fallback if H100 is not provisioned in time. Use A100_X_2 for 2-GPU fallback.
  LIGHTNING_MACHINE_FALLBACK_TIMEOUT_SECONDS=3600  Max seconds to wait for H100 before fallback
  LIGHTNING_MACHINE_SEARCH_INTERVAL_SECONDS=60       Poll interval while waiting for H100
  LIGHTNING_JOB_NAME=<name>       Custom job name
  LIGHTNING_REPO_URL=<url>        Git URL to clone when using image mode
  LIGHTNING_REPO_DIR=<dir>        Local clone directory in image mode (default: pixelated-lightning)
  LIGHTNING_AUTO_RESOLVE_STUDIO=1  Enable auto studio resolution when LIGHTNING_STUDIO is unset/empty/placeholder (default: 1)
  LIGHTNING_TRAIN_WORKERS=<n>     Override training DataLoader num_workers
  UV_PRUNE_CACHE=1                Optional one-time uv cache prune before launch

Examples:
  LIGHTNING_STUDIO=my-studio uv run lightning run ...  # use studio
  LIGHTNING_IMAGE=ghcr.io/org/image:tag LIGHTNING_REPO_URL=https://github.com/org/repo.git uv run ...
  # Secrets (WANDB_API_KEY, OVH_S3_SECRET_KEY, HF_TOKEN, etc.) must be configured in your Lightning workspace/env, not passed on the command line.
  # If LIGHTNING_STUDIO is omitted, the launcher auto-resolves it from your Lightning credentials.
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
if [[ "${UV_PRUNE_CACHE:-0}" == "1" ]]; then
  echo "[cache] Pruning uv cache before launch..."
  uv cache prune --ci --force
  echo
fi

JOB_NAME="${LIGHTNING_JOB_NAME:-pixelated-stage1-foundation-$(date +%Y%m%d-%H%M%S)}"
MACHINE="${LIGHTNING_MACHINE:-H100}"
MACHINE_FALLBACK="${LIGHTNING_MACHINE_FALLBACK:-A100_X_2}"
MACHINE_FALLBACK_TIMEOUT_SECONDS="${LIGHTNING_MACHINE_FALLBACK_TIMEOUT_SECONDS:-3600}"
MACHINE_SEARCH_INTERVAL_SECONDS="${LIGHTNING_MACHINE_SEARCH_INTERVAL_SECONDS:-60}"
STAGE="${LIGHTNING_STAGE:-1}"
DRY_RUN_FLAG="${LIGHTNING_DRY_RUN:-0}"
MAX_STEPS="${LIGHTNING_MAX_STEPS:-100000}"
TRAIN_WORKERS="${LIGHTNING_TRAIN_WORKERS:-}"
STAGE1_TRAINING_SCRIPT="ai/orchestrator/targets/lightning_production/train_therapeutic_ai.py"
BASE_COMMAND="uv run python ${STAGE1_TRAINING_SCRIPT} --stage ${STAGE} --compute-backend gpu --max-steps ${MAX_STEPS}"

if [[ "${DRY_RUN_FLAG}" == "1" ]]; then
  BASE_COMMAND="${BASE_COMMAND} --dry-run --data-path ai/data/compress/processed/sample_conversations.json --base-model gpt2 --skip-lora"
fi

if [[ -n "${TRAIN_WORKERS}" ]]; then
  BASE_COMMAND="${BASE_COMMAND} --num-workers ${TRAIN_WORKERS}"
fi
LIGHTNING_IMAGE="${LIGHTNING_IMAGE:-}"
LIGHTNING_STUDIO="${LIGHTNING_STUDIO:-}"
LIGHTNING_STUDIO_PATH="${LIGHTNING_STUDIO_PATH:-}"
LIGHTNING_USERNAME="${LIGHTNING_USERNAME:-}"
LIGHTNING_TEAMSPACE="${LIGHTNING_TEAMSPACE:-}"
LIGHTNING_OWNER_TYPE="${LIGHTNING_OWNER_TYPE:-}"
LIGHTNING_PROJECT_ID="${LIGHTNING_PROJECT_ID:-}"
LIGHTNING_AUTO_RESOLVE_STUDIO="${LIGHTNING_AUTO_RESOLVE_STUDIO:-1}"
if [[ -z "${LIGHTNING_REPO_URL:-}" ]]; then
  LIGHTNING_REPO_URL="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
fi
CREDENTIALS_FILE="${HOME}/.lightning/credentials.json"

resolve_lightning_context_values() {
  local creds_path="${1:?missing credentials path}"
  local require_studio="${2:-0}"
  local resolved_context
  local resolved_parts

  if ! resolved_context="$(uv run python scripts/devops/resolve_lightning_context.py --creds-path "${creds_path}" --format lines $(
    [[ "${require_studio}" == "1" ]] && echo "--require-studio"
    [[ "${require_studio}" == "1" && -n "${LIGHTNING_MACHINE}" ]] && echo "--machine ${LIGHTNING_MACHINE}"
  ))"; then
    return 1
  fi

  if [[ -z "${resolved_context}" ]]; then
    return 3
  fi
  mapfile -t resolved_parts <<< "${resolved_context}"
  local resolved_username="${resolved_parts[0]:-}"
  local resolved_teamspace="${resolved_parts[1]:-}"
  local resolved_project_id="${resolved_parts[2]:-}"
  local resolved_studio="${resolved_parts[3]:-}"
  local resolved_owner_type="${resolved_parts[4]:-}"
  if [[ -z "${resolved_username}" || -z "${resolved_teamspace}" || -z "${resolved_owner_type}" ]]; then
    return 4
  fi

  if [[ "${require_studio}" == "1" && -z "${resolved_studio}" ]]; then
    return 5
  fi

  printf "%s\n%s\n%s\n%s\n%s" \
    "${resolved_username}" \
    "${resolved_teamspace}" \
    "${resolved_project_id}" \
    "${resolved_studio}" \
    "${resolved_owner_type}"
}

if [[ "${LIGHTNING_AUTO_RESOLVE_STUDIO:-1}" == "1" && -z "${LIGHTNING_IMAGE}" ]]; then
  STUDIO_TOKEN_LOWER="${LIGHTNING_STUDIO,,}"
  if [[ -z "${LIGHTNING_STUDIO}" || "${STUDIO_TOKEN_LOWER}" == "..." || "${STUDIO_TOKEN_LOWER}" == "auto" || "${STUDIO_TOKEN_LOWER}" == "auto-resolve" ]]; then
    echo "⚙️  Auto-resolving LIGHTNING_STUDIO from local Lightning session..."
    if [[ ! -f "${CREDENTIALS_FILE}" ]]; then
      echo "ERROR: ~/.lightning/credentials.json not found. Set LIGHTNING_STUDIO manually."
      exit 1
    fi

    if ! RESOLVED_VALUES="$(resolve_lightning_context_values "${CREDENTIALS_FILE}" 1)"; then
      echo "ERROR: Failed to auto-resolve Lightning context. Set LIGHTNING_STUDIO manually."
      echo "If this teamspace has no active studio, create one in the Lightning UI and rerun with LIGHTNING_STUDIO=<studio-name>."
      echo "Or use image mode by setting LIGHTNING_IMAGE=<image-ref> and (optionally) LIGHTNING_REPO_URL=<repo-url>."
      exit 1
    else
      mapfile -t RESOLVED_PARTS <<< "${RESOLVED_VALUES}"
      RESOLVED_USERNAME="${RESOLVED_PARTS[0]:-}"
      RESOLVED_TEAMSPACE="${RESOLVED_PARTS[1]:-}"
      RESOLVED_PROJECT_ID="${RESOLVED_PARTS[2]:-}"
      RESOLVED_STUDIO="${RESOLVED_PARTS[3]:-}"
      RESOLVED_OWNER_TYPE="${RESOLVED_PARTS[4]:-}"
      if [[ -z "${RESOLVED_USERNAME}" || -z "${RESOLVED_TEAMSPACE}" || -z "${RESOLVED_STUDIO}" || -z "${RESOLVED_OWNER_TYPE}" ]]; then
        echo "ERROR: Failed to parse auto-resolved Lightning context payload."
        exit 1
      fi

      if [[ -z "${RESOLVED_USERNAME}" || -z "${RESOLVED_TEAMSPACE}" || -z "${RESOLVED_STUDIO}" ]]; then
        echo "ERROR: Auto-resolution returned incomplete context. Set LIGHTNING_STUDIO manually."
        exit 1
      fi

      if [[ -z "${LIGHTNING_USERNAME}" ]]; then
        LIGHTNING_USERNAME="${RESOLVED_USERNAME}"
      fi
      if [[ -z "${LIGHTNING_TEAMSPACE}" ]]; then
        LIGHTNING_TEAMSPACE="${RESOLVED_TEAMSPACE}"
      fi
      if [[ -z "${LIGHTNING_PROJECT_ID}" ]]; then
        LIGHTNING_PROJECT_ID="${RESOLVED_PROJECT_ID}"
      fi
      if [[ -z "${LIGHTNING_OWNER_TYPE}" ]]; then
        LIGHTNING_OWNER_TYPE="${RESOLVED_OWNER_TYPE}"
      fi
      LIGHTNING_STUDIO="${RESOLVED_STUDIO}"
    fi
  fi
fi

if [[ -z "${LIGHTNING_STUDIO}" && -z "${LIGHTNING_IMAGE}" ]]; then
  if [[ ! -f "${CREDENTIALS_FILE}" ]]; then
    echo "ERROR: ~/.lightning/credentials.json not found. Set LIGHTNING_STUDIO manually."
    exit 1
  fi
fi

if [[ -n "${LIGHTNING_STUDIO}" && ( -z "${LIGHTNING_TEAMSPACE}" || -z "${LIGHTNING_USERNAME}" || -z "${LIGHTNING_OWNER_TYPE}" ) ]]; then
  if ! RESOLVED_VALUES="$(resolve_lightning_context_values "${CREDENTIALS_FILE}" 0)"; then
    echo "ERROR: Studio mode requires teamspace context, but auto-resolution for --teamspace failed."
    echo "Set LIGHTNING_TEAMSPACE and LIGHTNING_USERNAME (or LIGHTNING_OWNER_TYPE=organization|user) when using LIGHTNING_STUDIO."
    exit 1
  fi

  mapfile -t RESOLVED_PARTS <<< "${RESOLVED_VALUES}"
  RESOLVED_USERNAME="${RESOLVED_PARTS[0]:-}"
  RESOLVED_TEAMSPACE="${RESOLVED_PARTS[1]:-}"
  RESOLVED_PROJECT_ID="${RESOLVED_PARTS[2]:-}"
  RESOLVED_STUDIO="${RESOLVED_PARTS[3]:-}"
  RESOLVED_OWNER_TYPE="${RESOLVED_PARTS[4]:-}"

  if [[ -z "${LIGHTNING_TEAMSPACE}" ]]; then
    LIGHTNING_TEAMSPACE="${RESOLVED_TEAMSPACE}"
  fi
  if [[ -z "${LIGHTNING_USERNAME}" ]]; then
    LIGHTNING_USERNAME="${RESOLVED_USERNAME}"
  fi
  if [[ -z "${LIGHTNING_PROJECT_ID}" ]]; then
    LIGHTNING_PROJECT_ID="${RESOLVED_PROJECT_ID}"
  fi
  if [[ -z "${LIGHTNING_OWNER_TYPE}" ]]; then
    LIGHTNING_OWNER_TYPE="${RESOLVED_OWNER_TYPE}"
  fi
fi

if [[ -n "${MACHINE_FALLBACK}" && -z "${LIGHTNING_PROJECT_ID}" ]]; then
  if ! RESOLVED_VALUES="$(resolve_lightning_context_values "${CREDENTIALS_FILE}" 0)"; then
    echo "⚠️  Could not resolve Lightning project ID. Fallback waiting logic will be disabled."
  else
    mapfile -t RESOLVED_PARTS <<< "${RESOLVED_VALUES}"
    RESOLVED_PROJECT_ID="${RESOLVED_PARTS[2]:-}"
    LIGHTNING_PROJECT_ID="${RESOLVED_PROJECT_ID}"
  fi
fi

if [[ -z "${LIGHTNING_IMAGE}" && -z "${LIGHTNING_STUDIO}" ]]; then
  echo "ERROR: Could not resolve LIGHTNING_STUDIO from session. Set LIGHTNING_STUDIO manually."
  exit 1
fi

if [[ -n "${LIGHTNING_IMAGE}" && -n "${LIGHTNING_STUDIO}" ]]; then
  echo "ERROR: LIGHTNING_IMAGE and LIGHTNING_STUDIO are mutually exclusive."
  exit 1
fi

echo "⚡ Launching Stage 1 training via lightning CLI."
echo "Machine: ${MACHINE}"
echo "Job name: ${JOB_NAME}"
if [[ -n "${MACHINE_FALLBACK}" ]]; then
  echo "Fallback machine: ${MACHINE_FALLBACK} (after ${MACHINE_FALLBACK_TIMEOUT_SECONDS}s)"
fi

LIGHTNING_ENV_ARGS=()
for env_key in \
  WANDB_ENTITY \
  WANDB_PROJECT \
  WANDB_DISABLED \
  WANDB_NAME \
  S3_BUCKET \
  OVH_S3_ENDPOINT \
  OVH_S3_REGION \
  OVH_S3_BUCKET \
  TRAIN_DATA_PATH \
  CUDA_VISIBLE_DEVICES; do
  if [[ -n "${!env_key:-}" ]]; then
    LIGHTNING_ENV_ARGS+=(--env "${env_key}=${!env_key}")
  fi
done

TEAMSPACE_ARGS=()
if [[ -n "${LIGHTNING_USERNAME}" && -n "${LIGHTNING_TEAMSPACE}" ]]; then
  TEAMSPACE_ARGS=(--teamspace "${LIGHTNING_TEAMSPACE}")
  if [[ "${LIGHTNING_OWNER_TYPE}" == "user" ]]; then
    TEAMSPACE_ARGS+=(--user "${LIGHTNING_USERNAME}")
  elif [[ "${LIGHTNING_OWNER_TYPE}" == "organization" ]]; then
    TEAMSPACE_ARGS+=(--org "${LIGHTNING_USERNAME}")
  fi
fi

if [[ -n "${LIGHTNING_STUDIO_PATH}" ]]; then
  LAUNCH_COMMAND="if [ ! -d \"${LIGHTNING_STUDIO_PATH}\" ]; then
    echo \"ERROR: LIGHTNING_STUDIO_PATH does not exist: ${LIGHTNING_STUDIO_PATH}\"
    exit 1
  fi
  cd ${LIGHTNING_STUDIO_PATH}
  ${BASE_COMMAND}"
else
  LAUNCH_COMMAND="WORKDIR=\"\$(pwd)\"
TRAINING_SCRIPT=\"${STAGE1_TRAINING_SCRIPT}\"
if [ -f \"\${WORKDIR}/\${TRAINING_SCRIPT}\" ]; then
  :
elif [ -f \"/home/zeus/pixelated/\${TRAINING_SCRIPT}\" ]; then
  WORKDIR=\"/home/zeus/pixelated\"
elif [ -f \"/home/vivi/pixelated/\${TRAINING_SCRIPT}\" ]; then
  WORKDIR=\"/home/vivi/pixelated\"
elif [ -f \"/workspace/\${TRAINING_SCRIPT}\" ]; then
  WORKDIR=\"/workspace\"
elif [ -f \"/workspace/pixelated/\${TRAINING_SCRIPT}\" ]; then
  WORKDIR=\"/workspace/pixelated\"
elif [ -n \"${LIGHTNING_REPO_URL}\" ]; then
  WORKDIR=\"\$(mktemp -d)\"
  if ! git clone --depth 1 \"${LIGHTNING_REPO_URL}\" \"\${WORKDIR}\"; then
    echo \"ERROR: Failed to clone repository from ${LIGHTNING_REPO_URL}\"
    exit 1
  fi
  if [ ! -f \"\${WORKDIR}/\${TRAINING_SCRIPT}\" ]; then
    echo \"ERROR: Cloned repository missing \${TRAINING_SCRIPT} at \${WORKDIR}\"
    exit 1
  fi
else
  echo \"ERROR: Could not locate Stage 1 training script in this studio.\"
  echo \"Set LIGHTNING_STUDIO_PATH to your repo path, or LIGHTNING_REPO_URL for clone fallback.\"
  exit 1
fi
cd \"\${WORKDIR}\"
${BASE_COMMAND}"
fi

run_lightning_job() {
  local job_name="$1"
  local machine="$2"
  local launch_command="$3"

  if [[ -n "${LIGHTNING_IMAGE}" ]]; then
    if [[ -z "${LIGHTNING_REPO_URL:-}" ]]; then
      echo "ERROR: LIGHTNING_REPO_URL is required when using LIGHTNING_IMAGE."
      return 1
    fi
    local repo_dir="${LIGHTNING_REPO_DIR:-pixelated-lightning}"
    local image_command="git clone --depth 1 ${LIGHTNING_REPO_URL} ${repo_dir} && cd ${repo_dir} && ${launch_command}"
    uv run lightning run job \
      --name "${job_name}" \
      --machine "${machine}" \
      --image "${LIGHTNING_IMAGE}" \
      "${LIGHTNING_ENV_ARGS[@]}" \
      --command "${image_command}"
    return 0
  fi

  uv run lightning run job \
    --name "${job_name}" \
    --machine "${machine}" \
    --studio "${LIGHTNING_STUDIO}" \
    "${TEAMSPACE_ARGS[@]}" \
    "${LIGHTNING_ENV_ARGS[@]}" \
    --command "${launch_command}"
}

get_job_state() {
  local project_id="$1"
  local job_name="$2"

  local state
  local python_code
python_code=$'import json\nimport os\nimport requests\nfrom pathlib import Path\n\ncredentials_path = os.environ.get("LIGHTNING_CREDENTIALS_PATH")\nif not credentials_path:\n    raise SystemExit(1)\ncreds = json.loads(Path(credentials_path).read_text())\nurl = "https://lightning.ai/v1/projects/%s/jobs?standalone=True" % os.environ["LIGHTNING_PROJECT_ID"]\nresponse = requests.get(url, auth=(creds["user_id"], creds["api_key"]), headers={\"Accept\": \"application/json\"}, timeout=10)\nif response.status_code != 200:\n    raise SystemExit(1)\nfor job in response.json().get("jobs", []):\n    if job.get("name") == os.environ["LIGHTNING_JOB_NAME"]:\n        print(job.get("state") or job.get("status") or "unknown")\n        raise SystemExit(0)\nprint("not_found")\n'
  if ! state="$(LIGHTNING_CREDENTIALS_PATH="${CREDENTIALS_FILE}" LIGHTNING_PROJECT_ID="${project_id}" LIGHTNING_JOB_NAME="${job_name}" uv run python -c "${python_code}")"; then
    echo "unknown"
    return 0
  fi
  printf '%s\n' "${state:-not_found}"
}

wait_for_h100_search_window() {
  local job_name="$1"
  local project_id="$2"
  local timeout_seconds="$3"
  local poll_seconds="$4"

  local start_ts
  local current_ts
  local state
  local remaining_seconds
  start_ts="$(date +%s)"

  while true; do
    state="$(get_job_state "${project_id}" "${job_name}")"
    current_ts="$(date +%s)"
    remaining_seconds=$((timeout_seconds - (current_ts - start_ts)))

    case "${state}" in
      creating|pending|running)
        if (( remaining_seconds <= 0 )); then
          echo "Timeout reached while waiting for H100 (${MACHINE_FALLBACK_TIMEOUT_SECONDS}s). Triggering fallback."
          return 1
        fi
        echo "H100 status: ${state}. Waiting ${remaining_seconds}s for allocation."
        ;;
      failed|stopped|succeeded|completed|cancelled|canceled)
        echo "H100 job reached terminal state (${state}); using fallback machine."
        return 1
        ;;
      *)
        if [[ "${state}" == "not_found" || "${state}" == "unknown" ]]; then
          if (( remaining_seconds <= 0 )); then
            echo "Timeout reached while searching for H100 availability. Triggering fallback."
            return 1
          fi
          echo "H100 job not yet visible (${state}). Waiting ${remaining_seconds}s."
        else
          echo "H100 state '${state}' does not require fallback waiting."
          return 0
        fi
        ;;
    esac

    sleep "${poll_seconds}"
  done
}

submit_stage1_with_fallback() {
  local primary_job_name="$1"
  local command="$2"
  local fallback_job_name="${primary_job_name}-${MACHINE_FALLBACK,,}-fallback"

  if ! run_lightning_job "${primary_job_name}" "${MACHINE}" "${command}"; then
    echo "Primary H100 launch failed; aborting fallback sequence."
    return 1
  fi

  if [[ -n "${MACHINE_FALLBACK}" && "${MACHINE}" == "H100" ]]; then
    if [[ -z "${LIGHTNING_PROJECT_ID}" || -z "${LIGHTNING_TEAMSPACE}" ]]; then
      echo "H100 fallback is configured, but project/teamspace context is unavailable. Skipping fallback."
      return 0
    fi
    if wait_for_h100_search_window "${primary_job_name}" "${LIGHTNING_PROJECT_ID}" "${MACHINE_FALLBACK_TIMEOUT_SECONDS}" "${MACHINE_SEARCH_INTERVAL_SECONDS}"; then
      return 0
    fi

  H100_STATE="$(get_job_state "${LIGHTNING_PROJECT_ID}" "${primary_job_name}")"
  if [[ -n "${H100_STATE}" ]]; then
      case "${H100_STATE}" in
        creating|pending|running)
          echo "Stopping active H100 job ${primary_job_name} and launching fallback on ${MACHINE_FALLBACK}."
          uv run lightning stop job "${primary_job_name}" --teamspace "${LIGHTNING_TEAMSPACE}" || true
          ;;
        *)
          echo "Primary H100 job ${primary_job_name} is in '${H100_STATE}'. Skipping stop and launching fallback on ${MACHINE_FALLBACK}."
          ;;
      esac
    else
      echo "Primary H100 job ${primary_job_name} not found; launching fallback on ${MACHINE_FALLBACK}."
    fi

    run_lightning_job "${fallback_job_name}" "${MACHINE_FALLBACK}" "${command}"
    return 0
  fi

  return 0
}

if ! submit_stage1_with_fallback "${JOB_NAME}" "${LAUNCH_COMMAND}"; then
  echo "ERROR: Failed to submit Stage 1 job."
  exit 1
fi
