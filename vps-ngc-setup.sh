#!/bin/bash
# NGC VPS Setup Script
# Configures NVIDIA NGC environment on VPS at 3.137.216.156

set -e

echo "🚀 Pixelated Empathy - NGC VPS Setup"
echo "======================================"

# Environment check
echo "📊 System Information:"
uname -a
echo ""
lscpu | grep "Model name"
free -h
echo ""

# NGC API Key from .env
if [ -f ~/pixelated/.env ]; then
    export NGC_API_KEY=$(grep NGC_API_KEY ~/pixelated/.env | cut -d '=' -f2)
    echo "✅ NGC API Key loaded from .env"
else
    echo "❌ .env file not found"
    exit 1
fi

# Docker authentication for NGC
echo "🔐 Authenticating with NGC registry..."
echo "$NGC_API_KEY" | docker login nvcr.io --username '$oauthtoken' --password-stdin

# Pull essential containers (CPU-optimized since no GPU)
echo "📦 Pulling NGC containers (CPU mode)..."
docker pull nvcr.io/nvidia/pytorch:24.12-py3 &
PYTORCH_PID=$!

docker pull nvcr.io/nvidia/tensorflow:24.12-tf2-py3 &
TF_PID=$!

docker pull nvcr.io/nvidia/tritonserver:24.12-py3 &
TRITON_PID=$!

# Wait for all pulls
echo "⏳ Waiting for container downloads..."
wait $PYTORCH_PID $TF_PID $TRITON_PID

echo "✅ All containers downloaded"

# Test PyTorch container
echo "🧪 Testing PyTorch container..."
docker run --rm nvcr.io/nvidia/pytorch:24.12-py3 python -c "import torch; print(f'PyTorch {torch.__version__}')"

# Create workspace directory
mkdir -p ~/pixelated/ngc_workspace
cd ~/pixelated/ngc_workspace

echo ""
echo "✅ NGC VPS Setup Complete!"
echo "================================"
echo "Next steps:"
echo "1. Run therapeutic model training"
echo "2. Deploy Triton inference server"
echo "3. Test Empathy Gym integration"
