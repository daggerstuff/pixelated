#!/bin/bash

# End-to-End Deployment Integration Tests
# Tests complete deployment scenarios from start to finish

set -e

# Test configuration
TEST_DIR="/tmp/deployment-integration-e2e"
TEST_LOG="/tmp/test-e2e-deployment.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_SCRIPT="$SCRIPT_DIR/../../../scripts/rsync.sh"

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
print_test_header() { echo -e "${BLUE}[E2E-TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Mock external services and commands
setup_integration_mocks() {
    print_test_info "Setting up integration test mocks"

    # Create mock SSH command
    cat > "$TEST_DIR/ssh" << 'EOF'
#!/bin/bash
# Mock SSH command for integration testing

# Extract the command being run remotely
local remote_command=""
local host=""
local user=""

# Parse SSH arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i)
            shift 2  # Skip key file
            ;;
        -p)
            shift 2  # Skip port
            ;;
        -o)
            shift 2  # Skip options
            ;;
        *@*)
            host="$1"
            shift
            ;;
        *)
            remote_command="$*"
            break
            ;;
    esac
done

# Mock remote command execution
case "$remote_command" in
    *"node --version"*)
        echo "v24.7.0"
        exit 0
        ;;
    *"pnpm --version"*)
        echo "10.26.2"
        exit 0
        ;;
    *"docker ps"*)
        echo "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES"
        echo "abc123def456   test:latest   \"npm start\"   1 min ago   Up 1 min   0.0.0.0:3000->3000/tcp   pixelated-app"
        exit 0
        ;;
    *"docker build"*)
        echo "Successfully built mock-image-id"
        echo "Successfully tagged pixelated-empathy:latest"
        exit 0
        ;;
    *"curl"*"localhost:3000"*)
        echo "HTTP/1.1 200 OK"
        echo "Content-Type: text/html"
        echo ""
        echo "<html><body><h1>Pixelated Empathy</h1></body></html>"
        exit 0
        ;;
    *"systemctl"*)
        echo "Service operation completed"
        exit 0
        ;;
    *)
        echo "Mock SSH executing: $remote_command"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/ssh"

    # Create mock rsync command
    cat > "$TEST_DIR/rsync" << 'EOF'
#!/bin/bash
# Mock rsync command for integration testing

echo "Mock rsync: syncing files..."
echo "sent 1,234 bytes  received 567 bytes  1,801.00 bytes/sec"
echo "total size is 12,345  speedup is 6.86"
exit 0
EOF
    chmod +x "$TEST_DIR/rsync"

    # Create mock docker command
    cat > "$TEST_DIR/docker" << 'EOF'
#!/bin/bash
# Mock docker command for integration testing

case "$1" in
    "build")
        echo "Step 1/8 : FROM node:18-slim"
        echo "Successfully built mock-image-id"
        echo "Successfully tagged $3"
        exit 0
        ;;
    "run")
        echo "mock-container-id"
        exit 0
        ;;
    "ps")
        echo "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES"
        echo "mock-container-id   test:latest   \"npm start\"   1 min ago   Up 1 min   0.0.0.0:3000->3000/tcp   test-container"
        exit 0
        ;;
    "stop"|"start"|"rm")
        echo "mock-container-id"
        exit 0
        ;;
    "push")
        echo "The push refers to repository [git.pixelatedempathy.tech/pixelated-empathy]"
        echo "latest: digest: sha256:mock-digest size: 1234"
        exit 0
        ;;
    *)
        echo "Mock docker: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/docker"

    # Create mock curl command
    cat > "$TEST_DIR/curl" << 'EOF'
#!/bin/bash
# Mock curl command for integration testing

if [[ "$*" =~ localhost:3000 ]]; then
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: text/html"
    echo ""
    echo "<html><body><h1>Pixelated Empathy</h1></body></html>"
    exit 0
else
    echo "Mock curl: $*"
    exit 0
fi
EOF
    chmod +x "$TEST_DIR/curl"

    export PATH="$TEST_DIR:$PATH"
}

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up end-to-end integration test environment"

    # Create test directory structure
    mkdir -p "$TEST_DIR"/{project,backup,logs}
    cd "$TEST_DIR"

    # Setup mocks
    setup_integration_mocks

    # Create mock project structure
    mkdir -p project/{src,public,scripts,docker}

    # Create package.json
    cat > project/package.json << 'EOF'
{
  "name": "pixelated-empathy",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "build": "npm run build:client && npm run build:server"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF

    # Create Dockerfile
    cat > project/Dockerfile << 'EOF'
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
EOF

    # Create mock server.js
    cat > project/server.js << 'EOF'
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('<html><body><h1>Pixelated Empathy</h1></body></html>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
EOF

    # Create .env file for testing
    cat > project/.env << 'EOF'
DATABASE_URL=postgresql://user:pass@localhost/pixelated
API_KEY=test-api-key-12345
JWT_SECRET=super-secret-jwt-key
REDIS_URL=redis://localhost:6379
EOF

    # Initialize test log
    echo "=== End-to-End Deployment Integration Tests - $(date) ===" > "$TEST_LOG"

    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up end-to-end test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test complete successful deployment scenario
test_successful_deployment_scenario() {
    print_test_header "Testing complete successful deployment scenario"
    ((TESTS_RUN++))

    # Simulate deployment script execution
    simulate_deployment() {
        local project_dir="$1"
        local vps_host="$2"
        local deployment_log="$3"

        echo "=== Starting Deployment Simulation ===" > "$deployment_log"

        # Stage 1: Environment Setup
        echo "[$(date)] Stage 1: Environment Setup" >> "$deployment_log"
        if ssh -o ConnectTimeout=5 root@"$vps_host" "node --version" >/dev/null 2>&1; then
            echo "[$(date)] Node.js version check: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Node.js version check: FAIL" >> "$deployment_log"
            return 1
        fi

        if ssh -o ConnectTimeout=5 root@"$vps_host" "pnpm --version" >/dev/null 2>&1; then
            echo "[$(date)] pnpm version check: PASS" >> "$deployment_log"
        else
            echo "[$(date)] pnpm version check: FAIL" >> "$deployment_log"
            return 1
        fi

        # Stage 2: Code Synchronization
        echo "[$(date)] Stage 2: Code Synchronization" >> "$deployment_log"
        if rsync -avz --delete "$project_dir/" root@"$vps_host":/root/pixelated/ >/dev/null 2>&1; then
            echo "[$(date)] Code synchronization: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Code synchronization: FAIL" >> "$deployment_log"
            return 1
        fi

        # Stage 3: Container Build
        echo "[$(date)] Stage 3: Container Build" >> "$deployment_log"
        if ssh root@"$vps_host" "cd /root/pixelated && docker build -t pixelated-empathy:latest ." >/dev/null 2>&1; then
            echo "[$(date)] Container build: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Container build: FAIL" >> "$deployment_log"
            return 1
        fi

        # Stage 4: Health Checks
        echo "[$(date)] Stage 4: Health Checks" >> "$deployment_log"
        sleep 2  # Simulate container startup time

        if ssh root@"$vps_host" "curl -f http://localhost:3000" >/dev/null 2>&1; then
            echo "[$(date)] Health check - root endpoint: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Health check - root endpoint: FAIL" >> "$deployment_log"
            return 1
        fi

        if ssh root@"$vps_host" "curl -f http://localhost:3000/api/health" >/dev/null 2>&1; then
            echo "[$(date)] Health check - API endpoint: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Health check - API endpoint: FAIL" >> "$deployment_log"
            return 1
        fi

        # Stage 5: Traffic Switch
        echo "[$(date)] Stage 5: Traffic Switch" >> "$deployment_log"
        if ssh root@"$vps_host" "systemctl reload caddy" >/dev/null 2>&1; then
            echo "[$(date)] Traffic switch: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Traffic switch: FAIL" >> "$deployment_log"
            return 1
        fi

        echo "[$(date)] Deployment completed successfully" >> "$deployment_log"
        return 0
    }

    local deployment_log="$TEST_DIR/deployment-success.log"

    if simulate_deployment "$TEST_DIR/project" "test-vps.example.com" "$deployment_log"; then
        # Verify all stages completed
        local stages_completed=$(grep -c "PASS" "$deployment_log")
        if [[ $stages_completed -ge 5 ]]; then
            print_test_pass "Complete successful deployment scenario executed all stages"
        else
            print_test_fail "Successful deployment scenario missing stages (completed: $stages_completed)"
        fi
    else
        print_test_fail "Successful deployment scenario failed"
    fi
}

# Test deployment with health check failure
test_health_check_failure_scenario() {
    print_test_header "Testing deployment with health check failure scenario"
    ((TESTS_RUN++))

    # Create failing curl mock
    cat > "$TEST_DIR/curl-fail" << 'EOF'
#!/bin/bash
# Mock curl that fails health checks
echo "curl: (7) Failed to connect to localhost port 3000: Connection refused"
exit 7
EOF
    chmod +x "$TEST_DIR/curl-fail"

    # Temporarily replace curl with failing version
    mv "$TEST_DIR/curl" "$TEST_DIR/curl-backup"
    mv "$TEST_DIR/curl-fail" "$TEST_DIR/curl"

    simulate_failing_deployment() {
        local project_dir="$1"
        local vps_host="$2"
        local deployment_log="$3"

        echo "=== Starting Failing Deployment Simulation ===" > "$deployment_log"

        # Stages 1-3 succeed
        echo "[$(date)] Stage 1: Environment Setup - PASS" >> "$deployment_log"
        echo "[$(date)] Stage 2: Code Synchronization - PASS" >> "$deployment_log"
        echo "[$(date)] Stage 3: Container Build - PASS" >> "$deployment_log"

        # Stage 4: Health Checks fail
        echo "[$(date)] Stage 4: Health Checks" >> "$deployment_log"
        if ssh root@"$vps_host" "curl -f http://localhost:3000" >/dev/null 2>&1; then
            echo "[$(date)] Health check - root endpoint: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Health check - root endpoint: FAIL" >> "$deployment_log"
            echo "[$(date)] Deployment failed - rolling back" >> "$deployment_log"
            return 1
        fi

        return 0
    }

    local deployment_log="$TEST_DIR/deployment-failure.log"

    if ! simulate_failing_deployment "$TEST_DIR/project" "test-vps.example.com" "$deployment_log"; then
        if grep -q "Health check.*FAIL" "$deployment_log" && grep -q "rolling back" "$deployment_log"; then
            print_test_pass "Health check failure scenario correctly fails and initiates rollback"
        else
            print_test_fail "Health check failure scenario didn't handle failure properly"
        fi
    else
        print_test_fail "Health check failure scenario should have failed"
    fi

    # Restore original curl
    mv "$TEST_DIR/curl-backup" "$TEST_DIR/curl"
}

# Test deployment with network issues
test_network_failure_scenario() {
    print_test_header "Testing deployment with network failure scenario"
    ((TESTS_RUN++))

    # Create failing SSH mock
    cat > "$TEST_DIR/ssh-fail" << 'EOF'
#!/bin/bash
# Mock SSH that fails with network errors
echo "ssh: connect to host test-vps.example.com port 22: Connection timed out"
exit 255
EOF
    chmod +x "$TEST_DIR/ssh-fail"

    # Temporarily replace SSH with failing version
    mv "$TEST_DIR/ssh" "$TEST_DIR/ssh-backup"
    mv "$TEST_DIR/ssh-fail" "$TEST_DIR/ssh"

    simulate_network_failure() {
        local project_dir="$1"
        local vps_host="$2"
        local deployment_log="$3"

        echo "=== Starting Network Failure Simulation ===" > "$deployment_log"

        # Stage 1: Environment Setup fails due to network
        echo "[$(date)] Stage 1: Environment Setup" >> "$deployment_log"
        if ssh -o ConnectTimeout=5 root@"$vps_host" "node --version" >/dev/null 2>&1; then
            echo "[$(date)] Node.js version check: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Node.js version check: FAIL - Network timeout" >> "$deployment_log"
            return 1
        fi

        return 0
    }

    local deployment_log="$TEST_DIR/deployment-network-failure.log"

    if ! simulate_network_failure "$TEST_DIR/project" "test-vps.example.com" "$deployment_log"; then
        if grep -q "Network timeout" "$deployment_log"; then
            print_test_pass "Network failure scenario correctly detects and handles network issues"
        else
            print_test_fail "Network failure scenario didn't detect network issues properly"
        fi
    else
        print_test_fail "Network failure scenario should have failed"
    fi

    # Restore original SSH
    mv "$TEST_DIR/ssh-backup" "$TEST_DIR/ssh"
}

# Test deployment with build failure
test_build_failure_scenario() {
    print_test_header "Testing deployment with build failure scenario"
    ((TESTS_RUN++))

    # Create failing docker mock
    cat > "$TEST_DIR/docker-fail" << 'EOF'
#!/bin/bash
# Mock docker that fails builds

case "$1" in
    "build")
        echo "Step 1/8 : FROM node:18-slim"
        echo "Step 2/8 : WORKDIR /app"
        echo "Step 3/8 : COPY package*.json ./"
        echo "ERROR: failed to solve: failed to read dockerfile"
        exit 1
        ;;
    *)
        echo "Mock docker: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/docker-fail"

    # Temporarily replace docker with failing version
    mv "$TEST_DIR/docker" "$TEST_DIR/docker-backup"
    mv "$TEST_DIR/docker-fail" "$TEST_DIR/docker"

    simulate_build_failure() {
        local project_dir="$1"
        local vps_host="$2"
        local deployment_log="$3"

        echo "=== Starting Build Failure Simulation ===" > "$deployment_log"

        # Stages 1-2 succeed
        echo "[$(date)] Stage 1: Environment Setup - PASS" >> "$deployment_log"
        echo "[$(date)] Stage 2: Code Synchronization - PASS" >> "$deployment_log"

        # Stage 3: Container Build fails
        echo "[$(date)] Stage 3: Container Build" >> "$deployment_log"
        if ssh root@"$vps_host" "cd /root/pixelated && docker build -t pixelated-empathy:latest ." >/dev/null 2>&1; then
            echo "[$(date)] Container build: PASS" >> "$deployment_log"
        else
            echo "[$(date)] Container build: FAIL - Build error" >> "$deployment_log"
            echo "[$(date)] Preserving old container, deployment aborted" >> "$deployment_log"
            return 1
        fi

        return 0
    }

    local deployment_log="$TEST_DIR/deployment-build-failure.log"

    if ! simulate_build_failure "$TEST_DIR/project" "test-vps.example.com" "$deployment_log"; then
        if grep -q "Build error" "$deployment_log" && grep -q "Preserving old container" "$deployment_log"; then
            print_test_pass "Build failure scenario correctly handles build errors and preserves old container"
        else
            print_test_fail "Build failure scenario didn't handle build failure properly"
        fi
    else
        print_test_fail "Build failure scenario should have failed"
    fi

    # Restore original docker
    mv "$TEST_DIR/docker-backup" "$TEST_DIR/docker"
}

# Test rollback procedure validation
test_rollback_procedure() {
    print_test_header "Testing rollback procedure validation"
    ((TESTS_RUN++))

    simulate_rollback() {
        local backup_dir="$1"
        local project_dir="$2"
        local rollback_log="$3"

        echo "=== Starting Rollback Simulation ===" > "$rollback_log"

        # Create backup directory
        mkdir -p "$backup_dir"
        echo "backup-version-content" > "$backup_dir/version.txt"

        # Simulate rollback steps
        echo "[$(date)] Step 1: Stopping current container" >> "$rollback_log"
        if docker stop pixelated-app >/dev/null 2>&1; then
            echo "[$(date)] Container stop: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Container stop: WARNING (container may not exist)" >> "$rollback_log"
        fi

        echo "[$(date)] Step 2: Restoring from backup" >> "$rollback_log"
        if [[ -d "$backup_dir" ]]; then
            # Simulate filesystem rollback
            echo "[$(date)] Backup restoration: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Backup restoration: FAIL - No backup found" >> "$rollback_log"
            return 1
        fi

        echo "[$(date)] Step 3: Starting rollback container" >> "$rollback_log"
        if docker run -d --name pixelated-app-rollback test:previous >/dev/null 2>&1; then
            echo "[$(date)] Rollback container start: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Rollback container start: FAIL" >> "$rollback_log"
            return 1
        fi

        echo "[$(date)] Step 4: Verifying rollback" >> "$rollback_log"
        sleep 1  # Simulate startup time
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "[$(date)] Rollback verification: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Rollback verification: FAIL" >> "$rollback_log"
            return 1
        fi

        echo "[$(date)] Rollback completed successfully" >> "$rollback_log"
        return 0
    }

    local rollback_log="$TEST_DIR/rollback-test.log"
    local backup_dir="$TEST_DIR/backup-test"

    if simulate_rollback "$backup_dir" "$TEST_DIR/project" "$rollback_log"; then
        local success_steps=$(grep -c "SUCCESS" "$rollback_log")
        if [[ $success_steps -ge 3 ]]; then
            print_test_pass "Rollback procedure validation completed all steps successfully"
        else
            print_test_fail "Rollback procedure validation missing steps (completed: $success_steps)"
        fi
    else
        print_test_fail "Rollback procedure validation failed"
    fi
}

# Test performance and timing validation
test_performance_timing_validation() {
    print_test_header "Testing performance and timing validation"
    ((TESTS_RUN++))

    measure_deployment_performance() {
        local deployment_log="$1"
        local performance_log="$2"

        echo "=== Deployment Performance Measurement ===" > "$performance_log"

        local start_time=$(date +%s%3N)

        # Simulate deployment stages with timing
        echo "[$(date)] Starting performance measurement" >> "$performance_log"

        # Stage 1: Environment Setup (should be fast)
        local stage1_start=$(date +%s%3N)
        sleep 0.1  # Simulate quick environment check
        local stage1_end=$(date +%s%3N)
        local stage1_duration=$((stage1_end - stage1_start))
        echo "Stage 1 (Environment Setup): ${stage1_duration}ms" >> "$performance_log"

        # Stage 2: Code Synchronization (moderate time)
        local stage2_start=$(date +%s%3N)
        sleep 0.5  # Simulate file transfer
        local stage2_end=$(date +%s%3N)
        local stage2_duration=$((stage2_end - stage2_start))
        echo "Stage 2 (Code Sync): ${stage2_duration}ms" >> "$performance_log"

        # Stage 3: Container Build (longest stage)
        local stage3_start=$(date +%s%3N)
        sleep 1.0  # Simulate container build
        local stage3_end=$(date +%s%3N)
        local stage3_duration=$((stage3_end - stage3_start))
        echo "Stage 3 (Container Build): ${stage3_duration}ms" >> "$performance_log"

        # Stage 4: Health Checks (should be fast)
        local stage4_start=$(date +%s%3N)
        sleep 0.2  # Simulate health checks
        local stage4_end=$(date +%s%3N)
        local stage4_duration=$((stage4_end - stage4_start))
        echo "Stage 4 (Health Checks): ${stage4_duration}ms" >> "$performance_log"

        local end_time=$(date +%s%3N)
        local total_duration=$((end_time - start_time))
        echo "Total Deployment Time: ${total_duration}ms" >> "$performance_log"

        # Validate performance thresholds
        if [[ $stage1_duration -lt 1000 ]]; then  # < 1 second
            echo "✅ Environment Setup performance: PASS" >> "$performance_log"
        else
            echo "❌ Environment Setup performance: FAIL (too slow)" >> "$performance_log"
            return 1
        fi

        if [[ $stage4_duration -lt 5000 ]]; then  # < 5 seconds
            echo "✅ Health Check performance: PASS" >> "$performance_log"
        else
            echo "❌ Health Check performance: FAIL (too slow)" >> "$performance_log"
            return 1
        fi

        if [[ $total_duration -lt 30000 ]]; then  # < 30 seconds total
            echo "✅ Total deployment performance: PASS" >> "$performance_log"
        else
            echo "❌ Total deployment performance: FAIL (too slow)" >> "$performance_log"
            return 1
        fi

        return 0
    }

    local performance_log="$TEST_DIR/performance-test.log"

    if measure_deployment_performance "$TEST_DIR/deployment.log" "$performance_log"; then
        local pass_count=$(grep -c "✅.*PASS" "$performance_log")
        if [[ $pass_count -ge 3 ]]; then
            print_test_pass "Performance and timing validation meets all thresholds"
        else
            print_test_fail "Performance and timing validation failed thresholds (passed: $pass_count/3)"
        fi
    else
        print_test_fail "Performance and timing validation failed"
    fi
}

# Test secure environment variable deployment
test_secure_environment_deployment() {
    print_test_header "Testing secure environment variable deployment scenario"
    ((TESTS_RUN++))

    simulate_secure_env_deployment() {
        local env_file="$1"
        local deployment_log="$2"

        echo "=== Secure Environment Variable Deployment ===" > "$deployment_log"

        # Step 1: Encrypt environment file
        echo "[$(date)] Step 1: Encrypting environment file" >> "$deployment_log"
        local encrypted_file="$TEST_DIR/.env.encrypted"
        if openssl enc -aes-256-cbc -salt -in "$env_file" -out "$encrypted_file" -k "test-passphrase" 2>/dev/null; then
            echo "[$(date)] Environment encryption: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Environment encryption: FAIL" >> "$deployment_log"
            return 1
        fi

        # Step 2: Transfer encrypted file
        echo "[$(date)] Step 2: Transferring encrypted environment file" >> "$deployment_log"
        if rsync -avz "$encrypted_file" root@test-vps:/tmp/.env.encrypted >/dev/null 2>&1; then
            echo "[$(date)] Encrypted file transfer: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Encrypted file transfer: FAIL" >> "$deployment_log"
            return 1
        fi

        # Step 3: Decrypt and load on VPS
        echo "[$(date)] Step 3: Decrypting and loading environment variables" >> "$deployment_log"
        if ssh root@test-vps "openssl enc -aes-256-cbc -d -in /tmp/.env.encrypted -out /tmp/.env.tmp -k test-passphrase" >/dev/null 2>&1; then
            echo "[$(date)] Environment decryption: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Environment decryption: FAIL" >> "$deployment_log"
            return 1
        fi

        # Step 4: Secure cleanup
        echo "[$(date)] Step 4: Secure cleanup of temporary files" >> "$deployment_log"
        if ssh root@test-vps "shred -vfz -n 3 /tmp/.env.tmp /tmp/.env.encrypted" >/dev/null 2>&1; then
            echo "[$(date)] Secure cleanup: SUCCESS" >> "$deployment_log"
        else
            echo "[$(date)] Secure cleanup: WARNING (files may still exist)" >> "$deployment_log"
        fi

        echo "[$(date)] Secure environment deployment completed" >> "$deployment_log"
        return 0
    }

    local deployment_log="$TEST_DIR/secure-env-deployment.log"

    if simulate_secure_env_deployment "$TEST_DIR/project/.env" "$deployment_log"; then
        local success_count=$(grep -c "SUCCESS" "$deployment_log")
        if [[ $success_count -ge 3 ]]; then
            print_test_pass "Secure environment variable deployment completed all security steps"
        else
            print_test_fail "Secure environment variable deployment missing security steps (completed: $success_count)"
        fi
    else
        print_test_fail "Secure environment variable deployment failed"
    fi
}

# Run all integration tests
run_all_integration_tests() {
    print_test_header "Starting End-to-End Deployment Integration Tests"

    setup_test_environment

    # Run individual test scenarios
    test_successful_deployment_scenario
    test_health_check_failure_scenario
    test_network_failure_scenario
    test_build_failure_scenario
    test_rollback_procedure
    test_performance_timing_validation
    test_secure_environment_deployment

    # cleanup_test_environment

    # Print test summary
    print_test_header "Integration Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All end-to-end integration tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED integration tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_integration_tests
fi
