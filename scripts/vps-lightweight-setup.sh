#!/bin/bash
# Lightweight NGC Setup for Free-Tier VPS
# Uses pre-installed PyTorch instead of downloading 35GB+ containers

set -e

echo "🚀 Pixelated Empathy - Lightweight NGC Setup (Free Tier)"
echo "=========================================================="

# Activate pre-installed PyTorch environment
echo "📦 Activating pre-installed PyTorch 2.9.1..."
source /opt/pytorch/bin/activate

# Verify PyTorch
echo "🧪 Verifying PyTorch installation..."
python -c "import torch; print(f'✅ PyTorch {torch.__version__} ready (CPU mode)')"

# Install additional dependencies for therapeutic AI
echo "📚 Installing therapeutic AI dependencies..."
pip install --quiet \
    transformers \
    sentence-transformers \
    scikit-learn \
    pandas \
    numpy \
    flask \
    flask-cors

# Create workspace
echo "📁 Setting up workspace..."
mkdir -p ~/pixelated/ngc_workspace/{models,data,logs}
cd ~/pixelated/ngc_workspace

# Test bias detection dependencies
echo "🧪 Testing bias detection stack..."
python -c "
import torch
import transformers
import sklearn
print('✅ All dependencies loaded successfully')
print(f'   PyTorch: {torch.__version__}')
print(f'   Transformers: {transformers.__version__}')
print(f'   Scikit-learn: {sklearn.__version__}')
"

echo ""
echo "✅ Lightweight Setup Complete!"
echo "================================"
echo "Environment: /opt/pytorch (activated)"
echo "Workspace: ~/pixelated/ngc_workspace"
echo ""
echo "Next: Deploy bias detection + crisis detection services"
