#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AI_ROOT="${REPO_ROOT}/ai"

STAGE2_CONFIG="${AI_ROOT}/lightning/production/stage_configs/stage2_reasoning.json"
STAGE2_LAUNCHER="${SCRIPT_DIR}/start_lightning_stage2.sh"
STAGE1_LAUNCHER="${SCRIPT_DIR}/start_lightning_stage1.sh"
ENTRYPOINT_SCRIPT="${SCRIPT_DIR}/start_lightning_stage1_entrypoint.sh"
TRAINING_SCRIPT="${AI_ROOT}/lightning/production/train_therapeutic_ai.py"

failures=0
warnings=0

log_ok() {
  printf 'OK: %s\n' "$1"
}

log_warn() {
  printf 'WARN: %s\n' "$1"
  warnings=$((warnings + 1))
}

log_fail() {
  printf 'FAIL: %s\n' "$1"
  failures=$((failures + 1))
}

require_file() {
  local path="$1"
  local label="$2"
  if [[ -f "${path}" ]]; then
    log_ok "${label} found at ${path}"
  else
    log_fail "${label} missing at ${path}"
  fi
}

echo "Stage 2 readiness preflight"
echo "Repo root: ${REPO_ROOT}"
echo

require_file "${STAGE2_CONFIG}" "Stage 2 config"
require_file "${STAGE2_LAUNCHER}" "Stage 2 launcher"
require_file "${STAGE1_LAUNCHER}" "Stage 1 launcher"
require_file "${ENTRYPOINT_SCRIPT}" "Lightning entrypoint"
require_file "${TRAINING_SCRIPT}" "Training script"

python_output="$(python "${SCRIPT_DIR}/validate_lightning_config.py" "${STAGE2_CONFIG}")"

while IFS= read -r line; do
  case "${line}" in
    FAIL::*)
      error_msg="${line#FAIL::}"
      log_fail "Python validation error: ${error_msg}"
      ;;
    KEY::*)
      key_name="${line#KEY::}"
      key="${key_name%%::*}"
      present="${line##*::}"
      if [[ "${present}" == "True" ]]; then
        log_ok "Config key '${key}' present"
      else
        log_fail "Config key '${key}' missing"
      fi
      ;;
    VALUE::run_name::*)
      value="${line#VALUE::run_name::}"
      if [[ "${value}" == "stage2"* || "${value}" == *"reasoning"* ]]; then
        log_ok "Stage 2 run name is ${value}"
      else
        log_warn "Unexpected Stage 2 run name: ${value}"
      fi
      ;;
    VALUE::train_data_path::*)
      value="${line#VALUE::train_data_path::}"
      if [[ "${value}" == s3://* ]]; then
        log_ok "Train data path targets S3: ${value}"
      else
        log_warn "Train data path is not an S3 URI: ${value}"
      fi
      ;;
    VALUE::resume_from_checkpoint::*)
      value="${line#VALUE::resume_from_checkpoint::}"
      if [[ -n "${value}" ]]; then
        if [[ "${value}" == s3://* ]]; then
          log_ok "Resume checkpoint targets S3: ${value}"
        elif [[ -e "${REPO_ROOT}/${value#./}" || -e "${value}" ]]; then
          log_ok "Resume checkpoint path exists: ${value}"
        else
          log_warn "Resume checkpoint path does not currently exist locally: ${value}"
        fi
      else
        log_warn "Resume checkpoint path is empty"
      fi
      ;;
    VALUE::dataloader_num_workers::*)
      value="${line#VALUE::dataloader_num_workers::}"
      if [[ -n "${value}" && "${value}" != "0" ]]; then
        log_ok "DataLoader worker count configured: ${value}"
      else
        log_warn "DataLoader worker count is unset or zero"
      fi
      ;;
    VALUE::precision::*)
      value="${line#VALUE::precision::}"
      if [[ "${value}" == "bf16" || "${value}" == "fp16" || "${value}" == "32" ]]; then
        log_ok "Precision setting recognized: ${value}"
      else
        log_warn "Precision setting is unexpected: ${value}"
      fi
      ;;
  esac
done <<< "${python_output}"

if command -v bash >/dev/null 2>&1; then
  syntax_errors=0
  for script in "${STAGE1_LAUNCHER}" "${ENTRYPOINT_SCRIPT}" "${STAGE2_LAUNCHER}"; do
    if ! bash -n "${script}"; then
      log_fail "Shell syntax check failed for ${script}"
      syntax_errors=$((syntax_errors + 1))
    fi
  done
  
  if [[ "${syntax_errors}" -eq 0 ]]; then
    log_ok "All launcher shell syntax checks passed"
  fi
fi

if python -m py_compile "${TRAINING_SCRIPT}" >/dev/null 2>&1; then
  log_ok "Training script compiles"
else
  log_fail "Training script failed py_compile"
fi

echo
printf 'Summary: %d failure(s), %d warning(s)\n' "${failures}" "${warnings}"

if (( failures > 0 )); then
  exit 1
fi
