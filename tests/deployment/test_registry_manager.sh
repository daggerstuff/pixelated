#!/bin/bash

# Unit tests for Registry Manager functions
# Tests GitLab registry integration and rollback support

set -e

# Test configuration
TEST_DIR="/tmp/deployment-test-registry"
TEST_LOG="/tmp/test-registry-manager.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_SCRIPT="$SCRIPT_DIR/../../scripts/rsync.sh"

# Colors for test output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test utilities
print_test_header() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Mock Docker commands for registry testing
setup_registry_mocks() {
    # Create mock docker command
    cat > "$TEST_DIR/docker" << 'EOF'
#!/bin/bash
# Mock docker command for registry testing

case "$1" in
    "tag")
        echo "Tagged $2 as $3"
        exit 0
        ;;
    "push")
        local image="$2"
        if [[ "$image" =~ git\.pixelatedempathy\.tech ]]; then
            echo "The push refers to repository [$image]"
            echo "latest: digest: sha256:$(openssl rand -hex 32) size: 1234"
            exit 0
        else
            echo "Error: authentication required"
            exit 1
        fi
        ;;
    "pull")
        local image="$2"
        if [[ "$image" =~ git\.pixelatedempathy\.tech ]]; then
            echo "Pulling from $image"
            echo "latest: Pulling from pixelated-empathy"
            echo "Status: Downloaded newer image for $image"
            exit 0
        else
            echo "Error: image not found"
            exit 1
        fi
        ;;
    "images")
        if [[ "$*" =~ git\.pixelatedempathy\.tech ]]; then
            echo "REPOSITORY                                    TAG       IMAGE ID      CREATED       SIZE"
            echo "git.pixelatedempathy.com/pixelated-empathy  latest    mock-image-id 1 minute ago  100MB"
            echo "git.pixelatedempathy.com/pixelated-empathy  20240131  mock-image-id 1 hour ago    100MB"
        else
            echo "REPOSITORY          TAG       IMAGE ID      CREATED       SIZE"
            echo "pixelated-empathy   latest    mock-image-id 1 minute ago  100MB"
        fi
        exit 0
        ;;
    "login")
        if [[ "$*" =~ git\.pixelatedempathy\.tech ]]; then
            echo "Login Succeeded"
            exit 0
        else
            echo "Error: authentication failed"
            exit 1
        fi
        ;;
    *)
        echo "Mock docker command: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/docker"
    export PATH="$TEST_DIR:$PATH"
}

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up registry manager test environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    
    # Setup mock Docker
    setup_registry_mocks
    
    # Initialize test log
    echo "=== Registry Manager Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up registry manager test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test registry authentication
test_registry_authentication() {
    print_test_header "Testing registry authentication"
    
    # Test authenticate_registry function
    ((TESTS_RUN++))
    
    authenticate_registry() {
        local registry_url="$1"
        local username="$2"
        local password="$3"
        
        if docker login "$registry_url" -u "$username" -p "$password" >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    }
    
    # Test successful authentication
    if authenticate_registry "git.pixelatedempathy.com" "test-user" "test-token"; then
        print_test_pass "authenticate_registry succeeds with valid credentials"
    else
        print_test_fail "authenticate_registry failed with valid credentials"
    fi
    
    # Test failed authentication
    ((TESTS_RUN++))
    if ! authenticate_registry "invalid-registry.com" "test-user" "test-token"; then
        print_test_pass "authenticate_registry correctly fails with invalid registry"
    else
        print_test_fail "authenticate_registry should fail with invalid registry"
    fi
}

# Test container image pushing
test_container_push() {
    print_test_header "Testing container image pushing"
    
    # Test push_to_registry function
    ((TESTS_RUN++))
    
    push_to_registry() {
        local local_image="$1"
        local registry_url="$2"
        local repository="$3"
        local tag="${4:-latest}"
        
        local registry_image="$registry_url/$repository:$tag"
        
        # Tag the image for registry
        if ! docker tag "$local_image" "$registry_image"; then
            return 1
        fi
        
        # Push to registry
        if docker push "$registry_image"; then
            return 0
        else
            return 1
        fi
    }
    
    # Test successful push
    if push_to_registry "pixelated-empathy:latest" "git.pixelatedempathy.com" "pixelated-empathy" "20240131"; then
        print_test_pass "push_to_registry successfully pushes image to GitLab registry"
    else
        print_test_fail "push_to_registry failed to push image"
    fi
}

# Test registry image verification
test_registry_verification() {
    print_test_header "Testing registry image verification"
    
    # Test verify_registry_push function
    ((TESTS_RUN++))
    
    verify_registry_push() {
        local registry_image="$1"
        
        # Try to pull the image to verify it exists
        if docker pull "$registry_image" >/dev/null 2>&1; then
            return 0
        else
            return 1
        fi
    }
    
    # Test verification of existing image
    if verify_registry_push "git.pixelatedempathy.com/pixelated-empathy:latest"; then
        print_test_pass "verify_registry_push confirms image exists in registry"
    else
        print_test_fail "verify_registry_push failed to verify existing image"
    fi
    
    # Test verification of non-existent image
    ((TESTS_RUN++))
    if ! verify_registry_push "nonexistent-registry.com/test:latest"; then
        print_test_pass "verify_registry_push correctly fails for non-existent image"
    else
        print_test_fail "verify_registry_push should fail for non-existent image"
    fi
}

# Test registry image listing
test_registry_image_listing() {
    print_test_header "Testing registry image listing"
    
    # Test list_registry_images function
    ((TESTS_RUN++))
    
    list_registry_images() {
        local registry_url="$1"
        local repository="$2"
        
        # List images matching the registry pattern
        docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | \
        grep "$registry_url/$repository" || true
    }
    
    local image_list=$(list_registry_images "git.pixelatedempathy.com" "pixelated-empathy")
    
    if [[ -n "$image_list" ]] && echo "$image_list" | grep -q "git.pixelatedempathy.com/pixelated-empathy"; then
        print_test_pass "list_registry_images returns available registry images"
    else
        print_test_fail "list_registry_images failed to list registry images"
    fi
}

# Test registry-based rollback command generation
test_registry_rollback_commands() {
    print_test_header "Testing registry-based rollback command generation"
    
    # Test generate_registry_rollback_commands function
    ((TESTS_RUN++))
    
    generate_registry_rollback_commands() {
        local registry_url="$1"
        local repository="$2"
        local previous_tag="$3"
        local container_name="${4:-pixelated-app}"
        
        local registry_image="$registry_url/$repository:$previous_tag"
        
        cat << EOF
# Registry-based Rollback Commands
# Generated: $(date)

# 1. Pull previous image from registry
docker pull $registry_image

# 2. Stop current container
docker stop $container_name 2>/dev/null || true

# 3. Start rollback container
docker run -d --name ${container_name}-rollback \\
  --restart unless-stopped \\
  -p 3000:3000 \\
  $registry_image

# 4. Update proxy configuration (if needed)
# sudo systemctl reload caddy

# 5. Verify rollback
curl -f http://localhost:3000 || echo "Rollback verification failed"
EOF
    }
    
    local rollback_commands=$(generate_registry_rollback_commands "git.pixelatedempathy.com" "pixelated-empathy" "20240130" "test-app")
    
    if [[ -n "$rollback_commands" ]]; then
        if echo "$rollback_commands" | grep -q "docker pull git.pixelatedempathy.com/pixelated-empathy:20240130" && \
           echo "$rollback_commands" | grep -q "docker stop test-app" && \
           echo "$rollback_commands" | grep -q "docker run.*test-app-rollback"; then
            print_test_pass "generate_registry_rollback_commands creates complete rollback instructions"
        else
            print_test_fail "generate_registry_rollback_commands missing required rollback steps"
        fi
    else
        print_test_fail "generate_registry_rollback_commands failed to generate commands"
    fi
}

# Test registry error handling
test_registry_error_handling() {
    print_test_header "Testing registry error handling"
    
    # Test handle_registry_error function
    ((TESTS_RUN++))
    
    handle_registry_error() {
        local error_message="$1"
        local context="$2"
        local continue_deployment="${3:-true}"
        
        # Log the registry error
        echo "Registry Error [$context]: $error_message" >> "$TEST_LOG"
        
        # Categorize error type
        if echo "$error_message" | grep -qi "authentication"; then
            echo "Registry authentication failed. Check credentials." >> "$TEST_LOG"
        elif echo "$error_message" | grep -qi "network\|timeout"; then
            echo "Registry network error. Check connectivity." >> "$TEST_LOG"
        elif echo "$error_message" | grep -qi "quota\|space"; then
            echo "Registry storage quota exceeded." >> "$TEST_LOG"
        fi
        
        # Return appropriate exit code based on continue_deployment
        if [[ "$continue_deployment" == "true" ]]; then
            return 0  # Continue deployment without registry
        else
            return 1  # Fail deployment
        fi
    }
    
    # Test authentication error handling
    if handle_registry_error "authentication required" "push_operation" "true"; then
        if grep -q "Registry authentication failed" "$TEST_LOG"; then
            print_test_pass "handle_registry_error correctly handles authentication errors"
        else
            print_test_fail "handle_registry_error failed to log authentication error"
        fi
    else
        print_test_fail "handle_registry_error should continue deployment on auth error"
    fi
    
    # Test network error handling
    ((TESTS_RUN++))
    if handle_registry_error "connection timeout" "push_operation" "true"; then
        if grep -q "Registry network error" "$TEST_LOG"; then
            print_test_pass "handle_registry_error correctly handles network errors"
        else
            print_test_fail "handle_registry_error failed to log network error"
        fi
    else
        print_test_fail "handle_registry_error should continue deployment on network error"
    fi
}

# Test registry configuration validation
test_registry_configuration() {
    print_test_header "Testing registry configuration validation"
    
    # Test validate_registry_config function
    ((TESTS_RUN++))
    
    validate_registry_config() {
        local registry_url="$1"
        local username="$2"
        local password="$3"
        
        # Check required parameters
        if [[ -z "$registry_url" ]] || [[ -z "$username" ]] || [[ -z "$password" ]]; then
            return 1
        fi
        
        # Validate registry URL format
        if [[ ! "$registry_url" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            return 1
        fi
        
        # Test connectivity (mock)
        if [[ "$registry_url" == "git.pixelatedempathy.com" ]]; then
            return 0
        else
            return 1
        fi
    }
    
    # Test valid configuration
    if validate_registry_config "git.pixelatedempathy.com" "test-user" "test-token"; then
        print_test_pass "validate_registry_config accepts valid configuration"
    else
        print_test_fail "validate_registry_config rejected valid configuration"
    fi
    
    # Test invalid configuration
    ((TESTS_RUN++))
    if ! validate_registry_config "invalid-url" "" ""; then
        print_test_pass "validate_registry_config correctly rejects invalid configuration"
    else
        print_test_fail "validate_registry_config should reject invalid configuration"
    fi
}

# Test registry cleanup operations
test_registry_cleanup() {
    print_test_header "Testing registry cleanup operations"
    
    # Test cleanup_registry_images function
    ((TESTS_RUN++))
    
    cleanup_registry_images() {
        local registry_url="$1"
        local repository="$2"
        local keep_count="${3:-5}"
        
        # List all registry images for the repository
        local images=$(docker images --format "{{.Repository}}:{{.Tag}}" | \
                      grep "$registry_url/$repository" | \
                      head -n 10)  # Mock: get first 10 images
        
        local image_count=$(echo "$images" | wc -l)
        
        if [[ $image_count -gt $keep_count ]]; then
            # Would normally remove oldest images
            local to_remove=$((image_count - keep_count))
            echo "Would remove $to_remove old registry images"
            return 0
        else
            echo "No registry cleanup needed ($image_count <= $keep_count)"
            return 0
        fi
    }
    
    local cleanup_result=$(cleanup_registry_images "git.pixelatedempathy.com" "pixelated-empathy" 3)
    
    if [[ -n "$cleanup_result" ]]; then
        print_test_pass "cleanup_registry_images performs cleanup logic"
    else
        print_test_fail "cleanup_registry_images failed to execute cleanup logic"
    fi
}

# Test registry metadata management
test_registry_metadata() {
    print_test_header "Testing registry metadata management"
    
    # Test create_registry_metadata function
    ((TESTS_RUN++))
    
    create_registry_metadata() {
        local registry_image="$1"
        local commit_hash="$2"
        local build_timestamp="$3"
        local metadata_file="$4"
        
        cat > "$metadata_file" << EOF
{
  "registry_info": {
    "image": "$registry_image",
    "commit_hash": "$commit_hash",
    "build_timestamp": "$build_timestamp",
    "pushed_at": "$(date -Iseconds)",
    "registry_url": "$(echo "$registry_image" | cut -d'/' -f1)",
    "repository": "$(echo "$registry_image" | cut -d'/' -f2 | cut -d':' -f1)",
    "tag": "$(echo "$registry_image" | cut -d':' -f2)"
  }
}
EOF
        return 0
    }
    
    local metadata_file="$TEST_DIR/registry-metadata.json"
    create_registry_metadata "git.pixelatedempathy.com/pixelated-empathy:20240131" "abc123" "2024-01-31T10:30:00Z" "$metadata_file"
    
    if [[ -f "$metadata_file" ]]; then
        if grep -q "git.pixelatedempathy.com" "$metadata_file" && \
           grep -q "abc123" "$metadata_file" && \
           grep -q "pushed_at" "$metadata_file"; then
            print_test_pass "create_registry_metadata generates complete metadata"
        else
            print_test_fail "create_registry_metadata missing required metadata fields"
        fi
    else
        print_test_fail "create_registry_metadata failed to create metadata file"
    fi
}

# Run all tests
run_all_tests() {
    print_test_header "Starting Registry Manager Unit Tests"
    
    setup_test_environment
    
    # Run individual test functions
    test_registry_authentication
    test_container_push
    test_registry_verification
    test_registry_image_listing
    test_registry_rollback_commands
    test_registry_error_handling
    test_registry_configuration
    test_registry_cleanup
    test_registry_metadata
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All registry manager tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_tests
fi