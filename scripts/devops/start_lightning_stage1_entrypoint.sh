#!/usr/bin/env bash
set -euo pipefail

STAGE1_TRAINING_SCRIPT="${STAGE1_TRAINING_SCRIPT:-ai/lightning/production/train_therapeutic_ai.py}"
STAGE="${STAGE1_STAGE:-1}"
MAX_STEPS="${STAGE1_MAX_STEPS:-100000}"
DRY_RUN="${STAGE1_DRY_RUN:-0}"
TRAIN_WORKERS="${STAGE1_TRAIN_WORKERS:-}"
REPO_URL="${LIGHTNING_REPO_URL:-}"
WORKDIR_HINT="${STAGE1_WORKDIR_HINT:-${WORKDIR_HINT:-}}"
ENTRYPOINT_MODE="${STAGE1_ENTRYPOINT_MODE:-studio}"
WORKDIR="${WORKDIR:-$(pwd)}"

BASE_COMMAND=(uv run python "${STAGE1_TRAINING_SCRIPT}" --stage "${STAGE}" --max-steps "${MAX_STEPS}")
if [[ "${DRY_RUN}" == "1" ]]; then
  BASE_COMMAND+=(--dry-run)
fi
if [[ -n "${TRAIN_WORKERS}" ]]; then
  BASE_COMMAND+=(--num-workers "${TRAIN_WORKERS}")
fi

validate_repo_url() {
  local repo_url="$1"
  case "${repo_url}" in
    git@github.com:pixelatedempathy/*|https://github.com/pixelatedempathy/*)
      return 0
      ;;
    *)
      echo "ERROR: LIGHTNING_REPO_URL must point to the pixelatedempathy GitHub org."
      echo "Received: ${repo_url}"
      return 1
      ;;
  esac
}

resolve_workdir() {
  for candidate in "${WORKDIR}" "/home/zeus/pixelated" "/home/vivi/pixelated" "/workspace" "/workspace/pixelated"; do
    if [[ -f "${candidate}/${STAGE1_TRAINING_SCRIPT}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

if [[ "${ENTRYPOINT_MODE}" == "image" ]]; then
  WORKDIR="${WORKDIR_HINT}"
  if [[ -z "${WORKDIR}" ]]; then
    echo "ERROR: STAGE1_WORKDIR_HINT is required for image mode."
    exit 1
  fi
  if [[ ! -f "${WORKDIR}/${STAGE1_TRAINING_SCRIPT}" ]]; then
    echo "ERROR: Image workspace missing ${STAGE1_TRAINING_SCRIPT} at ${WORKDIR}"
    exit 1
  fi
  cd "${WORKDIR}"
elif [[ -n "${LIGHTNING_STUDIO_PATH:-}" ]]; then
  if [[ ! -d "${LIGHTNING_STUDIO_PATH}" ]]; then
    echo "ERROR: LIGHTNING_STUDIO_PATH does not exist: ${LIGHTNING_STUDIO_PATH}"
    exit 1
  fi
  cd "${LIGHTNING_STUDIO_PATH}"
else
  REPO_TMP_DIR=""
  cleanup_repo_dir() {
    if [[ -n "${REPO_TMP_DIR:-}" && -d "${REPO_TMP_DIR}" ]]; then
      rm -rf "${REPO_TMP_DIR}"
    fi
  }
  trap cleanup_repo_dir EXIT

  WORKDIR="$(resolve_workdir || true)"
  if [[ -z "${WORKDIR}" ]]; then
    if [[ -z "${REPO_URL}" ]]; then
      echo "ERROR: Could not locate Stage 1 training script and LIGHTNING_REPO_URL is not set."
      echo "Set LIGHTNING_STUDIO_PATH to your repo path, or LIGHTNING_REPO_URL for clone fallback."
      exit 1
    fi
    if ! validate_repo_url "${REPO_URL}"; then
      exit 1
    fi

    WORKDIR="$(mktemp -d)"
    REPO_TMP_DIR="${WORKDIR}"

    if ! git clone --depth 1 --recurse-submodules "${REPO_URL}" "${WORKDIR}"; then
      if [[ "${REPO_URL#git@github.com:}" != "${REPO_URL}" ]]; then
        HTTPS_REPO_URL="https://github.com/${REPO_URL#git@github.com:}"
        echo "WARN: SSH clone failed, retrying with HTTPS: ${HTTPS_REPO_URL}"
        if ! git clone --depth 1 --recurse-submodules "${HTTPS_REPO_URL}" "${WORKDIR}"; then
          echo "ERROR: Failed to clone repository from both SSH and HTTPS URLs."
          echo "ERROR: SSH URL: ${REPO_URL}"
          echo "ERROR: HTTPS URL: ${HTTPS_REPO_URL}"
          exit 1
        fi
      else
        echo "ERROR: Failed to clone repository from ${REPO_URL}"
        exit 1
      fi
    fi

    if [[ ! -f "${WORKDIR}/${STAGE1_TRAINING_SCRIPT}" ]]; then
      CLONED_SCRIPT_PATH="$(find "${WORKDIR}" -type f -path "*/${STAGE1_TRAINING_SCRIPT}" | head -n 1 || true)"
      if [[ -z "${CLONED_SCRIPT_PATH}" ]]; then
        echo "ERROR: Cloned repository missing ${STAGE1_TRAINING_SCRIPT} at ${WORKDIR}"
        exit 1
      fi
      WORKDIR="${CLONED_SCRIPT_PATH%/${STAGE1_TRAINING_SCRIPT}}"
    fi
  fi
  cd "${WORKDIR}"
fi

"${BASE_COMMAND[@]}"
