#!/bin/bash
# ovhai-run-persona-regeneration.sh - Build, Push, and Launch Persona Re-Generation on OVH AI
set -euo pipefail

# 1. Environment check
if [[ -z "${OVH_AI_REGISTRY:-}" ]]; then
    # Default to docker.io if not set, but warn
    echo "WARNING: OVH_AI_REGISTRY not set. Defaulting to docker.io/pixelatedempathy/"
    export OVH_AI_REGISTRY="docker.io/pixelatedempathy/"
fi

# Load variables from .env if present
if [[ -f ".env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
      # Strip surrounding quotes if present and export
      key=$(echo "$line" | cut -d= -f1)
      value=$(echo "$line" | cut -d= -f2- | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
      export "$key"="$value"
    fi
  done < .env
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
    echo "ERROR: GEMINI_API_KEY not set in environment or .env file." >&2
    exit 1
fi

if [[ -z "${OVH_S3_ACCESS_KEY:-}" || -z "${OVH_S3_SECRET_KEY:-}" ]]; then
    echo "ERROR: OVH_S3_ACCESS_KEY / OVH_S3_SECRET_KEY must be set." >&2
    exit 1
fi

# 2. Image Management
VERSION_TAG="v$(date +%s)"
IMAGE_NAME="training-node"
FULL_IMAGE_NAME="${OVH_AI_REGISTRY}${IMAGE_NAME}:${VERSION_TAG}"

echo "🔨 Building image: ${FULL_IMAGE_NAME}"
# Build from the 'ai' directory as context to match Dockerfile expectations
docker build -t "${FULL_IMAGE_NAME}" ./ai

echo "⬆️ Pushing image: ${FULL_IMAGE_NAME}"
docker push "${FULL_IMAGE_NAME}"

# Optional overrides
JOB_NAME="${JOB_NAME:-persona-regen-${VERSION_TAG}}"
GPU_COUNT="${GPU_COUNT:-1}"
GPU_FLAVOR="${GPU_FLAVOR:-l40s-1-gpu}"

INPUT_PREFIX="${INPUT_PREFIX:-final_dataset/shards/curriculum/stage2/}"
OUTPUT_KEY="${OUTPUT_KEY:-final_dataset/shards/curriculum/stage2/synthetic_persona_batch_5k.jsonl}"
MAX_RECORDS="${MAX_RECORDS:-5000}"

DEFENSE_MODEL_S3_KEY="${DEFENSE_MODEL_S3_KEY:-models/psydefdetect/psydef_deberta_v3_base.ckpt}"
DEFENSE_MODEL_PATH="${DEFENSE_MODEL_PATH:-/app/tmp/model.ckpt}" # Use /app/tmp as we chowned it

S3_BUCKET="${OVH_S3_BUCKET:-pixel-data}"
S3_ENDPOINT="${OVH_S3_ENDPOINT:-https://s3.us-east-va.io.cloud.ovh.us}"
S3_REGION="${OVH_S3_REGION:-us-east-va}"
S3_CA_BUNDLE="${OVH_S3_CA_BUNDLE:-false}"

cat <<MSG
🚀 Launching Persona Re-Generation job
- Job Name: ${JOB_NAME}
- Image: ${FULL_IMAGE_NAME}
- GPU: ${GPU_COUNT} (${GPU_FLAVOR})
- Input: s3://${S3_BUCKET}/${INPUT_PREFIX}
- Output: s3://${S3_BUCKET}/${OUTPUT_KEY}
MSG

# Launch job
# Note: we use PYTHONPATH=/app so that 'from ai.core import ...' works
ovhai job run \
  --name "${JOB_NAME}" \
  --gpu "${GPU_COUNT}" \
  --flavor "${GPU_FLAVOR}" \
  --env PYTHONPATH="/app" \
  --env GEMINI_API_KEY="${GEMINI_API_KEY}" \
  --env OVH_S3_ACCESS_KEY="${OVH_S3_ACCESS_KEY}" \
  --env OVH_S3_SECRET_KEY="${OVH_S3_SECRET_KEY}" \
  --env OVH_S3_ENDPOINT="${S3_ENDPOINT}" \
  --env OVH_S3_BUCKET="${S3_BUCKET}" \
  --env OVH_S3_REGION="${S3_REGION}" \
  --env OVH_S3_CA_BUNDLE="${S3_CA_BUNDLE}" \
  "$FULL_IMAGE_NAME" \
  -- \
  python /app/ai/training/scripts/batch_regenerate.py \
    --input-s3-prefix "${INPUT_PREFIX}" \
    --output-s3-key "${OUTPUT_KEY}" \
    --max-records "${MAX_RECORDS}" \
    --defense-model-path "${DEFENSE_MODEL_PATH}" \
    --defense-model-s3-key "${DEFENSE_MODEL_S3_KEY}" \
    --s3-bucket "${S3_BUCKET}"

echo "✅ Job submitted with UUID recorded in OVH dashboard."
