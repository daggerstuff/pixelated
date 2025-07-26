#!/bin/bash

# Docker Push to Azure Container Registry Script
# This script builds and pushes your Docker image to Azure Container Registry

set -e

# Configuration
REGISTRY_NAME="pixelatedcr"
REGISTRY_URL="pixelatedcr.azurecr.io"
IMAGE_NAME="pixelated"
DOCKERFILE="Dockerfile.azure"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command_exists az; then
        print_error "Azure CLI is not installed. Please install Azure CLI first."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Login to Azure
azure_login() {
    print_status "Checking Azure login status..."
    
    if ! az account show >/dev/null 2>&1; then
        print_warning "Not logged in to Azure. Please log in..."
        az login
    else
        print_success "Already logged in to Azure!"
    fi
}

# Login to Azure Container Registry
acr_login() {
    print_status "Logging in to Azure Container Registry..."
    
    if az acr login --name "$REGISTRY_NAME"; then
        print_success "Successfully logged in to ACR!"
    else
        print_error "Failed to log in to ACR. Please check your permissions."
        exit 1
    fi
}

# Build Docker image
build_image() {
    local tag="$1"
    print_status "Building Docker image with tag: $tag"
    
    if docker build -f "$DOCKERFILE" -t "$REGISTRY_URL/$IMAGE_NAME:$tag" .; then
        print_success "Docker image built successfully!"
    else
        print_error "Failed to build Docker image."
        exit 1
    fi
}

# Push Docker image
push_image() {
    local tag="$1"
    print_status "Pushing Docker image with tag: $tag"
    
    if docker push "$REGISTRY_URL/$IMAGE_NAME:$tag"; then
        print_success "Docker image pushed successfully!"
    else
        print_error "Failed to push Docker image."
        exit 1
    fi
}

# Get version from package.json
get_version() {
    if command_exists node && [ -f "package.json" ]; then
        node -p "require('./package.json').version"
    else
        echo "latest"
    fi
}

# Main execution
main() {
    print_status "Starting Docker build and push to Azure Container Registry..."
    
    # Check if we're in the right directory
    if [ ! -f "$DOCKERFILE" ]; then
        print_error "Dockerfile not found: $DOCKERFILE"
        print_error "Please run this script from the project root directory."
        exit 1
    fi
    
    check_prerequisites
    azure_login
    acr_login
    
    # Get version and build timestamp
    VERSION=$(get_version)
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    # Build and push multiple tags
    print_status "Building and pushing multiple tags..."
    
    # Tag with version
    build_image "$VERSION"
    push_image "$VERSION"
    
    # Tag with timestamp
    build_image "$TIMESTAMP"
    push_image "$TIMESTAMP"
    
    # Tag as latest
    docker tag "$REGISTRY_URL/$IMAGE_NAME:$VERSION" "$REGISTRY_URL/$IMAGE_NAME:latest"
    push_image "latest"
    
    print_success "All images pushed successfully!"
    print_status "Available tags:"
    echo "  - $REGISTRY_URL/$IMAGE_NAME:$VERSION"
    echo "  - $REGISTRY_URL/$IMAGE_NAME:$TIMESTAMP"
    echo "  - $REGISTRY_URL/$IMAGE_NAME:latest"
    
    print_status "To pull this image on another machine, run:"
    echo "  docker pull $REGISTRY_URL/$IMAGE_NAME:latest"
    
    print_status "To run this image locally, run:"
    echo "  docker run -p 3000:3000 $REGISTRY_URL/$IMAGE_NAME:latest"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -h, --help     Show this help message"
            echo "  -v, --version  Show version information"
            echo ""
            echo "This script builds and pushes your Docker image to Azure Container Registry."
            echo "Make sure you have Docker and Azure CLI installed and are logged in to Azure."
            exit 0
            ;;
        -v|--version)
            echo "Docker Push to Azure Script v1.0.0"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use -h or --help for usage information."
            exit 1
            ;;
    esac
    shift
done

# Run main function
main
