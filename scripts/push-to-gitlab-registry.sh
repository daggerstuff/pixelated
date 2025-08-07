#!/bin/bash

# Push Pixelated Empathy containers to GitLab Container Registry
# This script builds and pushes both frontend and AI backend containers

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
GITLAB_REGISTRY="registry.gitlab.com"
GITLAB_PROJECT="pixelatedtech/pixelated"
BUILD_FRONTEND=${1:-"true"}
BUILD_AI=${2:-"false"}  # AI backend is large, build only when requested

# Get current git commit
GIT_COMMIT=$(git rev-parse --short HEAD)
GIT_BRANCH=$(git branch --show-current)

print_header "🚀 GitLab Container Registry Push for Pixelated Empathy"
print_status "Registry: $GITLAB_REGISTRY"
print_status "Project: $GITLAB_PROJECT"
print_status "Commit: $GIT_COMMIT"
print_status "Branch: $GIT_BRANCH"

# Check if logged into GitLab registry
check_gitlab_login() {
    print_header "Checking GitLab Container Registry login..."
    
    if docker info | grep -q "registry.gitlab.com"; then
        print_status "✅ Already logged into GitLab Container Registry"
    else
        print_status "Logging into GitLab Container Registry..."
        if ! docker login $GITLAB_REGISTRY; then
            print_error "Failed to login to GitLab Container Registry"
            print_error "Please run: docker login $GITLAB_REGISTRY"
            exit 1
        fi
        print_status "✅ Logged into GitLab Container Registry"
    fi
}

# Build and push frontend container
build_frontend() {
    print_header "Building and pushing frontend container..."
    
    FRONTEND_IMAGE="$GITLAB_REGISTRY/$GITLAB_PROJECT"
    FRONTEND_LATEST="$FRONTEND_IMAGE:latest"
    FRONTEND_COMMIT="$FRONTEND_IMAGE:$GIT_COMMIT"
    FRONTEND_BRANCH="$FRONTEND_IMAGE:$GIT_BRANCH"
    
    print_status "Building frontend container..."
    print_status "  Latest: $FRONTEND_LATEST"
    print_status "  Commit: $FRONTEND_COMMIT"
    print_status "  Branch: $FRONTEND_BRANCH"
    
    # Build container
    docker build -t pixelated:local .
    
    # Tag for GitLab registry
    docker tag pixelated:local $FRONTEND_LATEST
    docker tag pixelated:local $FRONTEND_COMMIT
    docker tag pixelated:local $FRONTEND_BRANCH
    
    # Push to registry
    print_status "Pushing frontend images to GitLab Container Registry..."
    docker push $FRONTEND_LATEST
    docker push $FRONTEND_COMMIT
    docker push $FRONTEND_BRANCH
    
    print_status "✅ Frontend container pushed successfully"
    print_status "  Pull with: docker pull $FRONTEND_LATEST"
}

# Build and push AI backend container
build_ai_backend() {
    print_header "Building and pushing AI backend container..."
    
    if [[ ! -d "ai" ]]; then
        print_warning "AI directory not found, skipping AI backend build"
        return
    fi
    
    AI_IMAGE="$GITLAB_REGISTRY/$GITLAB_PROJECT/ai"
    AI_LATEST="$AI_IMAGE:latest"
    AI_COMMIT="$AI_IMAGE:$GIT_COMMIT"
    AI_BRANCH="$AI_IMAGE:$GIT_BRANCH"
    
    print_status "Building AI backend container..."
    print_status "  Latest: $AI_LATEST"
    print_status "  Commit: $AI_COMMIT"
    print_status "  Branch: $AI_BRANCH"
    
    # Build AI container
    cd ai
    docker build -t pixelated-ai:local .
    cd ..
    
    # Tag for GitLab registry
    docker tag pixelated-ai:local $AI_LATEST
    docker tag pixelated-ai:local $AI_COMMIT
    docker tag pixelated-ai:local $AI_BRANCH
    
    # Push to registry
    print_status "Pushing AI backend images to GitLab Container Registry..."
    docker push $AI_LATEST
    docker push $AI_COMMIT
    docker push $AI_BRANCH
    
    print_status "✅ AI backend container pushed successfully"
    print_status "  Pull with: docker pull $AI_LATEST"
}

# Test container functionality
test_containers() {
    print_header "Testing container functionality..."
    
    # Test frontend container
    if [[ "$BUILD_FRONTEND" == "true" ]]; then
        print_status "Testing frontend container..."
        FRONTEND_IMAGE="$GITLAB_REGISTRY/$GITLAB_PROJECT:latest"
        
        # Run container in background
        docker run -d --name test-frontend -p 4322:4321 $FRONTEND_IMAGE
        sleep 10
        
        # Test health
        if curl -f http://localhost:4322 > /dev/null 2>&1; then
            print_status "✅ Frontend container test passed"
        else
            print_warning "⚠️  Frontend container test failed"
            docker logs test-frontend
        fi
        
        # Cleanup
        docker stop test-frontend
        docker rm test-frontend
    fi
}

# Generate deployment commands
generate_deployment_commands() {
    print_header "Deployment Commands"
    
    echo ""
    print_status "🐳 Container Images Built:"
    if [[ "$BUILD_FRONTEND" == "true" ]]; then
        echo "  Frontend: $GITLAB_REGISTRY/$GITLAB_PROJECT:latest"
    fi
    if [[ "$BUILD_AI" == "true" ]]; then
        echo "  AI Backend: $GITLAB_REGISTRY/$GITLAB_PROJECT/ai:latest"
    fi
    
    echo ""
    print_status "🚀 Oracle Cloud Deployment:"
    echo "  USE_GITLAB_REGISTRY=true ./scripts/oracle-deploy.sh yourdomain.com"
    
    echo ""
    print_status "🔄 Manual Container Update on Oracle Cloud:"
    echo "  ssh ubuntu@your-oracle-ip"
    echo "  docker pull $GITLAB_REGISTRY/$GITLAB_PROJECT:latest"
    echo "  docker stop pixelated-app && docker rm pixelated-app"
    echo "  docker run -d --name pixelated-app --restart unless-stopped -p 4321:4321 $GITLAB_REGISTRY/$GITLAB_PROJECT:latest"
    
    echo ""
    print_status "📋 GitLab CI/CD:"
    echo "  Push to master/main branch to trigger automatic builds"
    echo "  Manual deployment available in GitLab CI/CD pipelines"
}

# Main execution
main() {
    check_gitlab_login
    
    if [[ "$BUILD_FRONTEND" == "true" ]]; then
        build_frontend
    fi
    
    if [[ "$BUILD_AI" == "true" ]]; then
        build_ai_backend
    fi
    
    test_containers
    generate_deployment_commands
    
    print_status "🎉 GitLab Container Registry push completed!"
}

# Parse command line arguments
case "${1:-help}" in
    "frontend")
        BUILD_FRONTEND="true"
        BUILD_AI="false"
        ;;
    "ai")
        BUILD_FRONTEND="false"
        BUILD_AI="true"
        ;;
    "all")
        BUILD_FRONTEND="true"
        BUILD_AI="true"
        ;;
    "help"|*)
        echo "Usage: $0 [frontend|ai|all]"
        echo ""
        echo "Examples:"
        echo "  $0 frontend    # Build and push frontend only"
        echo "  $0 ai          # Build and push AI backend only"
        echo "  $0 all         # Build and push both frontend and AI backend"
        echo "  $0             # Build and push frontend only (default)"
        exit 0
        ;;
esac

main
