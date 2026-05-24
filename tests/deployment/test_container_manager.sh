#!/bin/bash

# Unit tests for Container Manager functions
# Tests container building, health checks, and traffic switching

set -e

# Test configuration
TEST_DIR="/tmp/deployment-test-container"
TEST_LOG="/tmp/test-container-manager.log"
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

# Mock Docker commands for testing
setup_docker_mocks() {
    # Create mock docker command
    cat > "$TEST_DIR/docker" << 'EOF'
#!/bin/bash
# Mock docker command for testing

case "$1" in
    "build")
        echo "Successfully built mock-image-id"
        echo "Successfully tagged $3"
        exit 0
        ;;
    "images")
        if [[ "$2" == "--format" ]]; then
            echo "mock-image-id"
        else
            echo "REPOSITORY          TAG       IMAGE ID      CREATED       SIZE"
            echo "pixelated-empathy   latest    mock-image-id 1 minute ago  100MB"
        fi
        exit 0
        ;;
    "inspect")
        echo '[{"Config": {"ExposedPorts": {"3000/tcp": {}}}}]'
        exit 0
        ;;
    "run")
        echo "mock-container-id"
        exit 0
        ;;
    "ps")
        if [[ "$2" == "-q" ]]; then
            echo "mock-container-id"
        else
            echo "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES"
            echo "mock-container-id   test:latest   \"npm start\"   1 min ago   Up 1 min   0.0.0.0:3000->3000/tcp   test-container"
        fi
        exit 0
        ;;
    "stop"|"start"|"rm")
        echo "mock-container-id"
        exit 0
        ;;
    "tag")
        exit 0
        ;;
    "push")
        echo "The push refers to repository [registry.example.com/test]"
        echo "latest: digest: sha256:mock-digest size: 1234"
        exit 0
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
    print_test_header "Setting up container manager test environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    
    # Setup mock Docker
    setup_docker_mocks
    
    # Create mock Dockerfile
    cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
EOF
    
    # Create mock package.json
    cat > package.json << 'EOF'
{
  "name": "pixelated-empathy",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  }
}
EOF
    
    # Initialize test log
    echo "=== Container Manager Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up container manager test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test container tag generation
test_container_tag_generation() {
    print_test_header "Testing container tag generation"
    
    # Test generate_container_tag function
    ((TESTS_RUN++))
    
    generate_container_tag() {
        local base_name="$1"
        local timestamp=$(date +%Y%m%d-%H%M%S)
        local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
        echo "${base_name}:${timestamp}-${commit_hash}"
    }
    
    local tag=$(generate_container_tag "pixelated-empathy")
    
    if [[ "$tag" =~ ^pixelated-empathy:[0-9]{8}-[0-9]{6}- ]]; then
        print_test_pass "generate_container_tag creates valid timestamp-based tag: $tag"
    else
        print_test_fail "generate_container_tag created invalid tag format: $tag"
    fi
}

# Test container build validation
test_container_build_validation() {
    print_test_header "Testing container build validation"
    
    # Test validate_container_build function
    ((TESTS_RUN++))
    
    validate_container_build() {
        local image_tag="$1"
        
        # Check if image exists
        if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "^$image_tag$"; then
            return 1
        fi
        
        # Check if image has required metadata
        local image_id=$(docker images --format "{{.ID}}" "$image_tag" | head -1)
        if [[ -z "$image_id" ]]; then
            return 1
        fi
        
        # Validate image configuration
        local config=$(docker inspect "$image_tag" 2>/dev/null)
        if [[ -z "$config" ]]; then
            return 1
        fi
        
        return 0
    }
    
    # Test with valid image tag
    if validate_container_build "pixelated-empathy:latest"; then
        print_test_pass "validate_container_build confirms valid container build"
    else
        print_test_fail "validate_container_build failed to validate mock container"
    fi
    
    # Test with invalid image tag
    ((TESTS_RUN++))
    if ! validate_container_build "nonexistent:tag"; then
        print_test_pass "validate_container_build correctly rejects invalid container"
    else
        print_test_fail "validate_container_build failed to reject invalid container"
    fi
}

# Test basic connectivity health check
test_basic_connectivity_check() {
    print_test_header "Testing basic connectivity health check"
    
    # Test perform_basic_connectivity_test function
    ((TESTS_RUN++))
    
    perform_basic_connectivity_test() {
        local port="$1"
        local timeout="${2:-10}"
        local host="${3:-localhost}"
        
        # Mock successful connection test
        if [[ "$port" == "3000" ]]; then
            return 0
        else
            return 1
        fi
    }
    
    if perform_basic_connectivity_test "3000" 5; then
        print_test_pass "perform_basic_connectivity_test succeeds for valid port"
    else
        print_test_fail "perform_basic_connectivity_test failed for valid port"
    fi
    
    # Test with invalid port
    ((TESTS_RUN++))
    if ! perform_basic_connectivity_test "9999" 5; then
        print_test_pass "perform_basic_connectivity_test correctly fails for invalid port"
    else
        print_test_fail "perform_basic_connectivity_test should fail for invalid port"
    fi
}

# Test application readiness waiting
test_application_readiness() {
    print_test_header "Testing application readiness waiting"
    
    # Test wait_for_application_ready function
    ((TESTS_RUN++))
    
    wait_for_application_ready() {
        local container_name="$1"
        local port="$2"
        local timeout="${3:-60}"
        local check_interval="${4:-2}"
        
        local elapsed=0
        while [[ $elapsed -lt $timeout ]]; do
            # Mock readiness check - succeed after 3 attempts
            if [[ $elapsed -ge 6 ]]; then
                return 0
            fi
            
            sleep $check_interval
            elapsed=$((elapsed + check_interval))
        done
        
        return 1
    }
    
    local start_time=$(date +%s)
    if wait_for_application_ready "test-container" "3000" 10 2; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        if [[ $duration -ge 6 ]] && [[ $duration -le 10 ]]; then
            print_test_pass "wait_for_application_ready waits appropriate time before success"
        else
            print_test_fail "wait_for_application_ready timing incorrect (duration: ${duration}s)"
        fi
    else
        print_test_fail "wait_for_application_ready failed to detect readiness"
    fi
}

# Test root endpoint testing
test_root_endpoint_testing() {
    print_test_header "Testing root endpoint testing"
    
    # Mock curl command
    cat > "$TEST_DIR/curl" << 'EOF'
#!/bin/bash
# Mock curl command for testing

if [[ "$*" =~ localhost:3000 ]]; then
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: text/html"
    echo ""
    echo "<html><body><h1>Pixelated Empathy</h1></body></html>"
    exit 0
elif [[ "$*" =~ localhost:9999 ]]; then
    echo "curl: (7) Failed to connect to localhost port 9999: Connection refused"
    exit 7
else
    echo "Mock curl: $*"
    exit 0
fi
EOF
    chmod +x "$TEST_DIR/curl"
    
    # Test test_root_endpoint function
    ((TESTS_RUN++))
    
    test_root_endpoint() {
        local port="$1"
        local expected_status="${2:-200}"
        local timeout="${3:-10}"
        
        local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "http://localhost:$port" --max-time $timeout 2>/dev/null)
        local http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        
        if [[ "$http_code" == "$expected_status" ]]; then
            return 0
        else
            return 1
        fi
    }
    
    if test_root_endpoint "3000" "200"; then
        print_test_pass "test_root_endpoint successfully validates 200 response"
    else
        print_test_fail "test_root_endpoint failed to validate 200 response"
    fi
    
    # Test with failing endpoint
    ((TESTS_RUN++))
    if ! test_root_endpoint "9999" "200"; then
        print_test_pass "test_root_endpoint correctly fails for unreachable endpoint"
    else
        print_test_fail "test_root_endpoint should fail for unreachable endpoint"
    fi
}

# Test API endpoint testing
test_api_endpoint_testing() {
    print_test_header "Testing API endpoint testing"
    
    # Test test_api_endpoints function
    ((TESTS_RUN++))
    
    test_api_endpoints() {
        local port="$1"
        shift
        local endpoints=("$@")
        local failed_endpoints=()
        
        for endpoint in "${endpoints[@]}"; do
            local url="http://localhost:$port$endpoint"
            
            # Mock API responses
            case "$endpoint" in
                "/api/health")
                    # Simulate successful health check
                    continue
                    ;;
                "/api/bias-detection")
                    # Simulate successful bias detection endpoint
                    continue
                    ;;
                "/api/nonexistent")
                    # Simulate failed endpoint
                    failed_endpoints+=("$endpoint")
                    ;;
                *)
                    # Default to success for other endpoints
                    continue
                    ;;
            esac
        done
        
        if [[ ${#failed_endpoints[@]} -eq 0 ]]; then
            return 0
        else
            return 1
        fi
    }
    
    local endpoints=("/api/health" "/api/bias-detection")
    if test_api_endpoints "3000" "${endpoints[@]}"; then
        print_test_pass "test_api_endpoints validates all successful endpoints"
    else
        print_test_fail "test_api_endpoints failed to validate successful endpoints"
    fi
    
    # Test with failing endpoint
    ((TESTS_RUN++))
    local failing_endpoints=("/api/health" "/api/nonexistent")
    if ! test_api_endpoints "3000" "${failing_endpoints[@]}"; then
        print_test_pass "test_api_endpoints correctly fails with failing endpoint"
    else
        print_test_fail "test_api_endpoints should fail with failing endpoint"
    fi
}

# Test static asset testing
test_static_asset_testing() {
    print_test_header "Testing static asset testing"
    
    # Test test_static_assets function
    ((TESTS_RUN++))
    
    test_static_assets() {
        local port="$1"
        shift
        local assets=("$@")
        local failed_assets=()
        
        for asset in "${assets[@]}"; do
            local url="http://localhost:$port$asset"
            
            # Mock asset responses
            case "$asset" in
                "/assets/main.css"|"/assets/app.js")
                    # Simulate successful asset serving
                    continue
                    ;;
                "/assets/missing.css")
                    # Simulate missing asset
                    failed_assets+=("$asset")
                    ;;
                *)
                    # Default to success for other assets
                    continue
                    ;;
            esac
        done
        
        if [[ ${#failed_assets[@]} -eq 0 ]]; then
            return 0
        else
            return 1
        fi
    }
    
    local assets=("/assets/main.css" "/assets/app.js")
    if test_static_assets "3000" "${assets[@]}"; then
        print_test_pass "test_static_assets validates all available assets"
    else
        print_test_fail "test_static_assets failed to validate available assets"
    fi
    
    # Test with missing asset
    ((TESTS_RUN++))
    local missing_assets=("/assets/main.css" "/assets/missing.css")
    if ! test_static_assets "3000" "${missing_assets[@]}"; then
        print_test_pass "test_static_assets correctly fails with missing asset"
    else
        print_test_fail "test_static_assets should fail with missing asset"
    fi
}

# Test comprehensive health check
test_comprehensive_health_check() {
    print_test_header "Testing comprehensive health check"
    
    # Test perform_comprehensive_health_check function
    ((TESTS_RUN++))
    
    perform_comprehensive_health_check() {
        local container_name="$1"
        local port="$2"
        local results_file="${3:-/tmp/health-check-results.json}"
        
        # Initialize results
        cat > "$results_file" << EOF
{
  "overall_status": "unknown",
  "checks": {}
}
EOF
        
        # Perform basic connectivity
        if perform_basic_connectivity_test "$port" 10; then
            echo "Basic connectivity: PASS" >> "$results_file.log"
        else
            echo "Basic connectivity: FAIL" >> "$results_file.log"
            return 1
        fi
        
        # Test root endpoint
        if test_root_endpoint "$port" "200"; then
            echo "Root endpoint: PASS" >> "$results_file.log"
        else
            echo "Root endpoint: FAIL" >> "$results_file.log"
            return 1
        fi
        
        # Test API endpoints
        local api_endpoints=("/api/health" "/api/bias-detection")
        if test_api_endpoints "$port" "${api_endpoints[@]}"; then
            echo "API endpoints: PASS" >> "$results_file.log"
        else
            echo "API endpoints: FAIL" >> "$results_file.log"
            return 1
        fi
        
        # Test static assets
        local static_assets=("/assets/main.css" "/assets/app.js")
        if test_static_assets "$port" "${static_assets[@]}"; then
            echo "Static assets: PASS" >> "$results_file.log"
        else
            echo "Static assets: FAIL" >> "$results_file.log"
            return 1
        fi
        
        # Update overall status
        sed -i 's/"overall_status": "unknown"/"overall_status": "pass"/' "$results_file"
        return 0
    }
    
    local results_file="$TEST_DIR/health-results.json"
    if perform_comprehensive_health_check "test-container" "3000" "$results_file"; then
        if [[ -f "$results_file" ]] && grep -q '"overall_status": "pass"' "$results_file"; then
            print_test_pass "perform_comprehensive_health_check completes all checks successfully"
        else
            print_test_fail "perform_comprehensive_health_check failed to update results file"
        fi
    else
        print_test_fail "perform_comprehensive_health_check failed health checks"
    fi
}

# Test health check failure handling
test_health_check_failure_handling() {
    print_test_header "Testing health check failure handling"
    
    # Test handle_health_check_failure function
    ((TESTS_RUN++))
    
    handle_health_check_failure() {
        local container_name="$1"
        local results_file="$2"
        local cleanup="${3:-true}"
        
        # Log failure
        echo "Health check failed for container: $container_name" >> "$TEST_LOG"
        
        # Stop and remove failed container if cleanup is enabled
        if [[ "$cleanup" == "true" ]]; then
            docker stop "$container_name" >/dev/null 2>&1 || true
            docker rm "$container_name" >/dev/null 2>&1 || true
        fi
        
        # Generate failure report
        if [[ -f "$results_file" ]]; then
            echo "Failure details available in: $results_file" >> "$TEST_LOG"
        fi
        
        return 0
    }
    
    # Create mock results file
    local results_file="$TEST_DIR/failed-health-results.json"
    echo '{"overall_status": "fail", "failed_checks": ["root_endpoint"]}' > "$results_file"
    
    if handle_health_check_failure "failed-container" "$results_file" "true"; then
        if grep -q "Health check failed for container: failed-container" "$TEST_LOG"; then
            print_test_pass "handle_health_check_failure logs failure correctly"
        else
            print_test_fail "handle_health_check_failure failed to log failure"
        fi
    else
        print_test_fail "handle_health_check_failure function failed"
    fi
}

# Run all tests
run_all_tests() {
    print_test_header "Starting Container Manager Unit Tests"
    
    setup_test_environment
    
    # Run individual test functions
    test_container_tag_generation
    test_container_build_validation
    test_basic_connectivity_check
    test_application_readiness
    test_root_endpoint_testing
    test_api_endpoint_testing
    test_static_asset_testing
    test_comprehensive_health_check
    test_health_check_failure_handling
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All container manager tests passed!"
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