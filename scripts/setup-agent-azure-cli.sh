#!/bin/bash
# Setup Azure CLI on Self-Hosted Agent Machine
# Run this script ONCE on your self-hosted agent to install Azure CLI system-wide
# This will make Azure CLI available for all pipeline runs

set -e

echo "🔧 Setting up Azure CLI on self-hosted agent machine..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script needs to be run with sudo to install system-wide"
    echo "Usage: sudo ./scripts/setup-agent-azure-cli.sh"
    exit 1
fi

# Update package lists
echo "📦 Updating package lists..."
apt-get update -q

# Install prerequisites
echo "📦 Installing prerequisites..."
apt-get install -y curl gnupg lsb-release ca-certificates

# Check if Azure CLI is already installed
if command -v az >/dev/null 2>&1; then
    echo "✅ Azure CLI is already installed:"
    az --version
    
    # Update to latest version
    echo "🔄 Updating Azure CLI to latest version..."
    apt-get update -q
    apt-get install -y azure-cli
    
    echo "✅ Azure CLI updated successfully:"
    az --version
else
    # Install Azure CLI using Microsoft's official script
    echo "📦 Installing Azure CLI using Microsoft's official script..."
    curl -sL https://aka.ms/InstallAzureCLIDeb | bash
    
    echo "✅ Azure CLI installed successfully:"
    az --version
fi

# Install/Update Bicep
echo "📦 Installing/Updating Bicep..."
az bicep install

echo "✅ Bicep installation verified:"
az bicep version

# Verify installation location
echo ""
echo "📍 Installation details:"
echo "Azure CLI location: $(which az)"
echo "Azure CLI version: $(az --version | head -n1)"
echo "Bicep version: $(az bicep version)"

echo ""
echo "🎉 Azure CLI and Bicep are now ready for pipeline use!"
echo ""
echo "💡 The Azure CLI is now available system-wide and will be accessible"
echo "   to all Azure DevOps pipeline runs on this agent machine."
