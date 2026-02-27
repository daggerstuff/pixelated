#!/usr/bin/env bash
# Strict wrapper around docker build and ovhai job run
set -euo pipefail

# 1. Enforce Execution Directory
if [[ ! -d "ai/training" || ! -f "package.json" ]]; then
    echo "ERROR: This script MUST be executed from the repository root (/home/vivi/pixelated)."
    echo "Current directory: $(pwd)"
    echo "Solution: cd /home/vivi/pixelated && ./scripts/ovh/ovh-ai-deploy-training.sh"
    exit 1
fi

echo "✅ Environment check passed: Executing from repository root."

# 2. Extract ENV Vars
if [[ -z "${OVH_AI_REGISTRY:-}" ]]; then
    echo "ERROR: OVH_AI_REGISTRY is not set. Example: registry.us-east-va.ai.cloud.ovh.us/49c5c322-6340.../"
    exit 1
fi

IMAGE_TAG="${OVH_AI_REGISTRY}pixelated-training:latest"

echo "⏳ Building image from root context..."
docker build -t "$IMAGE_TAG" -f ai/training/ready_packages/platforms/ovh/Dockerfile.training .

echo "🚀 Pushing image..."
docker push "$IMAGE_TAG"

echo "✅ Deployment image ready."
