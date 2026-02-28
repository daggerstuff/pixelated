#!/bin/bash
# ovhai-run-stage2.sh - Launch Stage 2 (CoT) SFT on OVH AI
set -euo pipefail

# 1. Environment Check
if [[ -z "${OVH_AI_REGISTRY:-}" ]]; then
    echo "ERROR: OVH_AI_REGISTRY not set. Run: export OVH_AI_REGISTRY=registry.us-east-va.ai.cloud.ovh.us/49c5c322-6340-459a-8dea-2fcfd6237e7f/"
    exit 1
fi

IMAGE_TAG="${OVH_AI_REGISTRY}pixelated-training:latest"

echo "🚀 Launching Stage 2 (CoT Reasoning) job..."

# Get HF_TOKEN from .env if needed
if [[ -z "${HF_TOKEN:-}" ]] && [[ -f ".env" ]]; then
  export $(grep -E '^HF_TOKEN=' .env | xargs)
fi
if [[ -z "${HF_TOKEN:-}" ]]; then
    echo "ERROR: HF_TOKEN not set in environment or .env file."
    exit 1
fi

# We use the previous successful job checkpoint location as the base
RESUME_CHECKPOINT="/checkpoints/foundation/final"

ovhai job run \
  --name "pixelated-stage2-reasoning-v1" \
  --gpu 1 \
  --flavor "l40s-1-gpu" \
  --volume "pixel-data@US-EAST-VA/acquired:/data/acquired:ro" \
  --volume "pixel-data@US-EAST-VA/lightning:/data/lightning:ro" \
  --volume "pixelated-checkpoints@US-EAST-VA:/checkpoints:rw" \
  --env TRUST_REMOTE_CODE="true" \
  --env WANDB_PROJECT="pixelated-empathy-training" \
  --env HF_TOKEN="${HF_TOKEN}" \
  "$IMAGE_TAG" \
  -- \
  python /app/train_ovh.py --stage reasoning --config /app/config/moe_training_config.json --resume-from "${RESUME_CHECKPOINT}"

echo "✅ Job submitted."
