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
LIGHTNING_MACHINE=<machine>      Machine flavor (default: A100_X_2; set A100_X_2 for 2-GPU A100).
  LIGHTNING_JOB_NAME=<name>       Custom job name
  LIGHTNING_REPO_URL=<url>        Git URL to clone when using image mode
  LIGHTNING_REPO_DIR=<dir>        Local clone directory in image mode (default: pixelated-lightning)
  LIGHTNING_AUTO_RESOLVE_STUDIO=1  Enable auto studio resolution when LIGHTNING_STUDIO is unset/empty/placeholder (default: 1)
  LIGHTNING_TRAIN_WORKERS=<n>     Override training DataLoader num_workers
  UV_PRUNE_CACHE=1                Optional one-time uv cache prune before launch

Examples:
  LIGHTNING_STUDIO=my-studio uv run lightning run ...  # use studio
  LIGHTNING_IMAGE=ghcr.io/org/image:tag LIGHTNING_REPO_URL=https://github.com/org/repo.git uv run ...
  # Secrets (WANDB_API_KEY, HETZNER_S3_SECRET_KEY, HF_TOKEN/HUGGINGFACE_HUB_TOKEN, etc.)
  # must be configured in your Lightning workspace/env, not passed on the command line.
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
MACHINE="${LIGHTNING_MACHINE:-A100_X_2}"
if [[ "${MACHINE^^}" == *"H100"* && "${ALLOW_H100_MACHINES:-0}" != "1" ]]; then
  echo "ERROR: H100 usage is blocked for this launcher. Set ALLOW_H100_MACHINES=1 and LIGHTNING_MACHINE=H100 to override."
  exit 1
fi
STAGE="${LIGHTNING_STAGE:-1}"
DRY_RUN_FLAG="${LIGHTNING_DRY_RUN:-0}"
MAX_STEPS="${LIGHTNING_MAX_STEPS:-100000}"
TRAIN_WORKERS="${LIGHTNING_TRAIN_WORKERS:-}"
STAGE1_TRAINING_SCRIPT="${LIGHTNING_TRAINING_SCRIPT:-ai/lightning/production/train_therapeutic_ai.py}"
LIGHTNING_REPO_URL="${LIGHTNING_REPO_URL:-}"
LIGHTNING_ENV_ARGS=()
for env_key in \
  WANDB_ENTITY \
  WANDB_PROJECT \
  WANDB_API_KEY \
  WANDB_DISABLED \
  WANDB_NAME \
  HF_TOKEN \
  HUGGINGFACE_HUB_TOKEN \
  HF_REPO_ID \
  HF_REPO_NAME \
  HF_REPO_OWNER \
  HF_REPO_PRIVATE \
  HF_PUSH \
  HF_RUN_NAME \
  S3_BUCKET \
  HETZNER_S3_ENDPOINT \
  HETZNER_S3_REGION \
  HETZNER_S3_BUCKET \
  TRAIN_DATA_PATH \
  CUDA_VISIBLE_DEVICES; do
  if [[ -n "${!env_key:-}" ]]; then
    LIGHTNING_ENV_ARGS+=(--env "${env_key}=${!env_key}")
  fi
done
LIGHTNING_ENV_ARGS+=(--env "STAGE1_TRAINING_SCRIPT=${STAGE1_TRAINING_SCRIPT}")
LIGHTNING_ENV_ARGS+=(--env "STAGE1_STAGE=${STAGE}")
LIGHTNING_ENV_ARGS+=(--env "STAGE1_MAX_STEPS=${MAX_STEPS}")
LIGHTNING_ENV_ARGS+=(--env "STAGE1_DRY_RUN=${DRY_RUN_FLAG}")
LIGHTNING_ENV_ARGS+=(--env "STAGE1_TRAIN_WORKERS=${TRAIN_WORKERS}")
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
LIGHTNING_ENV_ARGS+=(--env "LIGHTNING_REPO_URL=${LIGHTNING_REPO_URL}")
CREDENTIALS_FILE="${HOME}/.lightning/credentials.json"

resolve_lightning_context_values() {
  local creds_path="${1:?missing credentials path}"
  local require_studio="${2:-0}"
  local resolved_context
  local resolved_parts

  if ! resolved_context="$(uv run python scripts/devops/resolve_lightning_context.py --creds-path "${creds_path}" --format lines $(
    [[ "${require_studio}" == "1" ]] && echo "--require-studio"
    [[ "${require_studio}" == "1" && -n "${LIGHTNING_MACHINE:-$MACHINE}" ]] && echo "--machine ${LIGHTNING_MACHINE:-$MACHINE}"
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

TEAMSPACE_ARGS=()
if [[ -n "${LIGHTNING_USERNAME}" && -n "${LIGHTNING_TEAMSPACE}" ]]; then
  TEAMSPACE_ARGS=(--teamspace "${LIGHTNING_TEAMSPACE}")
  if [[ "${LIGHTNING_OWNER_TYPE}" == "user" ]]; then
    TEAMSPACE_ARGS+=(--user "${LIGHTNING_USERNAME}")
  elif [[ "${LIGHTNING_OWNER_TYPE}" == "organization" ]]; then
    TEAMSPACE_ARGS+=(--org "${LIGHTNING_USERNAME}")
  fi
fi
ENTRYPOINT_SCRIPT="scripts/devops/start_lightning_stage1_entrypoint.sh"

LAUNCH_COMMAND=$(cat <<'EOF'
set -eu
BOOTSTRAP_SCRIPT=""

if [ -n "${LIGHTNING_STUDIO_PATH:-}" ]; then
  CANDIDATE="${LIGHTNING_STUDIO_PATH%/}/scripts/devops/start_lightning_stage1_bootstrap.sh"
  if [ -f "${CANDIDATE}" ]; then
    BOOTSTRAP_SCRIPT="${CANDIDATE}"
  fi
fi

if [ -z "${BOOTSTRAP_SCRIPT}" ] && [ -f "scripts/devops/start_lightning_stage1_bootstrap.sh" ]; then
  BOOTSTRAP_SCRIPT="scripts/devops/start_lightning_stage1_bootstrap.sh"
fi

if [ -z "${BOOTSTRAP_SCRIPT}" ]; then
  BOOTSTRAP_SCRIPT="$(find /workspace /home /tmp -maxdepth 8 -type f -path '*/scripts/devops/start_lightning_stage1_bootstrap.sh' 2>/dev/null | head -n 1 || true)"
fi

if [ -n "${BOOTSTRAP_SCRIPT}" ]; then
  bash "${BOOTSTRAP_SCRIPT}"
  exit 0
fi

echo "ERROR: Could not locate scripts/devops/start_lightning_stage1_bootstrap.sh in studio workspace."
echo "Expected it at: ${LIGHTNING_STUDIO_PATH:-<not set>}/scripts/devops/start_lightning_stage1_bootstrap.sh or ./scripts/devops/start_lightning_stage1_bootstrap.sh"
echo "Searched workspace roots: /workspace, /home, /tmp"
echo "This run is now legacy-studio mode only; no inline clone fallback is used."
exit 1
EOF
)

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
    local image_command="git clone --depth 1 --recurse-submodules \"${LIGHTNING_REPO_URL}\" \"${repo_dir}\" && STAGE1_ENTRYPOINT_MODE=image STAGE1_WORKDIR_HINT=\"${repo_dir}\" bash \"${repo_dir}/${ENTRYPOINT_SCRIPT}\""
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

if ! run_lightning_job "${JOB_NAME}" "${MACHINE}" "${LAUNCH_COMMAND}"; then
  echo "ERROR: Failed to submit Stage 1 job."
  exit 1
fi
