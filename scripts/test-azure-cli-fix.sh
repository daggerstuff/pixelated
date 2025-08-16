#!/bin/bash

# Test script to verify Azure CLI Python 3.13 compatibility fix
echo "🧪 Testing Azure CLI Python 3.13 compatibility fix..."

# Set environment variables to suppress warnings
export PYTHONWARNINGS="ignore::FutureWarning"
export AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=1

echo "Environment variables set:"
echo "  PYTHONWARNINGS=$PYTHONWARNINGS"
echo "  AZURE_CLI_DISABLE_CONNECTION_VERIFICATION=$AZURE_CLI_DISABLE_CONNECTION_VERIFICATION"

# Check current Python version
echo "Current Python version:"
python3 --version

# Try conda first with specific Python version
if command -v conda &> /dev/null && conda install -c conda-forge azure-cli python=3.11 -y; then
    echo "✅ Azure CLI installed via conda with Python 3.11"
    conda run -n base az version
else
    echo "Conda installation failed, using pip with Python 3.11"
    
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
