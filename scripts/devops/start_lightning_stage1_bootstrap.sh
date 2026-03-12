#!/usr/bin/env bash
set -euo pipefail

ENTRYPOINT_SCRIPT_REL="scripts/devops/start_lightning_stage1_entrypoint.sh"
ENTRYPOINT_SCRIPT=""

if [[ -n "${LIGHTNING_STUDIO_PATH:-}" ]]; then
  CANDIDATE="${LIGHTNING_STUDIO_PATH%/}/${ENTRYPOINT_SCRIPT_REL}"
  if [[ -f "${CANDIDATE}" ]]; then
    ENTRYPOINT_SCRIPT="${CANDIDATE}"
  fi
fi

if [[ -z "${ENTRYPOINT_SCRIPT}" ]]; then
  CANDIDATE="$(find /workspace /home -maxdepth 8 -type f -path "*/${ENTRYPOINT_SCRIPT_REL}" 2>/dev/null | head -n 1 || true)"
  if [[ -n "${CANDIDATE}" ]]; then
    ENTRYPOINT_SCRIPT="${CANDIDATE}"
  fi
fi

if [[ -z "${ENTRYPOINT_SCRIPT}" ]]; then
  if [[ -z "${LIGHTNING_REPO_URL:-}" ]]; then
    echo "ERROR: Could not locate ${ENTRYPOINT_SCRIPT_REL} and LIGHTNING_REPO_URL is not set."
    exit 1
  fi

  TMP_REPO_DIR="$(mktemp -d /tmp/pixelated-stage1-XXXXXX)"
  cleanup_repo_dir() {
    if [[ -d "${TMP_REPO_DIR}" ]]; then
      rm -rf "${TMP_REPO_DIR}"
    fi
  }
  trap cleanup_repo_dir EXIT

  if ! git clone --depth 1 --recurse-submodules "${LIGHTNING_REPO_URL}" "${TMP_REPO_DIR}"; then
    HTTPS_REPO_URL="${LIGHTNING_REPO_URL#git@github.com:}"
    if [[ "${HTTPS_REPO_URL}" == "${LIGHTNING_REPO_URL}" ]]; then
      echo "ERROR: Failed to clone repository from ${LIGHTNING_REPO_URL}"
      exit 1
    fi
    HTTPS_REPO_URL="https://github.com/${HTTPS_REPO_URL}"
    if ! git clone --depth 1 --recurse-submodules "${HTTPS_REPO_URL}" "${TMP_REPO_DIR}"; then
      echo "ERROR: Failed to clone repository from both SSH and HTTPS URLs."
      echo "ERROR: SSH URL: ${LIGHTNING_REPO_URL}"
      echo "ERROR: HTTPS URL: ${HTTPS_REPO_URL}"
      exit 1
    fi
  fi

  ENTRYPOINT_SCRIPT="${TMP_REPO_DIR}/${ENTRYPOINT_SCRIPT_REL}"
  if [[ ! -f "${ENTRYPOINT_SCRIPT}" ]]; then
    echo "ERROR: Cloned repository missing ${ENTRYPOINT_SCRIPT_REL} at ${TMP_REPO_DIR}"
    exit 1
  fi
fi

STAGE1_ENTRYPOINT_MODE=studio bash "${ENTRYPOINT_SCRIPT}"
