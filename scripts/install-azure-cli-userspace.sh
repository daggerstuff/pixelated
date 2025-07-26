#!/bin/bash
# Install Azure CLI in user space without sudo requirements
# This script can be run in the Azure DevOps pipeline
# Updated to work with externally managed Python environments and Azure DevOps agents

set -e

echo "🔧 Setting up Azure CLI 2.73.0 for deployment..."

# Create local directories
mkdir -p ~/.local/bin
mkdir -p ~/.local/lib

# Function to verify Azure CLI installation
verify_azure_cli() {
    if command -v az >/dev/null 2>&1; then
        local version=$(az version --output tsv --query '"azureCli"' 2>/dev/null || echo 'unknown')
        echo "✅ Azure CLI found: $(which az)"
        echo "Current version: $version"

        # Set pipeline variables
        echo "##vso[task.setvariable variable=azCliInstalled]true"
        echo "##vso[task.setvariable variable=azCliPath]$(dirname $(which az))"
        echo "##vso[task.setvariable variable=PATH]$(dirname $(which az)):$PATH"
        return 0
    fi
    return 1
}

# Check if Azure CLI is already available and working
echo "🔍 Checking for existing Azure CLI installation..."
if verify_azure_cli; then
    echo "✅ Azure CLI already available and working"
    exit 0
fi

# Method 1: Try pipx installation (best for externally managed environments)
echo "📦 Method 1: Attempting pipx installation..."
if command -v pipx >/dev/null 2>&1; then
    echo "📦 pipx found, installing Azure CLI..."

    if pipx install azure-cli; then
        echo "✅ Azure CLI installed via pipx"

        # Ensure pipx bin directory is in PATH
        PIPX_BIN_DIR="$HOME/.local/bin"
        export PATH="$PIPX_BIN_DIR:$PATH"

        if verify_azure_cli; then
            echo "✅ Azure CLI is working via pipx"
            exit 0
        fi
    fi
else
    echo "⚠️ pipx not found, trying alternative methods..."
fi

# Method 2: Try UV-based installation (respects externally managed environments)
echo "📦 Method 2: Attempting UV-based installation..."
if command -v uv >/dev/null 2>&1; then
    echo "📦 UV found, creating virtual environment for Azure CLI..."

    # Create a dedicated virtual environment for Azure CLI
    if uv venv ~/.local/lib/azure-cli-venv --python 3.10; then
        # Install Azure CLI in the virtual environment
        if ~/.local/lib/azure-cli-venv/bin/pip install azure-cli; then
            echo "✅ Azure CLI installed via UV/venv"

            # Create wrapper script
            cat > ~/.local/bin/az << 'EOF'
#!/bin/bash
exec ~/.local/lib/azure-cli-venv/bin/az "$@"
EOF
            chmod +x ~/.local/bin/az

            # Ensure ~/.local/bin is in PATH
            export PATH="$HOME/.local/bin:$PATH"

            if verify_azure_cli; then
                echo "✅ Azure CLI is working via UV"
                exit 0
            fi
        fi
    fi
else
    echo "⚠️ UV not found, trying pip with virtual environment..."
fi

# Method 3: Try virtual environment with system python
echo "📦 Method 3: Attempting virtual environment installation..."
if command -v python3 >/dev/null 2>&1; then
        # Install Azure CLI in the virtual environment
        if ~/.local/lib/azure-cli-venv/bin/pip install azure-cli; then
            echo "✅ Azure CLI installed via venv"

            # Create wrapper script
            cat > ~/.local/bin/az << 'EOF'
#!/bin/bash
exec ~/.local/lib/azure-cli-venv/bin/az "$@"
EOF
            chmod +x ~/.local/bin/az

            # Ensure ~/.local/bin is in PATH
            export PATH="$HOME/.local/bin:$PATH"

            if verify_azure_cli; then
                echo "✅ Azure CLI is working via venv"
                exit 0
            fi
        fi
    fi
fi

# Method 4: Try static binary download (no dependencies)
echo "📦 Method 4: Attempting static binary download..."

# Determine architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64) ARCH="x64" ;;
    aarch64) ARCH="arm64" ;;
    *) echo "⚠️ Unsupported architecture: $ARCH"; ARCH="x64" ;;
esac

# Download static binary
BINARY_URL="https://azcliprod.azureedge.net/cli-extensions/azure-cli-linux-$ARCH.tar.gz"
echo "📦 Downloading Azure CLI binary for $ARCH..."

if curl -fsSL "$BINARY_URL" 2>/dev/null | tar -xz -C ~/.local/lib/ 2>/dev/null; then
    # Create symlink
    ln -sf ~/.local/lib/azure-cli/bin/az ~/.local/bin/az
    chmod +x ~/.local/bin/az

    # Update PATH
    export PATH="$HOME/.local/bin:$PATH"

    if verify_azure_cli; then
        echo "✅ Azure CLI static binary installed"
        exit 0
    fi
fi

# Method 3: Download static binary (fallback)
echo "🔄 Official script failed, trying static binary download..."
AZURE_CLI_VERSION="2.75.0"
ARCH=$(uname -m)

case $ARCH in
    x86_64)
        BINARY_URL="https://azcliprod.azureedge.net/cli-extensions/azure-cli-${AZURE_CLI_VERSION}-linux-amd64.tar.gz"
        ;;
    aarch64|arm64)
        BINARY_URL="https://azcliprod.azureedge.net/cli-extensions/azure-cli-${AZURE_CLI_VERSION}-linux-arm64.tar.gz"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "📦 Downloading Azure CLI binary for $ARCH..."
if curl -fsSL "$BINARY_URL" 2>/dev/null | tar -xz -C ~/.local/lib/ 2>/dev/null; then
    # Create symlink
    ln -sf ~/.local/lib/azure-cli/bin/az ~/.local/bin/az
    chmod +x ~/.local/bin/az
    
    # Update PATH
    export PATH="$HOME/.local/bin:$PATH"
    
    # Verify installation
    if command -v az >/dev/null 2>&1; then
        echo "✅ Azure CLI static binary installed"
        az --version
        echo "##vso[task.setvariable variable=azCliInstalled]true"
        echo "##vso[task.setvariable variable=azCliPath]$HOME/.local/bin"
        exit 0
    fi
fi

# Method 4: Final fallback - use system package manager (requires sudo but most reliable)
echo "🔄 All user-space methods failed, trying system installation as final fallback..."
if command -v sudo >/dev/null 2>&1; then
    echo "📦 Using system package manager (requires sudo)..."
    if curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash; then
        echo "✅ Azure CLI installed via system package manager"
        
        # Verify installation
        if command -v az >/dev/null 2>&1; then
            echo "✅ Azure CLI is working via system installation"
            az --version
            echo "##vso[task.setvariable variable=azCliInstalled]true"
            echo "##vso[task.setvariable variable=azCliPath]/usr/bin"
            exit 0
        fi
    fi
fi

# Final verification
export PATH="$HOME/.local/bin:$PATH"
if command -v az >/dev/null 2>&1; then
    echo "✅ Azure CLI installed successfully"
    az --version
    echo "##vso[task.setvariable variable=azCliInstalled]true"
    echo "##vso[task.setvariable variable=azCliPath]$HOME/.local/bin"
else
    echo "❌ All Azure CLI installation methods failed"
    echo "💡 Recommendations:"
    echo "   1. Pre-install Azure CLI on the agent machine using: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    echo "   2. Or use Microsoft-hosted agents which have Azure CLI pre-installed"
    echo "   3. Or use a Docker container with Azure CLI pre-installed"
    echo "Please manually install Azure CLI on the agent machine or contact your DevOps administrator"
    exit 1
fi
