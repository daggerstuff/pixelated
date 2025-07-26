#!/bin/bash
# Azure CLI Setup for Azure DevOps Pipeline
# This script handles Azure CLI installation without sudo requirements
# Optimized for Azure DevOps agents and externally managed Python environments

set -e

echo "🔧 Setting up Azure CLI 2.73.0 for deployment..."

# Function to verify Azure CLI installation and set pipeline variables
verify_and_set_variables() {
    if command -v az >/dev/null 2>&1; then
        local version=$(az version --output tsv --query '"azureCli"' 2>/dev/null || echo 'unknown')
        local az_path=$(which az)
        local az_dir=$(dirname "$az_path")

        echo "✅ Azure CLI verified: $az_path"
        echo "Current version: $version"

        # Check for EXACT version 2.73.0
        if [[ "$version" == "2.73.0" ]]; then
            echo "✅ Azure CLI version $version is correct (exactly 2.73.0)"

            # Set Azure DevOps pipeline variables
            echo "##vso[task.setvariable variable=azCliInstalled]true"
            echo "##vso[task.setvariable variable=azCliPath]$az_dir"
            echo "##vso[task.setvariable variable=PATH]$az_dir:$PATH"
            echo "##vso[task.setvariable variable=azCliVersion]$version"

            # Test basic functionality
            if az version >/dev/null 2>&1; then
                echo "✅ Azure CLI is functional"
                return 0
            else
                echo "⚠️ Azure CLI found but not functional"
                return 1
            fi
        else
            echo "❌ Azure CLI version $version is incorrect (need exactly 2.73.0)"
            echo "🔄 Removing incorrect version and installing 2.73.0..."

            # Remove existing Azure CLI
            if [[ "$az_path" == *"/.local/"* ]]; then
                echo "Removing user-installed Azure CLI..."
                rm -rf ~/.local/lib/azure-cli* ~/.local/bin/az 2>/dev/null || true
            fi

            return 1
        fi
    fi
    return 1
}

# Check if Azure CLI is already available
echo "🔍 Checking for existing Azure CLI installation..."
if verify_and_set_variables; then
    echo "✅ Azure CLI already available and working"
    exit 0
fi

# Create local directories for user-space installation
mkdir -p ~/.local/bin
mkdir -p ~/.local/lib

# Method 1: Try conda installation (common in Azure DevOps agents)
echo "📦 Method 1: Attempting conda installation..."
if command -v conda >/dev/null 2>&1; then
    echo "📦 Conda found, installing Azure CLI..."
    
    # Activate conda environment if available
    if [ -f "/home/vivi/miniconda3/etc/profile.d/conda.sh" ]; then
        source /home/vivi/miniconda3/etc/profile.d/conda.sh
        conda activate base 2>/dev/null || true
    fi
    
    # Install Azure CLI via conda
    if conda install -c conda-forge azure-cli -y; then
        echo "✅ Azure CLI installed via conda"
        
        if verify_and_set_variables; then
            echo "✅ Azure CLI is working via conda"
            exit 0
        fi
    fi
else
    echo "⚠️ Conda not found"
fi

# Method 2: Try pipx installation (best for externally managed environments)
echo "📦 Method 2: Attempting pipx installation..."
if command -v pipx >/dev/null 2>&1; then
    echo "📦 pipx found, installing Azure CLI..."
    
    if pipx install azure-cli; then
        echo "✅ Azure CLI installed via pipx"
        
        # Ensure pipx bin directory is in PATH
        export PATH="$HOME/.local/bin:$PATH"
        
        if verify_and_set_variables; then
            echo "✅ Azure CLI is working via pipx"
            exit 0
        fi
    fi
else
    echo "⚠️ pipx not found"
fi

# Method 3: Try virtual environment installation
echo "📦 Method 3: Attempting virtual environment installation..."
if command -v python3 >/dev/null 2>&1; then
    echo "📦 Creating virtual environment for Azure CLI..."
    
    # Create virtual environment
    if python3 -m venv ~/.local/lib/azure-cli-venv; then
        # Install Azure CLI in the virtual environment
        if ~/.local/lib/azure-cli-venv/bin/pip install azure-cli; then
            echo "✅ Azure CLI installed in virtual environment"
            
            # Create wrapper script
            cat > ~/.local/bin/az << 'EOF'
#!/bin/bash
exec ~/.local/lib/azure-cli-venv/bin/az "$@"
EOF
            chmod +x ~/.local/bin/az
            
            # Update PATH
            export PATH="$HOME/.local/bin:$PATH"
            
            if verify_and_set_variables; then
                echo "✅ Azure CLI is working via virtual environment"
                exit 0
            fi
        fi
    fi
else
    echo "⚠️ Python3 not found"
fi

# Method 4: Try static binary download
echo "📦 Method 4: Attempting static binary download..."

# Determine architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64) BINARY_ARCH="x64" ;;
    aarch64) BINARY_ARCH="arm64" ;;
    *) echo "⚠️ Unsupported architecture: $ARCH"; BINARY_ARCH="x64" ;;
esac

# Download and extract static binary
BINARY_URL="https://azcliprod.azureedge.net/cli-extensions/azure-cli-linux-$BINARY_ARCH.tar.gz"
echo "📦 Downloading Azure CLI binary for $BINARY_ARCH..."

if curl -fsSL "$BINARY_URL" 2>/dev/null | tar -xz -C ~/.local/lib/ 2>/dev/null; then
    # Create symlink
    ln -sf ~/.local/lib/azure-cli/bin/az ~/.local/bin/az
    chmod +x ~/.local/bin/az
    
    # Update PATH
    export PATH="$HOME/.local/bin:$PATH"
    
    if verify_and_set_variables; then
        echo "✅ Azure CLI static binary installed and working"
        exit 0
    fi
fi

# Method 5: Try pip with --break-system-packages (last resort for user space)
echo "📦 Method 5: Attempting pip with --break-system-packages..."
if command -v pip3 >/dev/null 2>&1; then
    echo "📦 Using pip3 with --break-system-packages..."
    
    if pip3 install --user --break-system-packages azure-cli; then
        echo "✅ Azure CLI installed via pip --break-system-packages"
        
        # Ensure ~/.local/bin is in PATH
        export PATH="$HOME/.local/bin:$PATH"
        
        if verify_and_set_variables; then
            echo "✅ Azure CLI is working via pip"
            exit 0
        fi
    fi
fi

# Final attempt: Check if Azure CLI is available in system PATH
echo "🔍 Final check: Looking for system-installed Azure CLI..."
export PATH="/usr/bin:/usr/local/bin:/opt/az/bin:$PATH"
if verify_and_set_variables; then
    echo "✅ Found system-installed Azure CLI"
    exit 0
fi

# All methods failed
echo "❌ All Azure CLI installation methods failed!"
echo ""
echo "🔍 Environment Information:"
echo "- PATH: $PATH"
echo "- HOME: $HOME"
echo "- User: $(whoami)"
echo "- Python3: $(command -v python3 >/dev/null && echo 'Available' || echo 'Not available')"
echo "- Pip3: $(command -v pip3 >/dev/null && echo 'Available' || echo 'Not available')"
echo "- Conda: $(command -v conda >/dev/null && echo 'Available' || echo 'Not available')"
echo "- Pipx: $(command -v pipx >/dev/null && echo 'Available' || echo 'Not available')"
echo "- Curl: $(command -v curl >/dev/null && echo 'Available' || echo 'Not available')"
echo ""
echo "💡 Recommendations for Azure DevOps Pipeline:"
echo "1. Use Microsoft-hosted agents (have Azure CLI pre-installed)"
echo "2. Pre-install Azure CLI on self-hosted agents"
echo "3. Use Azure CLI Docker container task"
echo "4. Install Azure CLI in agent setup script with sudo privileges"
echo ""
echo "🐳 Alternative: Use Azure CLI Docker container"
echo "   docker run --rm -v \$(pwd):/workspace mcr.microsoft.com/azure-cli:latest"

exit 1
