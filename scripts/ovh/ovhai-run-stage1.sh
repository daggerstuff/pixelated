#!/bin/bash
# ovhai-run-stage1.sh - Launch Stage 1 (Foundation) SFT on OVH AI
set -euo pipefail

# 1. Environment Check
if [[ -z "${OVH_AI_REGISTRY:-}" ]]; then
    echo "ERROR: OVH_AI_REGISTRY not set. Run: export OVH_AI_REGISTRY=registry.us-east-va.ai.cloud.ovh.us/49c5c322-6340-459a-8dea-2fcfd6237e7f/"
    exit 1
fi

IMAGE_TAG="${OVH_AI_REGISTRY}pixelated-training:v14"

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

ovhai job run \
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
