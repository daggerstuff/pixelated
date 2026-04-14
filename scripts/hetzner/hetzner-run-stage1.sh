#!/bin/bash
# hetzner-run-stage1.sh - Launch Stage 1 (Foundation) SFT on Hetzner AI
set -euo pipefail
HETZNER_AI_CLI="${HETZNER_AI_CLI:-ovhai}"

# 1. Environment Check
if [[ -z "${HETZNER_AI_REGISTRY:-}" ]]; then
    echo "ERROR: HETZNER_AI_REGISTRY not set. Run: export HETZNER_AI_REGISTRY=registry.hel1.your-objectstorage.com/"
    exit 1
fi

IMAGE_TAG="${HETZNER_AI_REGISTRY}pixelated-training:v14"

# 2. CLI and auth checks
if ! command -v ${HETZNER_AI_CLI} >/dev/null 2>&1; then
    echo "ERROR: ${HETZNER_AI_CLI} CLI is not installed or not available in PATH."
    echo "Install it (or add it to PATH) before running this script."
    echo "Example: https://docs.hetzner.com/cloud/ai/"
    exit 1
fi

HETZNER_AI_ARGS=()
if [[ -n "${HETZNER_AI_TOKEN:-}" ]]; then
  if ! ${HETZNER_AI_CLI} --token "${HETZNER_AI_TOKEN}" me >/tmp/hetzner_ai_preflight.log 2>&1; then
    echo "ERROR: HETZNER_AI_TOKEN validation failed. Refresh token in Hetzner AI dashboard or run: ${HETZNER_AI_CLI} login"
    cat /tmp/hetzner_ai_preflight.log
    exit 1
  fi
  HETZNER_AI_ARGS+=(--token "${HETZNER_AI_TOKEN}")
else
  if ! ${HETZNER_AI_CLI} me >/tmp/hetzner_ai_preflight.log 2>&1; then
    echo "ERROR: ${HETZNER_AI_CLI} authentication not available. Set HETZNER_AI_TOKEN or run: ${HETZNER_AI_CLI} login"
    cat /tmp/hetzner_ai_preflight.log
    exit 1
  fi
fi

TRAINING_ENTRYPOINT="${HETZNER_TRAINING_ENTRYPOINT:-/app/train_hetzner.py}"

echo "🚀 Launching Stage 1 (Foundation) job..."

# Syntax: ${HETZNER_AI_CLI} job run [OPTIONS] [IMAGE] [COMMAND]...
# Using prefix-based mounts to bypass the 150GB sync bottleneck
# Get HF_TOKEN from .env if needed
if [[ -z "${HF_TOKEN:-}" ]] && [[ -f ".env" ]]; then
  export $(grep -E '^HF_TOKEN=' .env | xargs)
fi
if [[ -z "${HF_TOKEN:-}" ]]; then
    echo "ERROR: HF_TOKEN not set in environment or .env file."
    exit 1
fi

${HETZNER_AI_CLI} "${HETZNER_AI_ARGS[@]}" job run \
  --name "pixelated-stage1-foundation-v12" \
  --gpu 1 \
  --flavor "l40s-1-gpu" \
  --volume "pixelated-checkpoints@hel1:/checkpoints:rw" \
  --env TRUST_REMOTE_CODE="true" \
  --env WANDB_PROJECT="pixelated-empathy-training" \
  --env HF_TOKEN="${HF_TOKEN}" \
  "$IMAGE_TAG" \
  -- \
  python "${TRAINING_ENTRYPOINT}" --stage foundation --config /app/config/moe_training_config.json


echo "✅ Job submitted."
