#!/bin/bash
# Setup script for NVIDIA NeMo Data Designer

set -e

echo "=========================================="
echo "NVIDIA NeMo Data Designer Setup"
echo "=========================================="
echo ""

# Check if uv is available
if ! command -v uv &> /dev/null; then
    echo "❌ Error: uv is not installed"
    echo "Please install uv: https://github.com/astral-sh/uv"
    exit 1
fi

echo "✓ uv is installed"

# Check if we're in the correct directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: pyproject.toml not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "✓ Project root directory found"

# Install the package
echo ""
echo "Installing nemo-microservices[data-designer]..."
uv pip install 'nemo-microservices[data-designer]'

echo "✓ Package installed successfully"

# Check for .env file
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  Warning: .env file not found"
    echo "Creating .env.example with template..."
    cat > .env.example << 'EOF'
# NVIDIA NeMo Data Designer Configuration
# Get your API key from: https://build.nvidia.com/nemo/data-designer
NVIDIA_API_KEY=your-api-key-here
NEMO_DATA_DESIGNER_BASE_URL=https://ai.api.nvidia.com/v1/nemo/dd
NEMO_DATA_DESIGNER_TIMEOUT=300
NEMO_DATA_DESIGNER_MAX_RETRIES=3
NEMO_DATA_DESIGNER_BATCH_SIZE=1000
EOF
    echo "✓ Created .env.example"
    echo ""
    echo "📝 Next steps:"
    echo "1. Copy .env.example to .env: cp .env.example .env"
    echo "2. Edit .env and add your NVIDIA_API_KEY"
    echo "3. Get your API key from: https://build.nvidia.com/nemo/data-designer"
else
    echo "✓ .env file exists"
    
    # Check if NVIDIA_API_KEY is set
    if grep -q "NVIDIA_API_KEY=your-api-key-here" .env || ! grep -q "NVIDIA_API_KEY=" .env; then
        echo "⚠️  Warning: NVIDIA_API_KEY not configured in .env"
        echo "Please add your API key to .env file"
        echo "Get your API key from: https://build.nvidia.com/nemo/data-designer"
    else
        echo "✓ NVIDIA_API_KEY is configured"
    fi
fi

# Create data directory if it doesn't exist
mkdir -p data

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To test the installation, run:"
echo "  uv run python ai/data_designer/examples.py"
echo ""
echo "For more information, see:"
echo "  - docs/nemo-data-designer-setup.md"
echo "  - ai/data_designer/README.md"
echo ""

