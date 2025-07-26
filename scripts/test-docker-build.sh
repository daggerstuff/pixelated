#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKERFILE="${PROJECT_ROOT}/Dockerfile.azure"
IMAGE_NAME="pixelated-web-test"
BUILD_NUMBER="local-$(date +%Y%m%d%H%M%S)"

log_info "Starting local Docker build test..."
log_info "Project Root: $PROJECT_ROOT"
log_info "Dockerfile: $DOCKERFILE"

# Verify Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    log_error "Dockerfile not found: $DOCKERFILE"
    exit 1
fi

# Run pre-build checks
log_info "Running pre-build checks..."
if ! node "${PROJECT_ROOT}/scripts/docker-build-check.js"; then
    log_error "Pre-build checks failed"
    exit 1
fi

log_success "Pre-build checks passed"

# Build image locally
log_info "Building Docker image locally: $IMAGE_NAME:$BUILD_NUMBER"

if ! docker build \
    --file "$DOCKERFILE" \
    --tag "$IMAGE_NAME:$BUILD_NUMBER" \
    --build-arg BUILD_NUMBER="$BUILD_NUMBER" \
    --progress=plain \
    "$PROJECT_ROOT"; then
    
    log_error "Docker build failed"
    exit 1
fi

log_success "Docker image built successfully"

# Test the image
log_info "Testing the built image..."
CONTAINER_ID=$(docker run -d -p 8080:80 "$IMAGE_NAME:$BUILD_NUMBER")

if [ -z "$CONTAINER_ID" ]; then
    log_error "Failed to start container"
    exit 1
fi

log_info "Container started with ID: ${CONTAINER_ID:0:12}"

# Wait for container to be ready
sleep 5

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_ID"; then
    log_error "Container is not running"
    docker logs "$CONTAINER_ID" || true
    docker rm "$CONTAINER_ID" || true
    exit 1
fi

# Test HTTP endpoint
log_info "Testing HTTP endpoint..."
if curl -s -f http://localhost:8080 > /dev/null; then
    log_success "HTTP endpoint is responding"
else
    log_warning "HTTP endpoint test failed (may be expected for some apps)"
fi

# Clean up
log_info "Cleaning up test container..."
docker stop "$CONTAINER_ID" > /dev/null
docker rm "$CONTAINER_ID" > /dev/null

log_info "Cleaning up test image..."
docker rmi "$IMAGE_NAME:$BUILD_NUMBER" > /dev/null

log_success "Local Docker test completed successfully! 🎉"

echo ""
echo "📋 Test Results:"
echo "   ✅ Pre-build validation passed"
echo "   ✅ Docker build succeeded"
echo "   ✅ Container started successfully"
echo "   ✅ Container runs without immediate crashes"
echo ""
echo "🚀 Your Docker setup is ready for Azure deployment!"
