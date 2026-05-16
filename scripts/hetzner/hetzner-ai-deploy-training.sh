#!/usr/bin/env bash
# Strict wrapper around docker build and Hetzner AI job run
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REDIS_AUDIT="${PROJECT_ROOT}/scripts/check-redis-hardening.sh"

if ! "$REDIS_AUDIT"; then
  echo "Redis hardening audit failed"
  exit 1
fi

# 1. Enforce Execution Directory
if [[ ! -d "ai/training" || ! -f "package.json" ]]; then
    echo "ERROR: This script MUST be executed from the repository root (/home/vivi/pixelated)."
    echo "Current directory: $(pwd)"
    echo "Solution: cd /home/vivi/pixelated && ./scripts/hetzner/hetzner-ai-deploy-training.sh"
    exit 1
fi

echo "✅ Environment check passed: Executing from repository root."

# 2. Extract ENV Vars
if [[ -z "${HETZNER_AI_REGISTRY:-}" ]]; then
    echo "ERROR: HETZNER_AI_REGISTRY is not set. Example: registry.hel1.your-objectstorage.com/"
    exit 1
fi

IMAGE_TAG="${HETZNER_AI_REGISTRY}pixelated-training:latest"
TRAINING_DOCKERFILE="${HETZNER_TRAINING_DOCKERFILE:-ai/training/ready_packages/platforms/hetzner/Dockerfile.training}"

echo "⏳ Building image from root context..."
docker build -t "$IMAGE_TAG" -f "$TRAINING_DOCKERFILE" .

echo "🚀 Pushing image..."
docker push "$IMAGE_TAG"

echo "✅ Deployment image ready."
