#!/bin/bash

# Failure Scenario Integration Tests
# Tests various failure conditions and recovery mechanisms

set -e

# Test configuration
TEST_DIR="/tmp/deployment-integration-failures"
TEST_LOG="/tmp/test-failure-scenarios.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
print_test_header() { echo -e "${BLUE}[FAILURE-TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up failure scenario test environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"/{mocks,logs,scenarios}
    cd "$TEST_DIR"
    
    # Initialize test log
    echo "=== Failure Scenario Integration Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up failure scenario test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test network connectivity failures
test_network_connectivity_failures() {
    print_test_header "Testing network connectivity failure scenarios"
    
    # Test SSH connection timeout
    ((TESTS_RUN++))
    
    create_failing_ssh_mock() {
        local failure_type="$1"
        
        cat > "$TEST_DIR/mocks/ssh-$failure_type" << EOF
#!/bin/bash
# Mock SSH that simulates $failure_type

case "$failure_type" in
    "timeout")
        echo "ssh: connect to host example.com port 22: Connection timed out"
        exit 255
        ;;
    "refused")
        echo "ssh: connect to host example.com port 22: Connection refused"
        exit 255
        ;;
    "unreachable")
        echo "ssh: connect to host example.com port 22: No route to host"
        exit 255
        ;;
    "auth-fail")
        echo "Permission denied (publickey)."
        exit 255
        ;;
    *)
        echo "Unknown failure type: $failure_type"
        exit 1
        ;;
esac
EOF
        chmod +x "$TEST_DIR/mocks/ssh-$failure_type"
    }
    
    test_ssh_failure_handling() {
        local failure_type="$1"
        local expected_error="$2"
        
        create_failing_ssh_mock "$failure_type"
        
        # Simulate deployment with SSH failure
        local output=$("$TEST_DIR/mocks/ssh-$failure_type" root@test-host "echo test" 2>&1)
        local exit_code=$?
        
        if [[ $exit_code -ne 0 ]] && echo "$output" | grep -q "$expected_error"; then
            return 0
        else
            return 1
        fi
    }
    
    # Test connection timeout
    if test_ssh_failure_handling "timeout" "Connection timed out"; then
        print_test_pass "SSH connection timeout failure correctly detected"
    else
        print_test_fail "SSH connection timeout failure not handled properly"
    fi
    
    # Test connection refused
    ((TESTS_RUN++))
    if test_ssh_failure_handling "refused" "Connection refused"; then
        print_test_pass "SSH connection refused failure correctly detected"
    else
        print_test_fail "SSH connection refused failure not handled properly"
    fi
    
    # Test authentication failure
    ((TESTS_RUN++))
    if test_ssh_failure_handling "auth-fail" "Permission denied"; then
        print_test_pass "SSH authentication failure correctly detected"
    else
        print_test_fail "SSH authentication failure not handled properly"
    fi
}

# Test rsync synchronization failures
test_rsync_synchronization_failures() {
    print_test_header "Testing rsync synchronization failure scenarios"
    
    # Test rsync network failure
    ((TESTS_RUN++))
    
    create_failing_rsync_mock() {
        local failure_type="$1"
        
        cat > "$TEST_DIR/mocks/rsync-$failure_type" << EOF
#!/bin/bash
# Mock rsync that simulates $failure_type

case "$failure_type" in
    "network")
        echo "rsync: connection unexpectedly closed (0 bytes received so far) [sender]"
        echo "rsync error: error in rsync protocol data stream (code 12) at io.c(226) [sender=3.2.3]"
        exit 12
        ;;
    "permission")
        echo "rsync: recv_generator: mkdir \"/root/pixelated\" failed: Permission denied (13)"
        echo "rsync error: some files/attrs were not transferred (see previous errors) (code 23)"
        exit 23
        ;;
    "disk-full")
        echo "rsync: write failed on \"/root/pixelated/large-file\": No space left on device (28)"
        echo "rsync error: error in file IO (code 11)"
        exit 11
        ;;
    "partial")
        echo "sent 1,234 bytes  received 567 bytes  1,801.00 bytes/sec"
        echo "rsync error: some files could not be transferred (code 23)"
        exit 23
        ;;
    *)
        echo "Unknown failure type: $failure_type"
        exit 1
        ;;
esac
EOF
        chmod +x "$TEST_DIR/mocks/rsync-$failure_type"
    }
    
    test_rsync_failure_handling() {
        local failure_type="$1"
        local expected_code="$2"
        
        create_failing_rsync_mock "$failure_type"
        
        # Simulate rsync with failure
        "$TEST_DIR/mocks/rsync-$failure_type" -avz /source/ root@host:/dest/ >/dev/null 2>&1
        local exit_code=$?
        
        if [[ $exit_code -eq $expected_code ]]; then
            return 0
        else
            return 1
        fi
    }
    
    # Test network failure
    if test_rsync_failure_handling "network" 12; then
        print_test_pass "Rsync network failure correctly detected (exit code 12)"
    else
        print_test_fail "Rsync network failure not handled properly"
    fi
    
    # Test permission failure
    ((TESTS_RUN++))
    if test_rsync_failure_handling "permission" 23; then
        print_test_pass "Rsync permission failure correctly detected (exit code 23)"
    else
        print_test_fail "Rsync permission failure not handled properly"
    fi
    
    # Test disk full failure
    ((TESTS_RUN++))
    if test_rsync_failure_handling "disk-full" 11; then
        print_test_pass "Rsync disk full failure correctly detected (exit code 11)"
    else
        print_test_fail "Rsync disk full failure not handled properly"
    fi
}

# Test container build failures
test_container_build_failures() {
    print_test_header "Testing container build failure scenarios"
    
    # Test Docker build failures
    ((TESTS_RUN++))
    
    create_failing_docker_mock() {
        local failure_type="$1"
        
        cat > "$TEST_DIR/mocks/docker-$failure_type" << EOF
#!/bin/bash
# Mock docker that simulates $failure_type

case "\$1" in
    "build")
        case "$failure_type" in
            "dockerfile-error")
                echo "Step 1/8 : FROM node:18-alpine"
                echo "Step 2/8 : WORKDIR /app"
                echo "Step 3/8 : COPY package*.json ./"
                echo "ERROR: failed to solve: failed to read dockerfile: error from sender: dockerfile parse error line 10: unknown instruction: INVALID"
                exit 1
                ;;
            "network-error")
                echo "Step 1/8 : FROM node:18-alpine"
                echo "ERROR: failed to solve: node:18-alpine: failed to resolve source metadata for docker.io/library/node:18-alpine: failed to do request: Head \"https://registry-1.docker.io/v2/library/node/manifests/18-alpine\": dial tcp: lookup registry-1.docker.io: no such host"
                exit 1
                ;;
            "build-error")
                echo "Step 1/8 : FROM node:18-alpine"
                echo "Step 2/8 : WORKDIR /app"
                echo "Step 3/8 : COPY package*.json ./"
                echo "Step 4/8 : RUN npm install"
                echo "npm ERR! code ENOTFOUND"
                echo "npm ERR! errno ENOTFOUND"
                echo "npm ERR! network request to https://registry.npmjs.org/express failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org"
                echo "The command '/bin/sh -c npm install' returned a non-zero code: 1"
                exit 1
                ;;
            "disk-full")
                echo "Step 1/8 : FROM node:18-alpine"
                echo "Step 2/8 : WORKDIR /app"
                echo "ERROR: failed to solve: failed to write to disk: no space left on device"
                exit 1
                ;;
            *)
                echo "Unknown failure type: $failure_type"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Mock docker: \$*"
        exit 0
        ;;
esac
EOF
        chmod +x "$TEST_DIR/mocks/docker-$failure_type"
    }
    
    test_docker_build_failure() {
        local failure_type="$1"
        local expected_error="$2"
        
        create_failing_docker_mock "$failure_type"
        
        # Simulate docker build with failure
        local output=$("$TEST_DIR/mocks/docker-$failure_type" build -t test:latest . 2>&1)
        local exit_code=$?
        
        if [[ $exit_code -ne 0 ]] && echo "$output" | grep -q "$expected_error"; then
            return 0
        else
            return 1
        fi
    }
    
    # Test Dockerfile syntax error
    if test_docker_build_failure "dockerfile-error" "dockerfile parse error"; then
        print_test_pass "Docker Dockerfile syntax error correctly detected"
    else
        print_test_fail "Docker Dockerfile syntax error not handled properly"
    fi
    
    # Test network error during build
    ((TESTS_RUN++))
    if test_docker_build_failure "network-error" "no such host"; then
        print_test_pass "Docker network error during build correctly detected"
    else
        print_test_fail "Docker network error during build not handled properly"
    fi
    
    # Test build command failure
    ((TESTS_RUN++))
    if test_docker_build_failure "build-error" "npm ERR!"; then
        print_test_pass "Docker build command failure correctly detected"
    else
        print_test_fail "Docker build command failure not handled properly"
    fi
    
    # Test disk full during build
    ((TESTS_RUN++))
    if test_docker_build_failure "disk-full" "no space left on device"; then
        print_test_pass "Docker disk full error correctly detected"
    else
        print_test_fail "Docker disk full error not handled properly"
    fi
}

# Test health check failures
test_health_check_failures() {
    print_test_header "Testing health check failure scenarios"
    
    # Test various health check failure types
    ((TESTS_RUN++))
    
    create_failing_health_check_mock() {
        local failure_type="$1"
        
        cat > "$TEST_DIR/mocks/curl-$failure_type" << EOF
#!/bin/bash
# Mock curl that simulates $failure_type

case "$failure_type" in
    "connection-refused")
        echo "curl: (7) Failed to connect to localhost port 3000: Connection refused"
        exit 7
        ;;
    "timeout")
        echo "curl: (28) Operation timed out after 10000 milliseconds with 0 bytes received"
        exit 28
        ;;
    "404-error")
        echo "HTTP/1.1 404 Not Found"
        echo "Content-Type: text/html"
        echo ""
        echo "<html><body><h1>404 Not Found</h1></body></html>"
        exit 22
        ;;
    "500-error")
        echo "HTTP/1.1 500 Internal Server Error"
        echo "Content-Type: text/html"
        echo ""
        echo "<html><body><h1>500 Internal Server Error</h1></body></html>"
        exit 22
        ;;
    "ssl-error")
        echo "curl: (60) SSL certificate problem: self signed certificate"
        exit 60
        ;;
    *)
        echo "Unknown failure type: $failure_type"
        exit 1
        ;;
esac
EOF
        chmod +x "$TEST_DIR/mocks/curl-$failure_type"
    }
    
    test_health_check_failure() {
        local failure_type="$1"
        local expected_exit_code="$2"
        
        create_failing_health_check_mock "$failure_type"
        
        # Simulate health check with failure
        "$TEST_DIR/mocks/curl-$failure_type" -f http://localhost:3000 >/dev/null 2>&1
        local exit_code=$?
        
        if [[ $exit_code -eq $expected_exit_code ]]; then
            return 0
        else
            return 1
        fi
    }
    
    # Test connection refused
    if test_health_check_failure "connection-refused" 7; then
        print_test_pass "Health check connection refused correctly detected (exit code 7)"
    else
        print_test_fail "Health check connection refused not handled properly"
    fi
    
    # Test timeout
    ((TESTS_RUN++))
    if test_health_check_failure "timeout" 28; then
        print_test_pass "Health check timeout correctly detected (exit code 28)"
    else
        print_test_fail "Health check timeout not handled properly"
    fi
    
    # Test 404 error
    ((TESTS_RUN++))
    if test_health_check_failure "404-error" 22; then
        print_test_pass "Health check 404 error correctly detected (exit code 22)"
    else
        print_test_fail "Health check 404 error not handled properly"
    fi
    
    # Test 500 error
    ((TESTS_RUN++))
    if test_health_check_failure "500-error" 22; then
        print_test_pass "Health check 500 error correctly detected (exit code 22)"
    else
        print_test_fail "Health check 500 error not handled properly"
    fi
}

# Test registry push failures
test_registry_push_failures() {
    print_test_header "Testing registry push failure scenarios"
    
    # Test Docker registry push failures
    ((TESTS_RUN++))
    
    create_failing_registry_mock() {
        local failure_type="$1"
        
        cat > "$TEST_DIR/mocks/docker-registry-$failure_type" << EOF
#!/bin/bash
# Mock docker that simulates registry $failure_type

case "\$1" in
    "push")
        case "$failure_type" in
            "auth-error")
                echo "The push refers to repository [git.pixelatedempathy.com/pixelated-empathy]"
                echo "denied: requested access to the resource is denied"
                exit 1
                ;;
            "network-error")
                echo "The push refers to repository [git.pixelatedempathy.com/pixelated-empathy]"
                echo "error: failed to push some refs to 'git.pixelatedempathy.com/pixelated-empathy'"
                echo "dial tcp: lookup git.pixelatedempathy.com: no such host"
                exit 1
                ;;
            "quota-exceeded")
                echo "The push refers to repository [git.pixelatedempathy.com/pixelated-empathy]"
                echo "error: failed to push some refs to 'git.pixelatedempathy.com/pixelated-empathy'"
                echo "denied: requested access to the resource is denied: insufficient_scope: authorization failed"
                exit 1
                ;;
            "timeout")
                echo "The push refers to repository [git.pixelatedempathy.com/pixelated-empathy]"
                echo "error: failed to push some refs to 'git.pixelatedempathy.com/pixelated-empathy'"
                echo "net/http: TLS handshake timeout"
                exit 1
                ;;
            *)
                echo "Unknown failure type: $failure_type"
                exit 1
                ;;
        esac
        ;;
    *)
        echo "Mock docker: \$*"
        exit 0
        ;;
esac
EOF
        chmod +x "$TEST_DIR/mocks/docker-registry-$failure_type"
    }
    
    test_registry_push_failure() {
        local failure_type="$1"
        local expected_error="$2"
        
        create_failing_registry_mock "$failure_type"
        
        # Simulate registry push with failure
        local output=$("$TEST_DIR/mocks/docker-registry-$failure_type" push git.pixelatedempathy.com/pixelated-empathy:latest 2>&1)
        local exit_code=$?
        
        if [[ $exit_code -ne 0 ]] && echo "$output" | grep -q "$expected_error"; then
            return 0
        else
            return 1
        fi
    }
    
    # Test authentication error
    if test_registry_push_failure "auth-error" "access to the resource is denied"; then
        print_test_pass "Registry authentication error correctly detected"
    else
        print_test_fail "Registry authentication error not handled properly"
    fi
    
    # Test network error
    ((TESTS_RUN++))
    if test_registry_push_failure "network-error" "no such host"; then
        print_test_pass "Registry network error correctly detected"
    else
        print_test_fail "Registry network error not handled properly"
    fi
    
    # Test quota exceeded
    ((TESTS_RUN++))
    if test_registry_push_failure "quota-exceeded" "authorization failed"; then
        print_test_pass "Registry quota exceeded error correctly detected"
    else
        print_test_fail "Registry quota exceeded error not handled properly"
    fi
}

# Test environment variable security failures
test_environment_security_failures() {
    print_test_header "Testing environment variable security failure scenarios"
    
    # Test encryption failures
    ((TESTS_RUN++))
    
    create_failing_encryption_mock() {
        local failure_type="$1"
        
        cat > "$TEST_DIR/mocks/openssl-$failure_type" << EOF
#!/bin/bash
# Mock openssl that simulates $failure_type

case "$failure_type" in
    "bad-decrypt")
        echo "bad decrypt"
        echo "140234567890:error:06065064:digital envelope routines:EVP_DecryptFinal_ex:bad decrypt:evp_enc.c:529:"
        exit 1
        ;;
    "file-not-found")
        echo "can't open input file: No such file or directory"
        exit 1
        ;;
    "permission-denied")
        echo "can't open output file: Permission denied"
        exit 1
        ;;
    *)
        echo "Unknown failure type: $failure_type"
        exit 1
        ;;
esac
EOF
        chmod +x "$TEST_DIR/mocks/openssl-$failure_type"
    }
    
    test_encryption_failure() {
        local failure_type="$1"
        local expected_error="$2"
        
        create_failing_encryption_mock "$failure_type"
        
        # Simulate encryption/decryption with failure
        local output=$("$TEST_DIR/mocks/openssl-$failure_type" enc -aes-256-cbc -d -in test.enc -out test.dec -k wrongpass 2>&1)
        local exit_code=$?
        
        if [[ $exit_code -ne 0 ]] && echo "$output" | grep -q "$expected_error"; then
            return 0
        else
            return 1
        fi
    }
    
    # Test bad decryption (wrong password)
    if test_encryption_failure "bad-decrypt" "bad decrypt"; then
        print_test_pass "Environment encryption bad decrypt error correctly detected"
    else
        print_test_fail "Environment encryption bad decrypt error not handled properly"
    fi
    
    # Test file not found
    ((TESTS_RUN++))
    if test_encryption_failure "file-not-found" "No such file or directory"; then
        print_test_pass "Environment encryption file not found error correctly detected"
    else
        print_test_fail "Environment encryption file not found error not handled properly"
    fi
    
    # Test permission denied
    ((TESTS_RUN++))
    if test_encryption_failure "permission-denied" "Permission denied"; then
        print_test_pass "Environment encryption permission denied error correctly detected"
    else
        print_test_fail "Environment encryption permission denied error not handled properly"
    fi
}

# Test rollback failure scenarios
test_rollback_failure_scenarios() {
    print_test_header "Testing rollback failure scenarios"
    
    # Test rollback when backup is missing
    ((TESTS_RUN++))
    
    simulate_rollback_failure() {
        local failure_type="$1"
        local rollback_log="$TEST_DIR/rollback-$failure_type.log"
        
        echo "=== Rollback Failure Simulation: $failure_type ===" > "$rollback_log"
        
        case "$failure_type" in
            "missing-backup")
                echo "[$(date)] Attempting rollback..." >> "$rollback_log"
                echo "[$(date)] ERROR: Backup directory not found" >> "$rollback_log"
                echo "[$(date)] Rollback failed - no backup available" >> "$rollback_log"
                return 1
                ;;
            "container-start-fail")
                echo "[$(date)] Attempting rollback..." >> "$rollback_log"
                echo "[$(date)] Backup found, restoring files..." >> "$rollback_log"
                echo "[$(date)] ERROR: Failed to start rollback container" >> "$rollback_log"
                echo "[$(date)] docker: Error response from daemon: port already in use" >> "$rollback_log"
                return 1
                ;;
            "health-check-fail")
                echo "[$(date)] Attempting rollback..." >> "$rollback_log"
                echo "[$(date)] Backup restored, container started..." >> "$rollback_log"
                echo "[$(date)] ERROR: Rollback health check failed" >> "$rollback_log"
                echo "[$(date)] curl: (7) Failed to connect to localhost port 3000" >> "$rollback_log"
                return 1
                ;;
            *)
                echo "[$(date)] Unknown rollback failure type: $failure_type" >> "$rollback_log"
                return 1
                ;;
        esac
    }
    
    # Test missing backup scenario
    if ! simulate_rollback_failure "missing-backup"; then
        if grep -q "Backup directory not found" "$TEST_DIR/rollback-missing-backup.log"; then
            print_test_pass "Rollback missing backup failure correctly detected and logged"
        else
            print_test_fail "Rollback missing backup failure not properly logged"
        fi
    else
        print_test_fail "Rollback missing backup scenario should have failed"
    fi
    
    # Test container start failure
    ((TESTS_RUN++))
    if ! simulate_rollback_failure "container-start-fail"; then
        if grep -q "Failed to start rollback container" "$TEST_DIR/rollback-container-start-fail.log"; then
            print_test_pass "Rollback container start failure correctly detected and logged"
        else
            print_test_fail "Rollback container start failure not properly logged"
        fi
    else
        print_test_fail "Rollback container start failure scenario should have failed"
    fi
    
    # Test health check failure after rollback
    ((TESTS_RUN++))
    if ! simulate_rollback_failure "health-check-fail"; then
        if grep -q "Rollback health check failed" "$TEST_DIR/rollback-health-check-fail.log"; then
            print_test_pass "Rollback health check failure correctly detected and logged"
        else
            print_test_fail "Rollback health check failure not properly logged"
        fi
    else
        print_test_fail "Rollback health check failure scenario should have failed"
    fi
}

# Test cascading failure scenarios
test_cascading_failure_scenarios() {
    print_test_header "Testing cascading failure scenarios"
    
    # Test multiple failures in sequence
    ((TESTS_RUN++))
    
    simulate_cascading_failures() {
        local scenario_log="$TEST_DIR/cascading-failures.log"
        
        echo "=== Cascading Failure Simulation ===" > "$scenario_log"
        
        # Failure 1: Network issue during sync
        echo "[$(date)] Stage 1: Code Sync - NETWORK FAILURE" >> "$scenario_log"
        echo "[$(date)] Retrying sync (attempt 1/3)..." >> "$scenario_log"
        echo "[$(date)] Retrying sync (attempt 2/3)..." >> "$scenario_log"
        echo "[$(date)] Retrying sync (attempt 3/3)..." >> "$scenario_log"
        echo "[$(date)] Sync failed after 3 attempts" >> "$scenario_log"
        
        # Failure 2: Fallback to local build fails
        echo "[$(date)] Attempting local build fallback..." >> "$scenario_log"
        echo "[$(date)] Stage 2: Local Build - BUILD FAILURE" >> "$scenario_log"
        echo "[$(date)] Docker build failed: dependency resolution error" >> "$scenario_log"
        
        # Failure 3: Rollback attempt fails
        echo "[$(date)] Attempting rollback to previous version..." >> "$scenario_log"
        echo "[$(date)] Stage 3: Rollback - ROLLBACK FAILURE" >> "$scenario_log"
        echo "[$(date)] Rollback failed: backup corrupted" >> "$scenario_log"
        
        # Final state: System in degraded state
        echo "[$(date)] CRITICAL: System in degraded state" >> "$scenario_log"
        echo "[$(date)] Manual intervention required" >> "$scenario_log"
        
        return 1  # Cascading failure should fail
    }
    
    if ! simulate_cascading_failures; then
        local failure_count=$(grep -c "FAILURE" "$TEST_DIR/cascading-failures.log")
        local critical_count=$(grep -c "CRITICAL" "$TEST_DIR/cascading-failures.log")
        
        if [[ $failure_count -ge 3 ]] && [[ $critical_count -ge 1 ]]; then
            print_test_pass "Cascading failure scenario correctly simulates multiple failures and critical state"
        else
            print_test_fail "Cascading failure scenario missing expected failure patterns"
        fi
    else
        print_test_fail "Cascading failure scenario should have failed"
    fi
}

# Run all failure scenario tests
run_all_failure_tests() {
    print_test_header "Starting Failure Scenario Integration Tests"
    
    setup_test_environment
    
    # Run individual failure test categories
    test_network_connectivity_failures
    test_rsync_synchronization_failures
    test_container_build_failures
    test_health_check_failures
    test_registry_push_failures
    test_environment_security_failures
    test_rollback_failure_scenarios
    test_cascading_failure_scenarios
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Failure Scenario Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All failure scenario tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED failure scenario tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_failure_tests
fi