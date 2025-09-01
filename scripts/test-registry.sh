#!/bin/bash

# Test script for GitLab container registry functionality
# This script tests the registry manager functions without full deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[TEST]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Source the registry functions from rsync.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/rsync.sh"

# Test configuration
TEST_IMAGE="hello-world:latest"
REGISTRY_URL="git.pixelatedempathy.tech"
PROJECT_NAME="pixelated-empathy"
TEST_TAG="test-$(date +%Y%m%d-%H%M%S)"

print_header "🧪 Testing GitLab Container Registry Integration"

# Test 1: Check Docker availability
print_header "1. Testing Docker availability"
if command -v docker >/dev/null 2>&1; then
    print_status "✅ Docker is available"
    docker --version
else
    print_error "❌ Docker is not available"
    exit 1
fi

# Test 2: Pull a test image
print_header "2. Pulling test image"
if docker pull "$TEST_IMAGE" >/dev/null 2>&1; then
    print_status "✅ Test image pulled successfully"
else
    print_error "❌ Failed to pull test image"
    exit 1
fi

# Test 3: Test registry connectivity validation
print_header "3. Testing registry connectivity validation"
if validate_registry_connectivity "$REGISTRY_URL"; then
    print_status "✅ Registry connectivity validation passed"
else
    print_warning "⚠️  Registry connectivity validation failed (may be expected without auth)"
fi

# Test 4: Test image tagging for registry
print_header "4. Testing image tagging for registry"
REGISTRY_TAG="${REGISTRY_URL}/${PROJECT_NAME}:${TEST_TAG}"
if docker tag "$TEST_IMAGE" "$REGISTRY_TAG"; then
    print_status "✅ Image tagged for registry: $REGISTRY_TAG"
else
    print_error "❌ Failed to tag image for registry"
    exit 1
fi

# Test 5: Test registry push (will likely fail without auth, but we can test the function)
print_header "5. Testing registry push function"
print_status "Note: This will likely fail without authentication, but tests the function logic"

# Temporarily redirect stderr to capture the error without stopping the script
if push_to_registry "$TEST_IMAGE" "$REGISTRY_URL" "$PROJECT_NAME" 2>/tmp/registry-test-error.log; then
    print_status "✅ Registry push succeeded (unexpected but good!)"
    
    # Test 6: Test registry image listing
    print_header "6. Testing registry image listing"
    list_registry_images "$REGISTRY_URL" "$PROJECT_NAME"
    
    # Test 7: Test registry pull
    print_header "7. Testing registry pull"
    # Remove local image first
    docker rmi "$REGISTRY_TAG" >/dev/null 2>&1 || true
    
    if pull_from_registry "$REGISTRY_TAG"; then
        print_status "✅ Registry pull succeeded"
    else
        print_error "❌ Registry pull failed"
    fi
    
else
    print_warning "⚠️  Registry push failed (expected without authentication)"
    print_status "Error details:"
    cat /tmp/registry-test-error.log 2>/dev/null || echo "No error log available"
    
    # Test authentication detection
    print_header "6. Testing authentication detection"
    if [[ -n "$GITLAB_TOKEN" ]]; then
        print_status "✅ GITLAB_TOKEN environment variable is set"
    elif [[ -n "$CI_JOB_TOKEN" ]]; then
        print_status "✅ CI_JOB_TOKEN environment variable is set"
    else
        print_warning "⚠️  No authentication tokens found (GITLAB_TOKEN or CI_JOB_TOKEN)"
        print_status "To test registry push, set one of these environment variables:"
        print_status "  export GITLAB_TOKEN='your-gitlab-token'"
        print_status "  export CI_JOB_TOKEN='your-ci-job-token'"
    fi
fi

# Test 8: Test rollback command generation
print_header "8. Testing rollback command generation"
print_status "Generating registry rollback commands..."
generate_registry_rollback_commands "$REGISTRY_URL" "$PROJECT_NAME" "test-app" "4321" "test.example.com"

# Test 9: Test comprehensive rollback command generation
print_header "9. Testing comprehensive rollback command generation"
print_status "Generating comprehensive rollback commands..."
generate_comprehensive_rollback_commands "/root/test-backup" "test-app" "4321" "test.example.com" "$REGISTRY_URL" "$PROJECT_NAME"

# Cleanup
print_header "🧹 Cleaning up test artifacts"
docker rmi "$REGISTRY_TAG" >/dev/null 2>&1 || true
docker rmi "$TEST_IMAGE" >/dev/null 2>&1 || true
rm -f /tmp/registry-test-error.log
rm -f /tmp/registry-images.log

print_header "✅ Registry functionality tests completed"
print_status ""
print_status "Summary:"
print_status "- Docker integration: ✅ Working"
print_status "- Image tagging: ✅ Working"
print_status "- Registry connectivity: ⚠️  Depends on authentication"
print_status "- Command generation: ✅ Working"
print_status ""
print_status "To fully test registry push/pull, set authentication:"
print_status "  export GITLAB_TOKEN='your-gitlab-personal-access-token'"
print_status "Then run: ./scripts/test-registry.sh"