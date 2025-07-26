#!/bin/bash
# Test Azure CLI Installation for Pipeline
# This script simulates the pipeline environment to test Azure CLI installation

set -e

echo "🧪 Testing Azure CLI Installation for Pipeline Environment"
echo "========================================================"

# Create a temporary test environment
TEST_HOME="/tmp/pipeline-test-$$"
mkdir -p "$TEST_HOME"
cd "$TEST_HOME"

echo "📁 Test environment: $TEST_HOME"

# Set up environment similar to pipeline
export HOME="$TEST_HOME"
export PATH="$TEST_HOME/.local/bin:$PATH"
mkdir -p "$TEST_HOME/.local/bin"
mkdir -p "$TEST_HOME/.local/lib"

echo "🔍 Environment setup:"
echo "  HOME: $HOME"
echo "  PATH: $PATH"
echo "  USER: $(whoami)"

# Copy the installation script
cp "/home/vivi/pixel/scripts/install-azure-cli-userspace.sh" "$TEST_HOME/"
chmod +x "$TEST_HOME/install-azure-cli-userspace.sh"

echo ""
echo "🚀 Starting Azure CLI installation test..."
echo "==========================================="

# Run the installation script
if "$TEST_HOME/install-azure-cli-userspace.sh"; then
    echo ""
    echo "✅ Installation test PASSED"
    echo "Azure CLI is available and working"
    
    # Test basic functionality
    echo ""
    echo "🔍 Testing basic Azure CLI functionality:"
    "$TEST_HOME/.local/bin/az" --version
    
    echo ""
    echo "📍 Installation details:"
    echo "  Azure CLI location: $(which az || echo 'Not in PATH')"
    echo "  Azure CLI path: $TEST_HOME/.local/bin/az"
    echo "  Test environment: $TEST_HOME"
    
else
    echo ""
    echo "❌ Installation test FAILED"
    echo "Azure CLI installation did not succeed"
    exit 1
fi

echo ""
echo "🧹 Cleaning up test environment..."
cd /tmp
rm -rf "$TEST_HOME"

echo ""
echo "🎉 Azure CLI installation test completed successfully!"
echo "The script should work in your Azure DevOps pipeline."
