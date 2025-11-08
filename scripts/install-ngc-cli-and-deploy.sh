#!/bin/bash
# Install NGC CLI on remote server and deploy NeMo Data Designer

set -e

REMOTE_USER="${REMOTE_USER:-vivi}"
REMOTE_HOST="${REMOTE_HOST:-212.2.244.60}"
REMOTE_PATH="${REMOTE_PATH:-~/nemo-microservices}"

echo "=========================================="
echo "NeMo Data Designer - NGC CLI Deployment"
echo "=========================================="
echo ""

# Test SSH connection
echo "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 "${REMOTE_USER}@${REMOTE_HOST}" exit 2>/dev/null; then
    echo "❌ Error: Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}"
    exit 1
fi

echo "✅ SSH connection successful"

# Install NGC CLI on remote server using uv
echo ""
echo "Installing NGC CLI on remote server using uv..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" << 'ENDSSH'
# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Install NGC CLI using uv
echo "Installing NGC CLI using uv..."
uv pip install nvidia-pyindex nvidia-nim ngc-python-cli

# Verify installation
if uv run ngc --version &> /dev/null; then
    echo "✅ NGC CLI installed successfully via uv"
    uv run ngc --version
else
    echo "❌ Error: NGC CLI installation failed"
    exit 1
fi
ENDSSH

echo ""
echo "=========================================="
echo "NGC CLI Configuration"
echo "=========================================="
echo ""
echo "You need to configure NGC CLI with your API key."
echo "Run this command to configure:"
echo ""
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'ngc config set'"
echo ""
echo "Or provide your NGC API key (not the same as NVIDIA_API_KEY):"
read -p "Enter your NGC API key (or press Enter to skip and configure manually): " NGC_API_KEY

if [ -n "$NGC_API_KEY" ]; then
    echo "Configuring NGC CLI..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "ngc config set CLI.apikey '${NGC_API_KEY}'" || {
        echo "⚠️  Automatic configuration failed. Please configure manually:"
        echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'ngc config set'"
    }
fi

# Now download and deploy
echo ""
echo "Downloading NeMo Microservices quickstart..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" << ENDSSH
mkdir -p ${REMOTE_PATH}
cd ${REMOTE_PATH}

# Download using NGC CLI
ngc registry resource download-version "nvidia/nemo-microservices/nemo-microservices-quickstart:25.10" || {
    echo "❌ Download failed. Please check NGC CLI configuration."
    exit 1
}

cd nemo-microservices-quickstart_v25.10

# Set environment variables
export NEMO_MICROSERVICES_IMAGE_REGISTRY="nvcr.io/nvidia/nemo-microservices"
export NEMO_MICROSERVICES_IMAGE_TAG="25.10"
export NIM_API_KEY="${NVIDIA_API_KEY}"

# Login to Docker registry
echo "\$NIM_API_KEY" | docker login nvcr.io -u '\$oauthtoken' --password-stdin

# Start the service
docker compose --profile data-designer up -d

echo "✅ Deployment complete!"
ENDSSH

echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo ""
echo "Service should be accessible at: http://${REMOTE_HOST}:8080"
echo ""
echo "To check status:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10 && docker compose ps'"
echo ""
echo "Update your local .env file with:"
echo "  NEMO_DATA_DESIGNER_BASE_URL=http://${REMOTE_HOST}:8080"
echo ""

