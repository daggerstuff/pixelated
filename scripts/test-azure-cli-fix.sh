#!/bin/bash

# Test script to verify Azure CLI Python 3.13 compatibility fix
echo "🧪 Testing Azure CLI Python 3.13 compatibility fix with uv..."

# Set environment variables to suppress warnings
export PYTHONWARNINGS="ignore::FutureWarning"

echo "Environment variables set:"
echo "  PYTHONWARNINGS=$PYTHONWARNINGS"

# Check current Python version
echo "Current Python version:"
python3 --version

# Try uv first with Python 3.11
if command -v uv &> /dev/null; then
    echo "Installing Azure CLI via uv with Python 3.11..."
    
    # Create a virtual environment with Python 3.11 using uv
    uv venv ~/azure-cli-env --python 3.11
    
    # Activate the virtual environment
    source ~/azure-cli-env/bin/activate
    
    # Install Azure CLI using uv
    uv pip install azure-cli==2.73.0
    
    echo "✅ Azure CLI installed via uv with Python 3.11"
    ~/azure-cli-env/bin/az version
else
    echo "uv not available, falling back to pip with Python 3.11"
    
    # Install Python 3.11 if not available
    if ! command -v python3.11 &> /dev/null; then
        echo "Installing Python 3.11..."
        sudo apt-get update -qq
        sudo apt-get install -y python3.11 python3.11-pip python3.11-venv
    fi
    
    # Create virtual environment with Python 3.11
    echo "Creating Python 3.11 virtual environment..."
    python3.11 -m venv ~/azure-cli-env
    source ~/azure-cli-env/bin/activate
    
    # Install Azure CLI in the virtual environment
    echo "Installing Azure CLI in virtual environment..."
    pip install azure-cli==2.73.0
    
    echo "✅ Azure CLI installed in virtual environment"
    ~/azure-cli-env/bin/az version
fi

echo "🎉 Azure CLI compatibility test completed!"
echo ""
echo "If you see the Azure CLI version without Python warnings, the fix is working!"
echo "You can now run your Azure DevOps pipeline without the FutureWarning messages."
echo ""
echo "Note: This script now uses uv for faster Python package management."
