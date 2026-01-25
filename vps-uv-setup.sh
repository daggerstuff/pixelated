#!/bin/bash
# UV-based CPU-Only Setup for Pixelated Empathy VPS
# Free-tier optimized with uv for dependency management

set -e

echo "🚀 Pixelated Empathy - UV CPU-Only Setup"
echo "========================================="

# Ensure uv is in PATH
export PATH="$HOME/.local/bin:$PATH"

# Verify uv installation
echo "📦 Verifying uv installation..."
uv --version

# Create project directory
cd ~/pixelated
mkdir -p ngc_workspace/{models,data,logs}

# Create uv-managed virtual environment with CPU-only PyTorch
echo "🔧 Creating uv virtual environment (CPU-only)..."
uv venv .venv --python 3.12

# Activate environment
source .venv/bin/activate

# Install CPU-only PyTorch first (smaller, faster)
echo "📥 Installing PyTorch CPU-only..."
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install therapeutic AI dependencies
echo "📚 Installing therapeutic AI stack..."
uv pip install \
    transformers \
    sentence-transformers \
    scikit-learn \
    fairlearn \
    pandas \
    numpy \
    flask \
    flask-cors \
    pydantic

# Verify installation
echo "🧪 Verifying installation..."
python -c "
import torch
import transformers
import sklearn
import fairlearn
print('✅ All dependencies loaded successfully')
print(f'   PyTorch: {torch.__version__} (CPU-only)')
print(f'   CUDA available: {torch.cuda.is_available()}')
print(f'   Transformers: {transformers.__version__}')
print(f'   Scikit-learn: {sklearn.__version__}')
print(f'   Fairlearn: {fairlearn.__version__}')
"

# Add activation to .zshrc for convenience
if ! grep -q "source ~/pixelated/.venv/bin/activate" ~/.zshrc; then
    echo "" >> ~/.zshrc
    echo "# Pixelated Empathy virtual environment" >> ~/.zshrc
    echo "source ~/pixelated/.venv/bin/activate" >> ~/.zshrc
fi

echo ""
echo "✅ UV CPU-Only Setup Complete!"
echo "================================"
echo "Virtual Environment: ~/pixelated/.venv"
echo "Activate: source ~/pixelated/.venv/bin/activate"
echo "Workspace: ~/pixelated/ngc_workspace"
echo ""
echo "Next: Deploy bias detection + crisis detection services"
