#!/bin/bash
# ovhai-run-stage1.sh - Launch Stage 1 (Foundation) SFT on OVH AI
set -euo pipefail

# 1. Environment Check
if [[ -z "${OVH_AI_REGISTRY:-}" ]]; then
    echo "ERROR: OVH_AI_REGISTRY not set. Run: export OVH_AI_REGISTRY=registry.us-east-va.ai.cloud.ovh.us/49c5c322-6340-459a-8dea-2fcfd6237e7f/"
    exit 1
fi

IMAGE_TAG="${OVH_AI_REGISTRY}pixelated-training:v14"

# 2. CLI and auth checks
if ! command -v ovhai >/dev/null 2>&1; then
    echo "ERROR: ovhai CLI is not installed or not available in PATH."
    echo "Install it (or add it to PATH) before running this script."
    echo "Example: https://github.com/ovh/ovhai-cli"
    exit 1
fi

OVHAI_ARGS=()
if [[ -n "${OVH_AI_TOKEN:-}" ]]; then
  if ! ovhai --token "${OVH_AI_TOKEN}" me >/tmp/ovhai_preflight.log 2>&1; then
    echo "ERROR: OVH_AI_TOKEN validation failed. Refresh token in OVH AI dashboard or run: ovhai login"
    cat /tmp/ovhai_preflight.log
    exit 1
  fi
  OVHAI_ARGS+=(--token "${OVH_AI_TOKEN}")
else
  if ! ovhai me >/tmp/ovhai_preflight.log 2>&1; then
    echo "ERROR: ovhai authentication not available. Set OVH_AI_TOKEN or run: ovhai login"
    cat /tmp/ovhai_preflight.log
    exit 1
  fi
fi

echo "🚀 Launching Stage 1 (Foundation) job..."

# Syntax: ovhai job run [OPTIONS] [IMAGE] [COMMAND]...
# Using prefix-based mounts to bypass the 150GB sync bottleneck
# Get HF_TOKEN from .env if needed
if [[ -z "${HF_TOKEN:-}" ]] && [[ -f ".env" ]]; then
  export $(grep -E '^HF_TOKEN=' .env | xargs)
fi
if [[ -z "${HF_TOKEN:-}" ]]; then
    echo "ERROR: HF_TOKEN not set in environment or .env file."
    exit 1
fi

ovhai "${OVHAI_ARGS[@]}" job run \
  --name "pixelated-stage1-foundation-v12" \
  --gpu 1 \
  --flavor "l40s-1-gpu" \
  --volume "pixelated-checkpoints@US-EAST-VA:/checkpoints:rw" \
  --env TRUST_REMOTE_CODE="true" \
  --env WANDB_PROJECT="pixelated-empathy-training" \
  --env HF_TOKEN="${HF_TOKEN}" \
  "$IMAGE_TAG" \
  -- \
  python /app/train_ovh.py --stage foundation --config /app/config/moe_training_config.json


echo "✅ Job submitted."
