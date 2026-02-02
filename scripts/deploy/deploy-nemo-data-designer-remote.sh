#!/bin/bash
# Deploy NeMo Data Designer to remote server using official method

set -e

REMOTE_USER="${REMOTE_USER:-vivi}"
REMOTE_HOST="${REMOTE_HOST:-212.2.244.60}"
REMOTE_PATH="${REMOTE_PATH:-~/nemo-microservices}"
REMOTE_PORT="${REMOTE_PORT:-8080}"

echo "=========================================="
echo "NeMo Data Designer Remote Deployment"
echo "=========================================="
echo ""
echo "Target: ${REMOTE_USER}@${REMOTE_HOST}"
echo "Path: ${REMOTE_PATH}"
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "⚠️  Warning: No SSH key found. You may need to enter password."
fi

# Test SSH connection
echo "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" exit 2>/dev/null; then
    echo "❌ Error: Cannot connect to ${REMOTE_USER}@${REMOTE_HOST}"
    echo "Please ensure:"
    echo "  1. SSH access is configured"
    echo "  2. SSH key is added to authorized_keys (or password authentication is enabled)"
    echo "  3. Server is accessible"
    exit 1
fi

echo "✅ SSH connection successful"

# Check if Docker is installed on remote
echo ""
echo "Checking Docker installation on remote server..."
if ! ssh "${REMOTE_USER}@${REMOTE_HOST}" "command -v docker &> /dev/null"; then
    echo "❌ Error: Docker is not installed on remote server"
    echo "Please install Docker first:"
    echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh'"
    exit 1
fi

echo "✅ Docker is installed"

# Check if Docker Compose is available
if ! ssh "${REMOTE_USER}@${REMOTE_HOST}" "docker compose version &> /dev/null 2>&1 || docker-compose version &> /dev/null 2>&1"; then
    echo "❌ Error: Docker Compose is not available on remote server"
    exit 1
fi

echo "✅ Docker Compose is available"

# Get NVIDIA API key from local .env if it exists
if [ -f .env ]; then
    NVIDIA_API_KEY=$(grep "^NVIDIA_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ')
else
    NVIDIA_API_KEY=""
fi

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY not found in local .env file"
    echo "Please add NVIDIA_API_KEY to your .env file"
    exit 1
fi

echo "✅ NVIDIA_API_KEY found"

# Copy deployment script to remote
echo ""
echo "Copying deployment script to remote server..."
scp scripts/deploy/deploy-nemo-data-designer-remote-server.sh "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/deploy.sh" 2>/dev/null || \
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_PATH}" && \
    scp scripts/deploy/deploy-nemo-data-designer-remote-server.sh "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/deploy.sh"

# Make script executable
ssh "${REMOTE_USER}@${REMOTE_HOST}" "chmod +x ${REMOTE_PATH}/deploy.sh"

# Run deployment on remote server
echo ""
echo "Starting deployment on remote server..."
echo "This will:"
echo "  1. Download NeMo Microservices quickstart package"
echo "  2. Set up Docker Compose configuration"
echo "  3. Start the Data Designer service"
echo ""

ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_PATH} && NVIDIA_API_KEY='${NVIDIA_API_KEY}' REMOTE_PORT='${REMOTE_PORT}' ./deploy.sh"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Service URL: http://${REMOTE_HOST}:${REMOTE_PORT}"
echo ""
echo "To check status:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH}/nemo-microservices-quickstart_* && docker compose ps'"
echo ""
echo "To view logs:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH}/nemo-microservices-quickstart_* && docker compose logs -f'"
echo ""
echo "To stop the service:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH}/nemo-microservices-quickstart_* && docker compose --profile data-designer down'"
echo ""
echo "Update your local .env file with:"
echo "  NEMO_DATA_DESIGNER_BASE_URL=http://${REMOTE_HOST}:${REMOTE_PORT}"
echo ""
