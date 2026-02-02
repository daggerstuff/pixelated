#!/bin/bash
# Deployment script to run on remote server
# Based on official NeMo Microservices deployment

set -e

# Set PATH explicitly to include common installation locations
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Set UV path explicitly if it exists
if [ -f "$HOME/.local/bin/uv" ]; then
    UV_CMD="$HOME/.local/bin/uv"
elif [ -f "$HOME/.cargo/bin/uv" ]; then
    UV_CMD="$HOME/.cargo/bin/uv"
elif command -v uv &> /dev/null; then
    UV_CMD="uv"
else
    UV_CMD=""
fi

REMOTE_PORT="${REMOTE_PORT:-8080}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"

echo "=========================================="
echo "NeMo Data Designer - Remote Server Setup"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    exit 1
fi

echo "✅ Docker is installed"

# Check if Docker Compose is available
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "❌ Error: Docker Compose is not available"
    exit 1
fi

echo "✅ Docker Compose is available"

# Check for NVIDIA API key
if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY is not set"
    echo "Please set NVIDIA_API_KEY environment variable"
    exit 1
fi

echo "✅ NVIDIA_API_KEY is configured"

# Check if NGC CLI is needed (for downloading resources)
# We'll use direct download method instead

# Download NeMo Microservices quickstart
echo ""
echo "Downloading NeMo Microservices quickstart package..."
QUICKSTART_VERSION="25.10"
QUICKSTART_DIR="nemo-microservices-quickstart_v${QUICKSTART_VERSION}"

if [ ! -d "$QUICKSTART_DIR" ]; then
    echo "Downloading NeMo Microservices quickstart package using NGC CLI..."
    
    # Try multiple methods to find and use NGC CLI
    NGC_CMD=""
    
    # Method 1: Check if ngc is in PATH
    if command -v ngc &> /dev/null; then
        NGC_CMD="ngc"
        echo "Found NGC CLI in PATH"
    # Method 2: Check common installation location
    elif [ -f "$HOME/ngc-cli/ngc" ]; then
        NGC_CMD="$HOME/ngc-cli/ngc"
        export PATH="$HOME/ngc-cli:$PATH"
        echo "Found NGC CLI at $HOME/ngc-cli/ngc"
    # Method 3: Use uv to run ngc (uv path is already set above)
    elif [ -n "$UV_CMD" ]; then
        echo "Using uv at $UV_CMD to run NGC CLI..."
        # Check if ngc is installed via uv
        if "$UV_CMD" pip list 2>/dev/null | grep -q ngc; then
            NGC_CMD="$UV_CMD run ngc"
        else
            echo "Installing NGC CLI via uv..."
            "$UV_CMD" pip install nvidia-pyindex ngcsdk
            NGC_CMD="$UV_CMD run ngc"
        fi
    else
        echo "❌ Error: Cannot find NGC CLI or uv"
        echo "Please ensure either:"
        echo "  1. NGC CLI is installed and in PATH"
        echo "  2. uv is installed at ~/.local/bin/uv or ~/.cargo/bin/uv"
        exit 1
    fi
    
    # Download using NGC CLI
    echo "Downloading version ${QUICKSTART_VERSION}..."
    echo "Using command: $NGC_CMD"
    eval "$NGC_CMD registry resource download-version \"nvidia/nemo-microservices/nemo-microservices-quickstart:${QUICKSTART_VERSION}\"" || {
        echo "❌ Error: NGC CLI download failed"
        echo "Please check:"
        echo "  1. NGC CLI is configured: $NGC_CMD config get"
        echo "  2. You have access to the resource"
        exit 1
    }
    
    # Check if download was successful
    if [ -d "$QUICKSTART_DIR" ]; then
        echo "✅ Downloaded and extracted quickstart package"
    else
        echo "❌ Error: Quickstart package not found after download"
        echo "Expected directory: $QUICKSTART_DIR"
        ls -la
        exit 1
    fi
else
    echo "✅ Quickstart package already exists"
fi

cd "$QUICKSTART_DIR" || exit 1

# Set environment variables
export NEMO_MICROSERVICES_IMAGE_REGISTRY="nvcr.io/nvidia/nemo-microservices"
export NEMO_MICROSERVICES_IMAGE_TAG="${QUICKSTART_VERSION}"
export NIM_API_KEY="${NVIDIA_API_KEY}"

# Authenticate with NGC (if NGC CLI is available)
if command -v ngc &> /dev/null; then
    echo ""
    echo "Authenticating with NGC..."
    echo "${NVIDIA_API_KEY}" | ngc registry login --apikey-stdin || echo "⚠️  NGC CLI authentication failed, continuing..."
fi

# Login to Docker registry
echo ""
echo "Logging in to NVIDIA container registry..."
echo "${NVIDIA_API_KEY}" | docker login nvcr.io -u '$oauthtoken' --password-stdin || {
    echo "⚠️  Warning: Docker registry login failed"
    echo "You may need to authenticate manually"
}

# Start the Data Designer service
echo ""
echo "Starting NeMo Data Designer service..."
echo "This may take a few minutes to pull images..."

$DOCKER_COMPOSE_CMD --profile data-designer up -d

echo ""
echo "Waiting for services to start..."
sleep 20

# Check if services are running
echo ""
echo "Checking service status..."
if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    echo "✅ Services are running"
    
    # Check health endpoint
    echo ""
    echo "Checking health endpoint..."
    sleep 10
    
    if curl -f "http://localhost:${REMOTE_PORT}/health" &> /dev/null 2>&1; then
        echo "✅ NeMo Data Designer is healthy!"
        echo ""
        echo "Service is accessible at: http://0.0.0.0:${REMOTE_PORT}"
    else
        echo "⚠️  Health check failed, but services are running"
        echo "Service may still be starting up. Check logs with:"
        echo "  $DOCKER_COMPOSE_CMD logs -f"
    fi
else
    echo "⚠️  Some services may not be running"
    echo "Check logs with: $DOCKER_COMPOSE_CMD logs"
fi

echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo ""
echo "Service URL: http://0.0.0.0:${REMOTE_PORT}"
echo ""
echo "Useful commands:"
echo "  View logs:     $DOCKER_COMPOSE_CMD logs -f"
echo "  Check status: $DOCKER_COMPOSE_CMD ps"
echo "  Stop service: $DOCKER_COMPOSE_CMD --profile data-designer down"
echo "  Restart:      $DOCKER_COMPOSE_CMD --profile data-designer restart"
echo ""
