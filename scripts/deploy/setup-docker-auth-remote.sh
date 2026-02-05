#!/bin/bash
# Setup Docker registry authentication on remote server for NeMo Data Designer jobs

set -e

REMOTE_USER="${REMOTE_USER:-vivi}"
REMOTE_HOST="${REMOTE_HOST:-194.113.75.34}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"

echo "=========================================="
echo "Setting up Docker Registry Authentication"
echo "=========================================="
echo ""

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY is not set"
    echo "Please set NVIDIA_API_KEY environment variable"
    echo "  export NVIDIA_API_KEY=your-api-key"
    exit 1
fi

echo "Setting up Docker authentication on remote server..."
echo ""

# Setup Docker authentication for NGC registry
ssh "${REMOTE_USER}@${REMOTE_HOST}" << ENDSSH
set -e

echo "Logging in to NVIDIA Docker registry (nvcr.io)..."
echo "${NVIDIA_API_KEY}" | docker login nvcr.io -u '\$oauthtoken' --password-stdin

echo ""
echo "✅ Docker authentication configured"
echo ""

# Verify authentication
if docker pull nvcr.io/nvidia/nemo-microservices/data-designer:25.10 > /dev/null 2>&1; then
    echo "✅ Successfully pulled test image - authentication is working"
else
    echo "⚠️  Warning: Could not pull test image (this may be normal if image is already cached)"
fi

# Check if NeMo services are running and restart if needed
cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10 2>/dev/null || {
    echo "⚠️  NeMo services directory not found, skipping service restart"
    exit 0
}

echo ""
echo "Checking NeMo services status..."
if docker compose ps | grep -q "jobs-controller"; then
    echo "Restarting jobs-controller to pick up new authentication..."
    docker compose restart jobs-controller
    
    echo ""
    echo "Waiting for jobs-controller to restart..."
    sleep 10
    
    echo "Checking jobs-controller logs for authentication..."
    docker compose logs jobs-controller --tail 20 | grep -i "auth\|docker\|registry" || echo "No auth-related logs found (this may be normal)"
fi

echo ""
echo "✅ Setup complete!"
ENDSSH

echo ""
echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo ""
echo "✅ Docker registry authentication configured on remote server"
echo ""
echo "The jobs-controller should now be able to pull Docker images for job execution."
echo ""
echo "To test job execution, try generating a dataset with more than 10 samples:"
echo "  (Note: This will use the job API instead of preview API)"
echo ""

