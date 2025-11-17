#!/bin/bash
# Deploy NeMo Data Designer using Docker Compose

set -e

echo "=========================================="
echo "NeMo Data Designer Deployment"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✓ Docker is installed"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose is not available"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker Compose is available"

# Check for NVIDIA API key
if [ -z "$NVIDIA_API_KEY" ] && [ ! -f .env ]; then
    echo "❌ Error: NVIDIA_API_KEY not found"
    echo "Please set NVIDIA_API_KEY environment variable or add it to .env file"
    exit 1
fi

# Load .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✓ Loaded environment variables from .env"
fi

if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ Error: NVIDIA_API_KEY is not set"
    echo "Please add NVIDIA_API_KEY to your .env file or export it"
    exit 1
fi

echo "✓ NVIDIA_API_KEY is configured"

# Check if compose file exists
if [ ! -f "docker-compose.nemo-data-designer.yml" ]; then
    echo "❌ Error: docker-compose.nemo-data-designer.yml not found"
    exit 1
fi

echo ""
echo "Starting NeMo Data Designer..."
echo ""

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    DOCKER_COMPOSE_CMD="docker compose"
fi

# Start the service
$DOCKER_COMPOSE_CMD -f docker-compose.nemo-data-designer.yml up -d

echo ""
echo "Waiting for service to be healthy..."
sleep 10

# Check health
if curl -f http://localhost:8000/health &> /dev/null; then
    echo "✅ NeMo Data Designer is running and healthy!"
    echo ""
    echo "Service URL: http://localhost:8000"
    echo "Health Check: http://localhost:8000/health"
    echo ""
    echo "Update your .env file with:"
    echo "  NEMO_DATA_DESIGNER_BASE_URL=http://localhost:8000"
    echo ""
    echo "To view logs:"
    echo "  $DOCKER_COMPOSE_CMD -f docker-compose.nemo-data-designer.yml logs -f"
    echo ""
    echo "To stop the service:"
    echo "  $DOCKER_COMPOSE_CMD -f docker-compose.nemo-data-designer.yml down"
else
    echo "⚠️  Service started but health check failed"
    echo "Check logs with: $DOCKER_COMPOSE_CMD -f docker-compose.nemo-data-designer.yml logs"
fi

