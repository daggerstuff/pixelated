#!/bin/bash
# Azure CLI Docker Wrapper
# This script provides Azure CLI functionality using Docker when native installation fails
# Perfect for environments where Azure CLI installation is problematic

set -e

echo "🐳 Setting up Azure CLI via Docker container..."

# Create local bin directory
mkdir -p ~/.local/bin

# Create Azure CLI wrapper script
cat > ~/.local/bin/az << 'EOF'
#!/bin/bash

# Azure CLI Docker Wrapper Script
# This script runs Azure CLI commands in a Docker container

# Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Error: Docker is not available. Cannot use Azure CLI Docker wrapper."
    echo "Please install Docker or use a different Azure CLI installation method."
    exit 1
fi

# Azure CLI Docker image
AZURE_CLI_IMAGE="mcr.microsoft.com/azure-cli:latest"

# Mount current directory as workspace
WORKSPACE_DIR=$(pwd)

# Handle Azure CLI authentication and config
AZURE_CONFIG_DIR="$HOME/.azure"
mkdir -p "$AZURE_CONFIG_DIR"

# Docker run command with proper volume mounts
docker run --rm -it \
    -v "$WORKSPACE_DIR:/workspace" \
    -v "$AZURE_CONFIG_DIR:/root/.azure" \
    -w /workspace \
    "$AZURE_CLI_IMAGE" \
    az "$@"
EOF

# Make the wrapper executable
chmod +x ~/.local/bin/az

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Test the Docker-based Azure CLI
echo "🧪 Testing Docker-based Azure CLI..."
if ~/.local/bin/az version >/dev/null 2>&1; then
    echo "✅ Azure CLI Docker wrapper is working"
    
    # Set Azure DevOps pipeline variables
    echo "##vso[task.setvariable variable=azCliInstalled]true"
    echo "##vso[task.setvariable variable=azCliPath]$HOME/.local/bin"
    echo "##vso[task.setvariable variable=azCliMethod]docker"
    echo "##vso[task.setvariable variable=PATH]$HOME/.local/bin:$PATH"
    
    # Show version info
    ~/.local/bin/az version
    
    echo ""
    echo "🎉 Azure CLI is ready via Docker!"
    echo "📝 Note: All Azure CLI commands will run in Docker containers"
    echo "🔐 Azure authentication will be persisted in ~/.azure/"
    
    exit 0
else
    echo "❌ Azure CLI Docker wrapper test failed"
    exit 1
fi
