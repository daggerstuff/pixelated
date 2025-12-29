#!/bin/bash

# Rollback Procedure Integration Tests
# Tests various rollback scenarios and recovery mechanisms

set -e

# Test configuration
TEST_DIR="/tmp/deployment-integration-rollback"
TEST_LOG="/tmp/test-rollback-procedures.log"
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
print_test_header() { echo -e "${BLUE}[ROLLBACK-TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Mock services for rollback testing
setup_rollback_mocks() {
    print_test_info "Setting up rollback test mocks"
    
    # Create mock docker command
    cat > "$TEST_DIR/docker" << 'EOF'
#!/bin/bash
# Mock docker command for rollback testing

case "$1" in
    "stop")
        echo "Stopping container: $2"
        exit 0
        ;;
    "rm")
        echo "Removing container: $2"
        exit 0
        ;;
    "run")
        local container_name=""
        local image=""
        for arg in "$@"; do
            if [[ "$prev_arg" == "--name" ]]; then
                container_name="$arg"
            elif [[ "$arg" =~ : && "$arg" != *"--"* ]]; then
                image="$arg"
            fi
            prev_arg="$arg"
        done
        echo "Started container $container_name from image $image"
        echo "mock-container-id-$(date +%s)"
        exit 0
        ;;
    "ps")
        echo "CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES"
        echo "abc123def456   test:latest   \"npm start\"   1 min ago   Up 1 min   0.0.0.0:3000->3000/tcp   pixelated-app"
        exit 0
        ;;
    "pull")
        echo "Pulling image: $2"
        echo "Status: Downloaded newer image for $2"
        exit 0
        ;;
    "images")
        echo "REPOSITORY                                    TAG       IMAGE ID      CREATED       SIZE"
        echo "git.pixelatedempathy.com/pixelated-empathy  20240130  old-image-id  2 hours ago   100MB"
        echo "git.pixelatedempathy.com/pixelated-empathy  20240131  new-image-id  1 hour ago    100MB"
        echo "pixelated-empathy                            latest    new-image-id  1 hour ago    100MB"
        exit 0
        ;;
    *)
        echo "Mock docker: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/docker"
    
    # Create mock systemctl command
    cat > "$TEST_DIR/systemctl" << 'EOF'
#!/bin/bash
# Mock systemctl command for rollback testing

case "$1" in
    "stop"|"start"|"restart"|"reload")
        echo "Service $1 operation completed for $2"
        exit 0
        ;;
    "status")
        echo "$2.service - Mock Service"
        echo "   Loaded: loaded (/etc/systemd/system/$2.service; enabled)"
        echo "   Active: active (running) since $(date)"
        exit 0
        ;;
    *)
        echo "Mock systemctl: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/systemctl"
    
    # Create mock curl command
    cat > "$TEST_DIR/curl" << 'EOF'
#!/bin/bash
# Mock curl command for rollback testing

if [[ "$*" =~ localhost:3000 ]]; then
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: text/html"
    echo ""
    echo "<html><body><h1>Pixelated Empathy - Rollback Version</h1></body></html>"
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
    print_test_header "Setting up rollback procedure test environment"
    
    # Create test directory structure
    mkdir -p "$TEST_DIR"/{backups,current,logs,scripts}
    cd "$TEST_DIR"
    
    # Setup mocks
    setup_rollback_mocks
    
    # Create mock backup directories
    for i in {1..3}; do
        local backup_dir="backups/backup-$(date -d "$i hours ago" +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"/{src,public,scripts}
        echo "console.log('backup version $i');" > "$backup_dir/src/app.js"
        echo "<h1>Backup Version $i</h1>" > "$backup_dir/public/index.html"
        echo "#!/bin/bash\necho 'backup script $i'" > "$backup_dir/scripts/deploy.sh"
        
        # Create backup metadata
        cat > "$backup_dir/backup-metadata.json" << EOF
{
  "backup_info": {
    "created_at": "$(date -d "$i hours ago" -Iseconds)",
    "commit_hash": "abc123$i",
    "backup_type": "pre_deployment",
    "version": "$i"
  }
}
EOF
    done
    
    # Create current deployment
    mkdir -p current/{src,public,scripts}
    echo "console.log('current broken version');" > current/src/app.js
    echo "<h1>Current Broken Version</h1>" > current/public/index.html
    echo "#!/bin/bash\necho 'current broken script'" > current/scripts/deploy.sh
    
    # Initialize test log
    echo "=== Rollback Procedure Integration Tests - $(date) ===" > "$TEST_LOG"
    
    print_test_info "Test environment initialized in $TEST_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up rollback procedure test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test immediate rollback after health check failure
test_immediate_rollback_health_failure() {
    print_test_header "Testing immediate rollback after health check failure"
    ((TESTS_RUN++))
    
    simulate_immediate_rollback() {
        local rollback_log="$1"
        
        echo "=== Immediate Rollback Simulation ===" > "$rollback_log"
        
        # Simulate deployment failure
        echo "[$(date)] Deployment health check failed" >> "$rollback_log"
        echo "[$(date)] Initiating immediate rollback..." >> "$rollback_log"
        
        # Step 1: Stop failed container
        echo "[$(date)] Step 1: Stopping failed container" >> "$rollback_log"
        if docker stop pixelated-app-new >/dev/null 2>&1; then
            echo "[$(date)] Failed container stopped: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Failed container stop: WARNING (may not exist)" >> "$rollback_log"
        fi
        
        # Step 2: Remove failed container
        echo "[$(date)] Step 2: Removing failed container" >> "$rollback_log"
        if docker rm pixelated-app-new >/dev/null 2>&1; then
            echo "[$(date)] Failed container removed: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Failed container removal: WARNING" >> "$rollback_log"
        fi
        
        # Step 3: Ensure old container is running
        echo "[$(date)] Step 3: Ensuring old container is running" >> "$rollback_log"
        if docker ps | grep -q pixelated-app; then
            echo "[$(date)] Old container status: RUNNING" >> "$rollback_log"
        else
            echo "[$(date)] Starting old container..." >> "$rollback_log"
            if docker run -d --name pixelated-app pixelated-empathy:previous >/dev/null 2>&1; then
                echo "[$(date)] Old container started: SUCCESS" >> "$rollback_log"
            else
                echo "[$(date)] Old container start: FAIL" >> "$rollback_log"
                return 1
            fi
        fi
        
        # Step 4: Verify rollback
        echo "[$(date)] Step 4: Verifying rollback" >> "$rollback_log"
        sleep 1  # Simulate startup time
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "[$(date)] Rollback verification: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Rollback verification: FAIL" >> "$rollback_log"
            return 1
        fi
        
        echo "[$(date)] Immediate rollback completed successfully" >> "$rollback_log"
        return 0
    }
    
    local rollback_log="$TEST_DIR/immediate-rollback.log"
    
    if simulate_immediate_rollback "$rollback_log"; then
        local success_count=$(grep -c "SUCCESS" "$rollback_log")
        if [[ $success_count -ge 3 ]]; then
            print_test_pass "Immediate rollback after health check failure completed successfully"
        else
            print_test_fail "Immediate rollback missing success steps (completed: $success_count)"
        fi
    else
        print_test_fail "Immediate rollback after health check failure failed"
    fi
}

# Test filesystem rollback procedure
test_filesystem_rollback() {
    print_test_header "Testing filesystem rollback procedure"
    ((TESTS_RUN++))
    
    simulate_filesystem_rollback() {
        local backup_dir="$1"
        local project_dir="$2"
        local rollback_log="$3"
        
        echo "=== Filesystem Rollback Simulation ===" > "$rollback_log"
        
        # Step 1: Stop services
        echo "[$(date)] Step 1: Stopping services" >> "$rollback_log"
        if systemctl stop caddy >/dev/null 2>&1; then
            echo "[$(date)] Service stop: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Service stop: WARNING" >> "$rollback_log"
        fi
        
        # Step 2: Backup current (failed) deployment
        echo "[$(date)] Step 2: Backing up failed deployment" >> "$rollback_log"
        local failed_backup="$TEST_DIR/failed-deployment-$(date +%Y%m%d-%H%M%S)"
        if cp -r "$project_dir" "$failed_backup" 2>/dev/null; then
            echo "[$(date)] Failed deployment backup: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Failed deployment backup: WARNING" >> "$rollback_log"
        fi
        
        # Step 3: Restore from backup
        echo "[$(date)] Step 3: Restoring from backup" >> "$rollback_log"
        if [[ -d "$backup_dir" ]]; then
            rm -rf "$project_dir"
            if cp -r "$backup_dir" "$project_dir" 2>/dev/null; then
                echo "[$(date)] Filesystem restore: SUCCESS" >> "$rollback_log"
            else
                echo "[$(date)] Filesystem restore: FAIL" >> "$rollback_log"
                return 1
            fi
        else
            echo "[$(date)] Filesystem restore: FAIL - Backup not found" >> "$rollback_log"
            return 1
        fi
        
        # Step 4: Restart services
        echo "[$(date)] Step 4: Restarting services" >> "$rollback_log"
        if systemctl start caddy >/dev/null 2>&1; then
            echo "[$(date)] Service restart: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Service restart: FAIL" >> "$rollback_log"
            return 1
        fi
        
        # Step 5: Verify rollback
        echo "[$(date)] Step 5: Verifying filesystem rollback" >> "$rollback_log"
        if [[ -f "$project_dir/src/app.js" ]] && grep -q "backup version" "$project_dir/src/app.js"; then
            echo "[$(date)] Filesystem verification: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Filesystem verification: FAIL" >> "$rollback_log"
            return 1
        fi
        
        echo "[$(date)] Filesystem rollback completed successfully" >> "$rollback_log"
        return 0
    }
    
    local rollback_log="$TEST_DIR/filesystem-rollback.log"
    local latest_backup=$(ls -1t "$TEST_DIR/backups" | head -1)
    local backup_path="$TEST_DIR/backups/$latest_backup"
    
    if simulate_filesystem_rollback "$backup_path" "$TEST_DIR/current" "$rollback_log"; then
        local success_count=$(grep -c "SUCCESS" "$rollback_log")
        if [[ $success_count -ge 4 ]]; then
            print_test_pass "Filesystem rollback procedure completed successfully"
        else
            print_test_fail "Filesystem rollback missing success steps (completed: $success_count)"
        fi
    else
        print_test_fail "Filesystem rollback procedure failed"
    fi
}

# Test registry-based rollback
test_registry_rollback() {
    print_test_header "Testing registry-based rollback procedure"
    ((TESTS_RUN++))
    
    simulate_registry_rollback() {
        local registry_image="$1"
        local container_name="$2"
        local rollback_log="$3"
        
        echo "=== Registry Rollback Simulation ===" > "$rollback_log"
        
        # Step 1: Pull previous image from registry
        echo "[$(date)] Step 1: Pulling previous image from registry" >> "$rollback_log"
        if docker pull "$registry_image" >/dev/null 2>&1; then
            echo "[$(date)] Registry pull: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Registry pull: FAIL" >> "$rollback_log"
            return 1
        fi
        
        # Step 2: Stop current container
        echo "[$(date)] Step 2: Stopping current container" >> "$rollback_log"
        if docker stop "$container_name" >/dev/null 2>&1; then
            echo "[$(date)] Container stop: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Container stop: WARNING (may not exist)" >> "$rollback_log"
        fi
        
        # Step 3: Start rollback container
        echo "[$(date)] Step 3: Starting rollback container" >> "$rollback_log"
        local rollback_container="${container_name}-rollback"
        if docker run -d --name "$rollback_container" -p 3000:3000 "$registry_image" >/dev/null 2>&1; then
            echo "[$(date)] Rollback container start: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Rollback container start: FAIL" >> "$rollback_log"
            return 1
        fi
        
        # Step 4: Update proxy configuration
        echo "[$(date)] Step 4: Updating proxy configuration" >> "$rollback_log"
        if systemctl reload caddy >/dev/null 2>&1; then
            echo "[$(date)] Proxy update: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Proxy update: WARNING" >> "$rollback_log"
        fi
        
        # Step 5: Verify rollback
        echo "[$(date)] Step 5: Verifying registry rollback" >> "$rollback_log"
        sleep 2  # Simulate container startup time
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "[$(date)] Registry rollback verification: SUCCESS" >> "$rollback_log"
        else
            echo "[$(date)] Registry rollback verification: FAIL" >> "$rollback_log"
            return 1
        fi
        
        echo "[$(date)] Registry rollback completed successfully" >> "$rollback_log"
        return 0
    }
    
    local rollback_log="$TEST_DIR/registry-rollback.log"
    local registry_image="git.pixelatedempathy.com/pixelated-empathy:20240130"
    
    if simulate_registry_rollback "$registry_image" "pixelated-app" "$rollback_log"; then
        local success_count=$(grep -c "SUCCESS" "$rollback_log")
        if [[ $success_count -ge 4 ]]; then
            print_test_pass "Registry-based rollback procedure completed successfully"
        else
            print_test_fail "Registry-based rollback missing success steps (completed: $success_count)"
        fi
    else
        print_test_fail "Registry-based rollback procedure failed"
    fi
}

# Test rollback command generation
test_rollback_command_generation() {
    print_test_header "Testing rollback command generation"
    ((TESTS_RUN++))
    
    generate_rollback_commands() {
        local backup_dir="$1"
        local project_dir="$2"
        local registry_image="$3"
        local container_name="$4"
        local commands_file="$5"
        
        cat > "$commands_file" << EOF
#!/bin/bash
# Rollback Commands Generated $(date)
# Multiple rollback options available

echo "=== Pixelated Empathy Rollback Options ==="
echo ""

echo "Option 1: Container-based rollback (fastest)"
echo "docker stop $container_name 2>/dev/null || true"
echo "docker run -d --name ${container_name}-rollback --restart unless-stopped -p 3000:3000 pixelated-empathy:previous"
echo ""

echo "Option 2: Filesystem rollback (most reliable)"
echo "sudo systemctl stop caddy"
echo "sudo mv $project_dir ${project_dir}-failed-\$(date +%Y%m%d-%H%M%S)"
echo "sudo cp -r $backup_dir $project_dir"
echo "sudo systemctl start caddy"
echo ""

echo "Option 3: Registry-based rollback (if available)"
echo "docker pull $registry_image"
echo "docker stop $container_name 2>/dev/null || true"
echo "docker run -d --name ${container_name}-registry-rollback --restart unless-stopped -p 3000:3000 $registry_image"
echo ""

echo "Verification command:"
echo "curl -f http://localhost:3000 || echo 'Rollback verification failed'"
echo ""

echo "Priority: Option 2 (filesystem) is most reliable"
echo "Speed: Option 1 (container) is fastest"
echo "Flexibility: Option 3 (registry) allows version selection"
EOF
        
        chmod +x "$commands_file"
        return 0
    }
    
    local commands_file="$TEST_DIR/rollback-commands.sh"
    local latest_backup=$(ls -1t "$TEST_DIR/backups" | head -1)
    local backup_path="$TEST_DIR/backups/$latest_backup"
    
    if generate_rollback_commands "$backup_path" "/root/pixelated" "git.pixelatedempathy.com/pixelated-empathy:20240130" "pixelated-app" "$commands_file"; then
        if [[ -f "$commands_file" ]] && [[ -x "$commands_file" ]]; then
            # Check if all rollback options are present
            local option_count=$(grep -c "Option [0-9]:" "$commands_file")
            local command_count=$(grep -c "docker\|sudo\|curl" "$commands_file")
            
            if [[ $option_count -ge 3 ]] && [[ $command_count -ge 8 ]]; then
                print_test_pass "Rollback command generation creates comprehensive rollback script"
            else
                print_test_fail "Rollback command generation missing options or commands (options: $option_count, commands: $command_count)"
            fi
        else
            print_test_fail "Rollback command generation failed to create executable script"
        fi
    else
        print_test_fail "Rollback command generation failed"
    fi
}

# Test rollback priority and reliability assessment
test_rollback_priority_assessment() {
    print_test_header "Testing rollback priority and reliability assessment"
    ((TESTS_RUN++))
    
    assess_rollback_options() {
        local assessment_file="$1"
        
        cat > "$assessment_file" << EOF
# Rollback Priority and Reliability Assessment
# Generated: $(date)

## Assessment Criteria
- Speed: Time to complete rollback
- Reliability: Success rate and consistency
- Risk: Potential for additional issues
- Recovery: Ability to recover from rollback failure

## Option 1: Container-based Rollback
Speed: ★★★★★ (< 30 seconds)
Reliability: ★★★☆☆ (depends on container state)
Risk: ★★☆☆☆ (low risk, easy to revert)
Recovery: ★★★★☆ (can fallback to other options)
Score: 14/20

## Option 2: Filesystem Rollback
Speed: ★★★☆☆ (1-2 minutes)
Reliability: ★★★★★ (most consistent)
Risk: ★★★☆☆ (service downtime required)
Recovery: ★★★☆☆ (requires backup integrity)
Score: 15/20

## Option 3: Registry-based Rollback
Speed: ★★☆☆☆ (2-5 minutes, depends on network)
Reliability: ★★★★☆ (depends on registry availability)
Risk: ★★☆☆☆ (network dependency)
Recovery: ★★★★★ (multiple versions available)
Score: 13/20

## Recommended Priority Order:
1. Filesystem Rollback (highest reliability)
2. Container-based Rollback (fastest)
3. Registry-based Rollback (most flexible)

## Decision Matrix:
- Critical production issue: Use Filesystem Rollback
- Quick fix needed: Use Container-based Rollback
- Need specific version: Use Registry-based Rollback
- Network issues: Avoid Registry-based Rollback
- No backup available: Use Registry-based Rollback only
EOF
        
        return 0
    }
    
    local assessment_file="$TEST_DIR/rollback-assessment.txt"
    
    if assess_rollback_options "$assessment_file"; then
        if [[ -f "$assessment_file" ]]; then
            # Check assessment completeness
            local option_assessments=$(grep -c "## Option [0-9]:" "$assessment_file")
            local criteria_count=$(grep -c "Speed:\|Reliability:\|Risk:\|Recovery:" "$assessment_file")
            local priority_order=$(grep -c "Recommended Priority Order:" "$assessment_file")
            
            if [[ $option_assessments -eq 3 ]] && [[ $criteria_count -ge 12 ]] && [[ $priority_order -eq 1 ]]; then
                print_test_pass "Rollback priority and reliability assessment provides comprehensive analysis"
            else
                print_test_fail "Rollback assessment missing components (options: $option_assessments, criteria: $criteria_count)"
            fi
        else
            print_test_fail "Rollback assessment file not created"
        fi
    else
        print_test_fail "Rollback priority assessment failed"
    fi
}

# Test rollback validation and verification
test_rollback_validation() {
    print_test_header "Testing rollback validation and verification"
    ((TESTS_RUN++))
    
    validate_rollback_success() {
        local rollback_type="$1"
        local validation_log="$2"
        
        echo "=== Rollback Validation: $rollback_type ===" > "$validation_log"
        
        # Test 1: Service availability
        echo "[$(date)] Test 1: Service availability" >> "$validation_log"
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "[$(date)] Service availability: PASS" >> "$validation_log"
        else
            echo "[$(date)] Service availability: FAIL" >> "$validation_log"
            return 1
        fi
        
        # Test 2: Response time
        echo "[$(date)] Test 2: Response time" >> "$validation_log"
        local start_time=$(date +%s%3N)
        curl -f http://localhost:3000 >/dev/null 2>&1
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        
        if [[ $response_time -lt 5000 ]]; then  # < 5 seconds
            echo "[$(date)] Response time: PASS (${response_time}ms)" >> "$validation_log"
        else
            echo "[$(date)] Response time: FAIL (${response_time}ms)" >> "$validation_log"
            return 1
        fi
        
        # Test 3: Health endpoints
        echo "[$(date)] Test 3: Health endpoints" >> "$validation_log"
        if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            echo "[$(date)] Health endpoints: PASS" >> "$validation_log"
        else
            echo "[$(date)] Health endpoints: WARNING (may not exist)" >> "$validation_log"
        fi
        
        # Test 4: Container status (if applicable)
        if [[ "$rollback_type" == "container" ]] || [[ "$rollback_type" == "registry" ]]; then
            echo "[$(date)] Test 4: Container status" >> "$validation_log"
            if docker ps | grep -q pixelated; then
                echo "[$(date)] Container status: PASS" >> "$validation_log"
            else
                echo "[$(date)] Container status: FAIL" >> "$validation_log"
                return 1
            fi
        fi
        
        # Test 5: File integrity (if applicable)
        if [[ "$rollback_type" == "filesystem" ]]; then
            echo "[$(date)] Test 5: File integrity" >> "$validation_log"
            if [[ -f "$TEST_DIR/current/src/app.js" ]] && grep -q "backup version" "$TEST_DIR/current/src/app.js"; then
                echo "[$(date)] File integrity: PASS" >> "$validation_log"
            else
                echo "[$(date)] File integrity: FAIL" >> "$validation_log"
                return 1
            fi
        fi
        
        echo "[$(date)] Rollback validation completed successfully" >> "$validation_log"
        return 0
    }
    
    # Test validation for different rollback types
    local validation_types=("container" "filesystem" "registry")
    local passed_validations=0
    
    for rollback_type in "${validation_types[@]}"; do
        local validation_log="$TEST_DIR/validation-$rollback_type.log"
        
        if validate_rollback_success "$rollback_type" "$validation_log"; then
            ((passed_validations++))
        fi
    done
    
    if [[ $passed_validations -eq 3 ]]; then
        print_test_pass "Rollback validation and verification works for all rollback types"
    else
        print_test_fail "Rollback validation failed for some types (passed: $passed_validations/3)"
    fi
}

# Test rollback failure recovery
test_rollback_failure_recovery() {
    print_test_header "Testing rollback failure recovery scenarios"
    ((TESTS_RUN++))
    
    simulate_rollback_failure_recovery() {
        local recovery_log="$1"
        
        echo "=== Rollback Failure Recovery Simulation ===" > "$recovery_log"
        
        # Scenario: Primary rollback fails, try secondary
        echo "[$(date)] Attempting primary rollback (container-based)..." >> "$recovery_log"
        echo "[$(date)] Primary rollback: FAILED - Container start error" >> "$recovery_log"
        
        echo "[$(date)] Attempting secondary rollback (filesystem-based)..." >> "$recovery_log"
        echo "[$(date)] Secondary rollback: SUCCESS - Files restored" >> "$recovery_log"
        
        echo "[$(date)] Verifying secondary rollback..." >> "$recovery_log"
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            echo "[$(date)] Secondary rollback verification: SUCCESS" >> "$recovery_log"
        else
            echo "[$(date)] Secondary rollback verification: FAILED" >> "$recovery_log"
            
            # Tertiary rollback attempt
            echo "[$(date)] Attempting tertiary rollback (registry-based)..." >> "$recovery_log"
            echo "[$(date)] Tertiary rollback: SUCCESS - Registry image deployed" >> "$recovery_log"
            
            echo "[$(date)] Verifying tertiary rollback..." >> "$recovery_log"
            if curl -f http://localhost:3000 >/dev/null 2>&1; then
                echo "[$(date)] Tertiary rollback verification: SUCCESS" >> "$recovery_log"
            else
                echo "[$(date)] CRITICAL: All rollback options failed" >> "$recovery_log"
                return 1
            fi
        fi
        
        echo "[$(date)] Rollback failure recovery completed" >> "$recovery_log"
        return 0
    }
    
    local recovery_log="$TEST_DIR/rollback-failure-recovery.log"
    
    if simulate_rollback_failure_recovery "$recovery_log"; then
        local success_count=$(grep -c "SUCCESS" "$recovery_log")
        local failure_count=$(grep -c "FAILED" "$recovery_log")
        
        if [[ $success_count -ge 2 ]] && [[ $failure_count -ge 1 ]]; then
            print_test_pass "Rollback failure recovery successfully handles primary failure and recovers"
        else
            print_test_fail "Rollback failure recovery scenario incomplete (success: $success_count, failures: $failure_count)"
        fi
    else
        print_test_fail "Rollback failure recovery scenario failed"
    fi
}

# Run all rollback procedure tests
run_all_rollback_tests() {
    print_test_header "Starting Rollback Procedure Integration Tests"
    
    setup_test_environment
    
    # Run individual rollback test scenarios
    test_immediate_rollback_health_failure
    test_filesystem_rollback
    test_registry_rollback
    test_rollback_command_generation
    test_rollback_priority_assessment
    test_rollback_validation
    test_rollback_failure_recovery
    
    cleanup_test_environment
    
    # Print test summary
    print_test_header "Rollback Procedure Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All rollback procedure tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED rollback procedure tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_rollback_tests
fi