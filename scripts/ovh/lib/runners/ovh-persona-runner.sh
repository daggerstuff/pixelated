#!/usr/bin/env bash

run_ovh_persona_job() {
  local resume_flag="${RESUME_FLAG:---resume}"
  ovhai job run \
    --name "${JOB_NAME}" \
    --gpu "${GPU_COUNT}" \
    --flavor "${GPU_FLAVOR}" \
    --env PYTHONPATH="/app" \
    --env NVIDIA_API_KEY="${NVIDIA_API_KEY}" \
    --env OVH_S3_ACCESS_KEY="${OVH_S3_ACCESS_KEY}" \
    --env OVH_S3_SECRET_KEY="${OVH_S3_SECRET_KEY}" \
    --env OVH_S3_ENDPOINT="${S3_ENDPOINT}" \
    --env OVH_S3_BUCKET="${S3_BUCKET}" \
    --env OVH_S3_REGION="${S3_REGION}" \
    --env OVH_S3_CA_BUNDLE="${S3_CA_BUNDLE}" \
    --env CHECKPOINT_PREFIX="${CHECKPOINT_PREFIX}" \
    --env CHECKPOINT_S3_KEY="${CHECKPOINT_S3_KEY}" \
    --env CHECKPOINT_JOB_NAME="${CHECKPOINT_JOB_NAME}" \
    --env CHECKPOINT_FREQUENCY="${CHECKPOINT_FREQUENCY}" \
    "${FULL_IMAGE_NAME}" \
    -- \
    "${BATCH_PYTHON}" "${BATCH_SCRIPT}" \
      --input-s3-prefix "${INPUT_PREFIX}" \
      --output-s3-key "${OUTPUT_KEY}" \
      ${resume_flag} \
      --checkpoint-prefix "${CHECKPOINT_PREFIX}" \
      --checkpoint-s3-key "${CHECKPOINT_S3_KEY}" \
      --checkpoint-job-name "${CHECKPOINT_JOB_NAME}" \
      --checkpoint-frequency "${CHECKPOINT_FREQUENCY}" \
      --max-records "${MAX_RECORDS}" \
      --defense-model-path "${DEFENSE_MODEL_PATH}" \
      --defense-model-s3-key "${DEFENSE_MODEL_S3_KEY}" \
      --nim-only \
      --s3-bucket "${S3_BUCKET}"
}
