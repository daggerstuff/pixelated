#!/bin/bash

# Enhanced Azure Deployment Script for Pixelated Empathy
# This script handles Azure App Service deployment with Docker containers

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASTRO_CONFIG="astro.config.azure.mjs"
BUILD_DIR="dist"

# Azure configuration
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"
AZURE_APP_SERVICE_NAME="${AZURE_APP_SERVICE_NAME:-}"
AZURE_CONTAINER_REGISTRY="${AZURE_CONTAINER_REGISTRY:-}"

# Environment detection
ENVIRONMENT="${AZURE_ENVIRONMENT:-production}"

log_info "Starting enhanced Azure deployment process..."
log_info "Environment: $ENVIRONMENT"
log_info "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Validate environment
log_info "Validating deployment environment..."

if [ ! -f "$ASTRO_CONFIG" ]; then
    log_error "Azure Astro config not found: $ASTRO_CONFIG"
    exit 1
fi

if [ ! -f "Dockerfile.azure" ]; then
    log_error "Dockerfile.azure not found"
    exit 1
fi

# Validate Azure configuration
if [ -z "$AZURE_RESOURCE_GROUP" ]; then
    log_error "AZURE_RESOURCE_GROUP environment variable not set"
    exit 1
fi

if [ -z "$AZURE_APP_SERVICE_NAME" ]; then
    log_error "AZURE_APP_SERVICE_NAME environment variable not set"
    exit 1
fi

log_success "Environment validation passed"

# Check required tools
log_info "Checking required tools..."

if ! command -v az >/dev/null 2>&1; then
    log_error "Azure CLI not found. Please install Azure CLI."
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker not found. Please install Docker."
    exit 1
fi

# Set environment variables for Azure build
export NODE_ENV=production
export ASTRO_CONFIG_FILE="$ASTRO_CONFIG"
export AZURE_DEPLOYMENT=true
export AZURE_DEPLOYMENT_TYPE="server"

log_info "Environment variables configured for Azure deployment"

# Install dependencies
log_info "Installing dependencies..."
if pnpm install --no-frozen-lockfile; then
    log_success "Dependencies installed successfully"
else
    log_error "Failed to install dependencies"
    exit 1
fi

# Build the application
log_info "Building application with Azure configuration..."
BUILD_START_TIME=$(date +%s)

if ASTRO_CONFIG_FILE="$ASTRO_CONFIG" pnpm build; then
    BUILD_END_TIME=$(date +%s)
    BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))
    log_success "Build completed successfully in ${BUILD_DURATION}s"
else
    log_error "Build failed"
    exit 1
fi

# Verify build output for Azure
log_info "Verifying build output for Azure deployment..."
if [ ! -d "$BUILD_DIR/server" ] || [ ! -f "$BUILD_DIR/server/entry.mjs" ]; then
    log_error "Server files not found. Azure deployment requires server-side rendering."
    exit 1
fi

log_success "Server files verified for Azure deployment"

# Docker build and deployment
if [ -n "$AZURE_CONTAINER_REGISTRY" ]; then
    log_info "Building Docker image for Azure Container Registry..."
    
    # Generate unique tag
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BUILD_ID="${BUILD_ID:-$TIMESTAMP}"
    IMAGE_TAG="$AZURE_CONTAINER_REGISTRY.azurecr.io/pixelated-app:$BUILD_ID"
    
    # Build Docker image
    if docker build -f Dockerfile.azure -t "$IMAGE_TAG" \
        --build-arg NODE_ENV=production \
        --build-arg BUILD_BUILDNUMBER="$BUILD_ID" \
        --build-arg BUILD_SOURCEVERSION="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
        .; then
        log_success "Docker image built successfully: $IMAGE_TAG"
    else
        log_error "Docker build failed"
        exit 1
    fi
    
    # Login to Azure Container Registry
    log_info "Logging into Azure Container Registry..."
    if az acr login --name "$AZURE_CONTAINER_REGISTRY"; then
        log_success "Successfully logged into ACR"
    else
        log_error "Failed to login to Azure Container Registry"
        exit 1
    fi
    
    # Push to Azure Container Registry
    log_info "Pushing image to Azure Container Registry..."
    if docker push "$IMAGE_TAG"; then
        log_success "Image pushed successfully"
    else
        log_error "Failed to push image to registry"
        exit 1
    fi
    
    # Deploy to Azure App Service
    log_info "Deploying to Azure App Service..."
    if az webapp config container set \
        --name "$AZURE_APP_SERVICE_NAME" \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --docker-custom-image-name "$IMAGE_TAG" \
        --docker-registry-server-url "https://$AZURE_CONTAINER_REGISTRY.azurecr.io"; then
        log_success "Azure App Service deployment initiated"
    else
        log_error "Azure App Service deployment failed"
        exit 1
    fi
    
    # Configure App Service settings
    log_info "Configuring App Service settings..."
    az webapp config appsettings set \
        --name "$AZURE_APP_SERVICE_NAME" \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --settings \
            NODE_ENV=production \
            WEBSITES_PORT=3000 \
            WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
            SCM_DO_BUILD_DURING_DEPLOYMENT=false \
            ENVIRONMENT="$ENVIRONMENT" \
        >/dev/null
    
    log_success "App Service settings configured"
    
else
    log_warning "AZURE_CONTAINER_REGISTRY not set, skipping Docker deployment"
    log_info "Build artifacts are ready for manual deployment"
fi

# Post-deployment checks
log_info "Running post-deployment checks..."

if [ -n "$AZURE_APP_SERVICE_NAME" ] && [ -n "$AZURE_RESOURCE_GROUP" ]; then
    # Get App Service URL
    APP_URL=$(az webapp show --name "$AZURE_APP_SERVICE_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --query "defaultHostName" --output tsv 2>/dev/null || echo "")
    
    if [ -n "$APP_URL" ]; then
        log_info "App Service URL: https://$APP_URL"
        
        # Wait for deployment to be ready
        log_info "Waiting for deployment to be ready (60 seconds)..."
        sleep 60
        
        # Health check with retries
        log_info "Performing health check..."
        HEALTH_CHECK_RETRIES=3
        HEALTH_CHECK_SUCCESS=false
        
        for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
            if curl -f -s --max-time 30 "https://$APP_URL/api/health/simple" >/dev/null 2>&1; then
                log_success "Health check passed on attempt $i"
                HEALTH_CHECK_SUCCESS=true
                break
            else
                log_warning "Health check failed on attempt $i/$HEALTH_CHECK_RETRIES"
                if [ $i -lt $HEALTH_CHECK_RETRIES ]; then
                    sleep 15
                fi
            fi
        done
        
        if [ "$HEALTH_CHECK_SUCCESS" = false ]; then
            log_warning "Health check failed after $HEALTH_CHECK_RETRIES attempts"
            log_info "This may be normal for new deployments. Check the App Service logs."
        fi
    fi
fi

# Cleanup
log_info "Cleaning up local Docker images..."
if [ -n "${IMAGE_TAG:-}" ]; then
    docker rmi "$IMAGE_TAG" >/dev/null 2>&1 || true
fi

log_success "Enhanced Azure deployment process completed!"

# Summary
echo ""
echo "📊 Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Build duration: ${BUILD_DURATION:-unknown}s"
echo "  Configuration: $ASTRO_CONFIG"
echo "  Resource Group: $AZURE_RESOURCE_GROUP"
echo "  App Service: $AZURE_APP_SERVICE_NAME"
if [ -n "${IMAGE_TAG:-}" ]; then
    echo "  Docker Image: $IMAGE_TAG"
fi
if [ -n "${APP_URL:-}" ]; then
    echo "  App URL: https://$APP_URL"
fi
echo ""

log_info "Deployment completed successfully! 🎉"
