#!/bin/bash

# Docker Pull from Azure Container Registry Script
# This script pulls your Docker image from Azure Container Registry

set -e

# Configuration
REGISTRY_NAME="pixelatedcr"
REGISTRY_URL="pixelatedcr.azurecr.io"
IMAGE_NAME="pixelated-app"

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

# List available tags
list_tags() {
    print_status "Available tags in Azure Container Registry:"
    az acr repository show-tags --name "$REGISTRY_NAME" --repository "$IMAGE_NAME" --output table
}

# Pull Docker image
pull_image() {
    local tag="$1"
    print_status "Pulling Docker image with tag: $tag"
    
    if docker pull "$REGISTRY_URL/$IMAGE_NAME:$tag"; then
        print_success "Docker image pulled successfully!"
    else
        print_error "Failed to pull Docker image."
        exit 1
    fi
}

# Run the pulled image
run_image() {
    local tag="$1"
    local port="${2:-3000}"
    local name="${3:-pixelated-app-local}"
    
    print_status "Running Docker image on port $port..."
    
    # Stop and remove existing container if it exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "^$name$"; then
        print_warning "Stopping and removing existing container: $name"
        docker stop "$name" >/dev/null 2>&1 || true
        docker rm "$name" >/dev/null 2>&1 || true
    fi
    
    if docker run -d --name "$name" -p "$port:3000" "$REGISTRY_URL/$IMAGE_NAME:$tag"; then
        print_success "Docker container started successfully!"
        print_status "Container name: $name"
        print_status "Access the application at: http://localhost:$port"
        print_status "View logs with: docker logs $name"
        print_status "Stop with: docker stop $name"
    else
        print_error "Failed to run Docker container."
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [options] [tag]"
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -l, --list          List available tags"
    echo "  -r, --run           Pull and run the image"
    echo "  -p, --port <port>   Port to run on (default: 3000)"
    echo "  -n, --name <name>   Container name (default: pixelated-app-local)"
    echo ""
    echo "Examples:"
    echo "  $0                          # Pull latest tag"
    echo "  $0 v1.0.0                   # Pull specific version"
    echo "  $0 --list                   # List available tags"
    echo "  $0 --run                    # Pull and run latest"
    echo "  $0 --run v1.0.0 --port 3000 # Pull and run specific version on port 3000"
}

# Main execution
main() {
    local tag="latest"
    local run_after_pull=false
    local port="3000"
    local container_name="pixelated-app-local"
    local list_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -l|--list)
                list_only=true
                shift
                ;;
            -r|--run)
                run_after_pull=true
                shift
                ;;
            -p|--port)
                port="$2"
                shift 2
                ;;
            -n|--name)
                container_name="$2"
                shift 2
                ;;
            -*)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                tag="$1"
                shift
                ;;
        esac
    done
    
    check_prerequisites
    azure_login
    acr_login
    
    if [ "$list_only" = true ]; then
        list_tags
        exit 0
    fi
    
    print_status "Pulling Docker image from Azure Container Registry..."
    print_status "Registry: $REGISTRY_URL"
    print_status "Image: $IMAGE_NAME"
    print_status "Tag: $tag"
    
    pull_image "$tag"
    
    if [ "$run_after_pull" = true ]; then
        run_image "$tag" "$port" "$container_name"
    else
        print_success "Image pulled successfully!"
        print_status "To run the image, use:"
        echo "  docker run -p $port:3000 $REGISTRY_URL/$IMAGE_NAME:$tag"
        print_status "Or use this script with --run flag:"
        echo "  $0 --run $tag"
    fi
}

# Run main function
main "$@"
