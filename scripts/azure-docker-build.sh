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
IMAGE_NAME="pixelated-web"
BUILD_NUMBER="${BUILD_BUILDNUMBER:-$(date +%Y%m%d%H%M%S)}"

# Pre-build checks
log_info "Running pre-build checks..."
if ! node "${PROJECT_ROOT}/scripts/docker-build-check.js"; then
    log_error "Pre-build checks failed"
    exit 1
fi

log_success "Pre-build checks passed"

# Find Container Registry
log_info "Finding container registry..."
REGISTRY_NAME=$(az acr list --query "[?contains(name, 'pixelcr')].name" -o tsv | head -1)

if [ -z "$REGISTRY_NAME" ]; then
    log_error "No container registry found with name containing 'pixelcr'"
    exit 1
fi

log_success "Found Container Registry: $REGISTRY_NAME"

# Get login server
LOGIN_SERVER=$(az acr show --name "$REGISTRY_NAME" --query loginServer -o tsv)
log_info "Container Registry Login Server: $LOGIN_SERVER"

# Login to registry
log_info "Logging into container registry..."
if ! az acr login --name "$REGISTRY_NAME"; then
    log_error "Failed to login to container registry"
    exit 1
fi

log_success "Successfully logged into container registry"

# Build image with better error handling
log_info "Building Docker image: $LOGIN_SERVER/$IMAGE_NAME:$BUILD_NUMBER"
log_info "Using Dockerfile: $DOCKERFILE"

if ! docker build \
    --file "$DOCKERFILE" \
    --tag "$LOGIN_SERVER/$IMAGE_NAME:$BUILD_NUMBER" \
    --tag "$LOGIN_SERVER/$IMAGE_NAME:latest" \
    --build-arg BUILD_NUMBER="$BUILD_NUMBER" \
    --progress=plain \
    "$PROJECT_ROOT"; then
    
    log_error "Docker build failed"
    exit 1
fi

log_success "Docker image built successfully"

# Push images
log_info "Pushing Docker images..."

if ! docker push "$LOGIN_SERVER/$IMAGE_NAME:$BUILD_NUMBER"; then
    log_error "Failed to push versioned image"
    exit 1
fi

if ! docker push "$LOGIN_SERVER/$IMAGE_NAME:latest"; then
    log_error "Failed to push latest image"
    exit 1
fi

log_success "Docker images pushed successfully"

# Verify image in registry
log_info "Verifying image push..."
if az acr repository show-tags --name "$REGISTRY_NAME" --repository "$IMAGE_NAME" --query "[?contains(@, '$BUILD_NUMBER')]" -o tsv | grep -q "$BUILD_NUMBER"; then
    log_success "Image verified in registry: $IMAGE_NAME:$BUILD_NUMBER"
else
    log_warning "Could not verify image in registry, but push appeared successful"
fi

# Output image details
log_info "Build completed successfully!"
echo "📋 Image Details:"
echo "   Registry: $LOGIN_SERVER"
echo "   Image: $IMAGE_NAME"
echo "   Tag: $BUILD_NUMBER"
echo "   Full Image: $LOGIN_SERVER/$IMAGE_NAME:$BUILD_NUMBER"

# Clean up local images to save space
log_info "Cleaning up local Docker images..."
docker rmi "$LOGIN_SERVER/$IMAGE_NAME:$BUILD_NUMBER" "$LOGIN_SERVER/$IMAGE_NAME:latest" 2>/dev/null || true

log_success "Azure Docker build completed successfully! 🎉"
