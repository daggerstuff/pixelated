#!/bin/bash
# hetzner-run-stage2.sh - Launch Stage 2 (CoT) SFT on Hetzner AI
set -euo pipefail

# 1. Environment Check
if [[ -z "${HETZNER_AI_REGISTRY:-}" ]]; then
    echo "ERROR: HETZNER_AI_REGISTRY not set. Run: export HETZNER_AI_REGISTRY=registry.hel1.your-objectstorage.com/"
    exit 1
fi

IMAGE_TAG="${HETZNER_AI_REGISTRY}pixelated-training:latest"

echo "🚀 Launching Stage 2 (CoT Reasoning) job..."

# Get HF_TOKEN from .env if needed
if [[ -z "${HF_TOKEN:-}" ]] && [[ -f ".env" ]]; then
  export $(grep -E '^HF_TOKEN=' .env | xargs)
fi
if [[ -z "${HF_TOKEN:-}" ]]; then
    echo "ERROR: HF_TOKEN not set in environment or .env file."
    exit 1
fi

TRAINING_ENTRYPOINT="${HETZNER_TRAINING_ENTRYPOINT:-/app/train_hetzner.py}"

# We use the previous successful job checkpoint location as the base
RESUME_CHECKPOINT="/checkpoints/foundation/final"

ovhai job run \
  --name "pixelated-stage2-reasoning-v1" \
  --gpu 1 \
  --flavor "l40s-1-gpu" \
  --volume "pixel-data@hel1/acquired:/data/acquired:ro" \
  --volume "pixel-data@hel1/lightning:/data/lightning:ro" \
  --volume "pixelated-checkpoints@hel1:/checkpoints:rw" \
  --env TRUST_REMOTE_CODE="true" \
  --env WANDB_PROJECT="pixelated-empathy-training" \
  --env HF_TOKEN="${HF_TOKEN}" \
  "$IMAGE_TAG" \
  -- \
  python "${TRAINING_ENTRYPOINT}" --stage reasoning --config /app/config/moe_training_config.json --resume-from "${RESUME_CHECKPOINT}"

echo "✅ Job submitted."
