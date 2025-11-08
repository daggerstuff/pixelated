#!/bin/bash
# Fix jobs-controller Docker authentication on remote server

set -e

REMOTE_USER="${REMOTE_USER:-vivi}"
REMOTE_HOST="${REMOTE_HOST:-212.2.244.60}"

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY environment variable is not set"
    echo "Please set it: export NVIDIA_API_KEY=your-api-key"
    exit 1
fi

echo "=========================================="
echo "Fixing Jobs-Controller Authentication"
echo "=========================================="
echo ""

ssh "${REMOTE_USER}@${REMOTE_HOST}" << ENDSSH
set -e

cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10 || {
    echo "❌ Error: NeMo services directory not found"
    exit 1
}

echo "Setting NIM_API_KEY environment variable..."
export NIM_API_KEY="${NVIDIA_API_KEY}"

echo "Stopping services..."
docker compose stop jobs-controller data-designer || true

echo ""
echo "Restarting services with updated environment..."
# Export the API key and restart
NIM_API_KEY="${NVIDIA_API_KEY}" docker compose up -d jobs-controller data-designer

echo ""
echo "Waiting for services to start..."
sleep 10

echo ""
echo "Checking jobs-controller logs..."
docker compose logs jobs-controller --tail 20

echo ""
echo "✅ Jobs-controller restarted with NIM_API_KEY"
ENDSSH

echo ""
echo "=========================================="
echo "Setup Complete"
echo "=========================================="
echo ""
echo "The jobs-controller should now have access to NIM_API_KEY for Docker registry authentication."
echo ""
echo "To verify, check the logs:"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/nemo-microservices/nemo-microservices-quickstart_v25.10 && docker compose logs jobs-controller --tail 20'"
echo ""

