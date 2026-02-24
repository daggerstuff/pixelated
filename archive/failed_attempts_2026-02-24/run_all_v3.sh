#!/bin/bash
# 🌌 Pixelated Empathy: Stage 1 Foundation Launcher (v3)
# Target: Fresh OVH PyTorch 2.10.0-py313-cudadevel128-gpu Environment

set -e

# Validate required environment variables
missing_vars=()
[ -z "$WANDB_API_KEY" ] && missing_vars+=("WANDB_API_KEY")
[ -z "$OV_S3_AK" ] && missing_vars+=("OV_S3_AK")
[ -z "$OV_S3_SK" ] && missing_vars+=("OV_S3_SK")

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Error: Missing required environment variables: ${missing_vars[*]}"
    exit 1
fi

# Export standardized names for the training script
export WANDB_API_KEY="$WANDB_API_KEY"
export OVH_S3_ACCESS_KEY="$OV_S3_AK"
export OVH_S3_SECRET_KEY="$OV_S3_SK"
export OVH_S3_ENDPOINT="https://s3.us-east-va.io.cloud.ovh.us"
export OVH_S3_BUCKET="pixel-data"
export OVH_S3_REGION="us-east-va"
export PYTHONPATH="/workspace"

cd /workspace

echo "🚀 Bootstrapping UV..."
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

echo "🔧 Creating and configuring virtual environment..."
uv venv --python 3.13 --clear
source .venv/bin/activate

echo "📦 Installing core dependencies..."
uv pip install lightning peft "transformers[torch]" wandb boto3 bitsandbytes accelerate

echo "⚡ Installing optimized Flash Attention wheel (targeting Torch 2.5/2.6 compatibles)..."
# Using a broad compatibility check or standard pip install for flash-attn if wheel is unclear
uv pip install flash-attn --no-build-isolation || echo "⚠️ Flash attention build failed, falling back to eager (slower)."

echo "🔑 Authenticating W&B..."
python -c "import wandb; wandb.login(key='${WANDB_API_KEY}')"

echo "🔥 Launching Stage 1 Foundation Training (v32)..."
# PREVENT SSH DISRUPTION: Never use global pkill. Targeting only the training script.
python /workspace/ai/lightning/production/train_therapeutic_ai.py --stage 1
