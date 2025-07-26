#!/bin/bash

# Azure CLI Installation Script for Self-Hosted Agents
# This script installs Azure CLI without requiring sudo permissions
# Run this script on your self-hosted agent machine

set -e

echo "🔧 Installing Azure CLI for self-hosted agent..."

# Create local bin directory if it doesn't exist
mkdir -p ~/bin
mkdir -p ~/.local/bin

# Method 1: Try official installation script with user install
echo "📦 Attempting Method 1: Official installer with user install..."
if curl -L https://aka.ms/InstallAzureCli | bash -s -- --install-dir ~/.local/azure-cli --exec-dir ~/.local/bin; then
    echo "✅ Method 1 successful: Azure CLI installed via official installer"
    export PATH="$HOME/.local/bin:$PATH"
else
    echo "⚠️ Method 1 failed, trying Method 2..."
    
    # Method 2: Download and extract pre-built package
    echo "📦 Attempting Method 2: Download pre-built package..."
    cd /tmp
    curl -L -o azure-cli.tar.gz "https://aka.ms/azure-cli-latest-linux-x64-tar"
    tar -xzf azure-cli.tar.gz
    
    # Move to user directory
    mv azure-cli ~/.local/
    
    # Create symlink
    ln -sf ~/.local/azure-cli/bin/az ~/.local/bin/az
    export PATH="$HOME/.local/bin:$PATH"
    
    echo "✅ Method 2 successful: Azure CLI installed via pre-built package"
fi

# Verify installation
if command -v az &> /dev/null; then
    echo "✅ Azure CLI installation verified"
    az --version
    
    # Install Bicep
    echo "📦 Installing Bicep..."
    az bicep install
    echo "✅ Bicep installed successfully"
    az bicep version
    
    echo ""
    echo "🎉 Installation complete!"
    echo ""
    echo "To use Azure CLI in future sessions, add this to your ~/.bashrc or ~/.zshrc:"
    echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "Or run: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
    echo "       source ~/.bashrc"
    
else
    echo "❌ Azure CLI installation failed with all methods"
    echo "Please try manual installation or contact your system administrator"
    exit 1
fi
