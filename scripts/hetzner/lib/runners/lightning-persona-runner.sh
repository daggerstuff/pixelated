#!/usr/bin/env bash

run_lightning_persona_job() {
  local -n _result_ref="$1"
  BATCH_EXIT_STATUS=0

  set +e
  if [[ "${BATCH_RUNNER_MODE}" == "uv" ]]; then
    export PYTHONPATH="/app"
    uv run --project "${PROJECT_ROOT}" python "${BATCH_SCRIPT}" \
      --input-s3-prefix "${INPUT_PREFIX}" \
      --output-s3-key "${OUTPUT_KEY}" \
      ${RESUME_FLAG} \
      --nim-only \
      --checkpoint-prefix "${CHECKPOINT_PREFIX}" \
      --checkpoint-s3-key "${CHECKPOINT_S3_KEY}" \
      --checkpoint-job-name "${CHECKPOINT_JOB_NAME}" \
      --checkpoint-frequency "${CHECKPOINT_FREQUENCY}" \
      --max-records "${MAX_RECORDS}" \
      --defense-model-path "${DEFENSE_MODEL_PATH}" \
      --defense-model-s3-key "${DEFENSE_MODEL_S3_KEY}" \
      --s3-bucket "${S3_BUCKET}"
    BATCH_EXIT_STATUS=$?
  else
    export PYTHONPATH="/app"
    "${BATCH_PYTHON}" "${BATCH_SCRIPT}" \
      --input-s3-prefix "${INPUT_PREFIX}" \
      --output-s3-key "${OUTPUT_KEY}" \
      ${RESUME_FLAG} \
      --nim-only \
      --checkpoint-prefix "${CHECKPOINT_PREFIX}" \
      --checkpoint-s3-key "${CHECKPOINT_S3_KEY}" \
      --checkpoint-job-name "${CHECKPOINT_JOB_NAME}" \
      --checkpoint-frequency "${CHECKPOINT_FREQUENCY}" \
      --max-records "${MAX_RECORDS}" \
      --defense-model-path "${DEFENSE_MODEL_PATH}" \
      --defense-model-s3-key "${DEFENSE_MODEL_S3_KEY}" \
      --s3-bucket "${S3_BUCKET}"
    BATCH_EXIT_STATUS=$?
  fi
  set -e

  _result_ref="${BATCH_EXIT_STATUS}"
}
