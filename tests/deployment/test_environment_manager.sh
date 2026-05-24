#!/bin/bash

# Unit tests for Environment Manager functions
# Tests Node.js and pnpm installation and verification functions

set -e

# Test configuration
TEST_DIR="/tmp/deployment-test-env"
TEST_LOG="/tmp/test-environment-manager.log"
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

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up test environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    
    # Initialize test log
    echo "=== Environment Manager Tests - $(date) ===" > "$TEST_LOG"
    
    # Source the deployment script functions (without executing main logic)
    if [[ -f "$DEPLOYMENT_SCRIPT" ]]; then
        # Extract only function definitions for testing
        grep -A 1000 "^[a-zA-Z_][a-zA-Z0-9_]*() {" "$DEPLOYMENT_SCRIPT" | \
        grep -B 1000 "^# Main deployment execution" | \
        head -n -1 > "$TEST_DIR/deployment_functions.sh"
        
        # Source the functions
        source "$TEST_DIR/deployment_functions.sh" 2>/dev/null || true
    else
        print_test_fail "Deployment script not found: $DEPLOYMENT_SCRIPT"
        exit 1
    fi
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test generate_deployment_context function
test_generate_deployment_context() {
    print_test_header "Testing generate_deployment_context function"
    ((TESTS_RUN++))
    
    # Mock git environment
    mkdir -p .git
    echo "ref: refs/heads/main" > .git/HEAD
    
    # Test context generation
    local context=$(generate_deployment_context 2>/dev/null || echo "test-context")
    
    if [[ -n "$context" && "$context" =~ ^[0-9]{8}-[0-9]{6}- ]]; then
        print_test_pass "generate_deployment_context returns valid format: $context"
    else
        print_test_fail "generate_deployment_context returned invalid format: $context"
    fi
    
    # Cleanup
    rm -rf .git
}

# Test container tag generation
test_generate_container_tag() {
    print_test_header "Testing generate_container_tag function"
    ((TESTS_RUN++))
    
    # Test with base name
    local tag=$(generate_container_tag "pixelated-empathy" 2>/dev/null || echo "pixelated-empathy:test")
    
    if [[ "$tag" =~ ^pixelated-empathy:[0-9]{8}-[0-9]{6}- ]]; then
        print_test_pass "generate_container_tag returns valid format: $tag"
    else
        print_test_fail "generate_container_tag returned invalid format: $tag"
    fi
}

# Test error categorization
test_categorize_error() {
    print_test_header "Testing categorize_error function"
    
    # Test environment setup errors
    ((TESTS_RUN++))
    categorize_error "node: command not found" "test"
    local exit_code=$?
    if [[ $exit_code -eq 10 ]]; then  # ERROR_ENVIRONMENT_SETUP
        print_test_pass "categorize_error correctly identifies environment setup error"
    else
        print_test_fail "categorize_error failed to identify environment setup error (exit code: $exit_code)"
    fi
    
    # Test synchronization errors
    ((TESTS_RUN++))
    categorize_error "rsync: connection timeout" "test"
    local exit_code=$?
    if [[ $exit_code -eq 20 ]]; then  # ERROR_SYNCHRONIZATION
        print_test_pass "categorize_error correctly identifies synchronization error"
    else
        print_test_fail "categorize_error failed to identify synchronization error (exit code: $exit_code)"
    fi
    
    # Test build errors
    ((TESTS_RUN++))
    categorize_error "docker build failed" "test"
    local exit_code=$?
    if [[ $exit_code -eq 30 ]]; then  # ERROR_BUILD_FAILURE
        print_test_pass "categorize_error correctly identifies build error"
    else
        print_test_fail "categorize_error failed to identify build error (exit code: $exit_code)"
    fi
    
    # Test network errors
    ((TESTS_RUN++))
    categorize_error "connection refused" "test"
    local exit_code=$?
    if [[ $exit_code -eq 60 ]]; then  # ERROR_NETWORK
        print_test_pass "categorize_error correctly identifies network error"
    else
        print_test_fail "categorize_error failed to identify network error (exit code: $exit_code)"
    fi
}

# Test logging functions
test_logging_functions() {
    print_test_header "Testing logging functions"
    
    # Initialize logging for tests
    DEPLOYMENT_START_TIME=$(date +%s%3N)
    DEPLOYMENT_CONTEXT="test-context"
    DEPLOYMENT_LOG="$TEST_DIR/test-deployment.log"
    DEPLOYMENT_METRICS="$TEST_DIR/test-metrics.json"
    ERROR_LOG="$TEST_DIR/test-errors.log"
    WARNING_LOG="$TEST_DIR/test-warnings.log"
    
    # Test log_deployment_event
    ((TESTS_RUN++))
    log_deployment_event "TEST" "INFO" "Test message" "test_context" 2>/dev/null || true
    
    if [[ -f "$DEPLOYMENT_LOG" ]] && grep -q "Test message" "$DEPLOYMENT_LOG"; then
        print_test_pass "log_deployment_event creates log entry"
    else
        print_test_fail "log_deployment_event failed to create log entry"
    fi
    
    # Test log_error
    ((TESTS_RUN++))
    DEPLOYMENT_ERRORS=()
    log_error "TEST" "Test error message" "test_context" 2>/dev/null || true
    
    if [[ ${#DEPLOYMENT_ERRORS[@]} -gt 0 ]] && [[ "${DEPLOYMENT_ERRORS[0]}" == "TEST:Test error message" ]]; then
        print_test_pass "log_error adds to DEPLOYMENT_ERRORS array"
    else
        print_test_fail "log_error failed to add to DEPLOYMENT_ERRORS array"
    fi
    
    # Test log_warning
    ((TESTS_RUN++))
    DEPLOYMENT_WARNINGS=()
    log_warning "TEST" "Test warning message" "test_context" 2>/dev/null || true
    
    if [[ ${#DEPLOYMENT_WARNINGS[@]} -gt 0 ]] && [[ "${DEPLOYMENT_WARNINGS[0]}" == "TEST:Test warning message" ]]; then
        print_test_pass "log_warning adds to DEPLOYMENT_WARNINGS array"
    else
        print_test_fail "log_warning failed to add to DEPLOYMENT_WARNINGS array"
    fi
}

# Test stage management functions
test_stage_management() {
    print_test_header "Testing stage management functions"
    
    # Initialize stage tracking
    declare -A STAGE_START_TIMES
    declare -A STAGE_END_TIMES
    declare -A STAGE_STATUS
    CURRENT_STAGE=""
    
    # Test start_deployment_stage
    ((TESTS_RUN++))
    start_deployment_stage "test_stage" "Test Stage Description" 2>/dev/null || true
    
    if [[ "$CURRENT_STAGE" == "test_stage" ]] && [[ -n "${STAGE_START_TIMES[test_stage]}" ]]; then
        print_test_pass "start_deployment_stage sets current stage and start time"
    else
        print_test_fail "start_deployment_stage failed to set stage tracking"
    fi
    
    # Test end_deployment_stage
    ((TESTS_RUN++))
    sleep 1  # Ensure some time passes
    end_deployment_stage "test_stage" "success" "Test Stage Description" 2>/dev/null || true
    
    if [[ "${STAGE_STATUS[test_stage]}" == "success" ]] && [[ -n "${STAGE_END_TIMES[test_stage]}" ]]; then
        print_test_pass "end_deployment_stage sets stage status and end time"
    else
        print_test_fail "end_deployment_stage failed to set stage completion"
    fi
}

# Test health check result logging
test_health_check_logging() {
    print_test_header "Testing health check result logging"
    
    # Test log_health_check_results
    ((TESTS_RUN++))
    log_health_check_results "basic_connectivity" "pass" "25" "HTTP 200 OK" "http://localhost:3000" 2>/dev/null || true
    
    local health_log="/tmp/health-check-results.log"
    if [[ -f "$health_log" ]] && grep -q "basic_connectivity: pass" "$health_log"; then
        print_test_pass "log_health_check_results creates health check log entry"
    else
        print_test_fail "log_health_check_results failed to create log entry"
    fi
}

# Test retry logic
test_retry_logic() {
    print_test_header "Testing retry logic functions"
    
    # Create a test command that fails twice then succeeds
    cat > "$TEST_DIR/test_command.sh" << 'EOF'
#!/bin/bash
COUNTER_FILE="/tmp/retry_test_counter"
if [[ ! -f "$COUNTER_FILE" ]]; then
    echo "1" > "$COUNTER_FILE"
    exit 1
elif [[ $(cat "$COUNTER_FILE") -eq 1 ]]; then
    echo "2" > "$COUNTER_FILE"
    exit 1
else
    rm -f "$COUNTER_FILE"
    echo "success"
    exit 0
fi
EOF
    chmod +x "$TEST_DIR/test_command.sh"
    
    # Test retry_with_backoff
    ((TESTS_RUN++))
    rm -f /tmp/retry_test_counter
    
    if retry_with_backoff 3 1 "$TEST_DIR/test_command.sh" >/dev/null 2>&1; then
        print_test_pass "retry_with_backoff succeeds after retries"
    else
        print_test_fail "retry_with_backoff failed to retry successfully"
    fi
    
    # Cleanup
    rm -f /tmp/retry_test_counter "$TEST_DIR/test_command.sh"
}

# Test performance measurement
test_performance_measurement() {
    print_test_header "Testing performance measurement functions"
    
    # Initialize performance tracking
    DEPLOYMENT_METRICS="$TEST_DIR/test-performance-metrics.json"
    echo '{"performance": {}}' > "$DEPLOYMENT_METRICS"
    
    # Test measure_operation_time
    ((TESTS_RUN++))
    if measure_operation_time "test_sleep" "Test sleep operation" sleep 0.1 >/dev/null 2>&1; then
        print_test_pass "measure_operation_time executes and measures operation"
    else
        print_test_fail "measure_operation_time failed to execute operation"
    fi
}

# Run all tests
run_all_tests() {
    print_test_header "Starting Environment Manager Unit Tests"
    
    setup_test_environment
    
    # Run individual test functions
    test_generate_deployment_context
    test_generate_container_tag
    test_categorize_error
    test_logging_functions
    test_stage_management
    test_health_check_logging
    test_retry_logic
    test_performance_measurement
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All tests passed!"
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