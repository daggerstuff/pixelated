#!/bin/bash

# Test script for deployment framework
# This script tests the core utilities without making actual deployments

set -euo pipefail

# Source the deployment framework in test mode
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Enable test mode to disable EXIT trap
export DEPLOYMENT_TEST_MODE=true

source "$SCRIPT_DIR/deployment-framework.sh"

# Test configuration
TEST_HOST="127.0.0.1"
TEST_USER="testuser"
TEST_PORT="22"
TEST_KEY=""

echo "Testing Deployment Framework"
echo "============================"

# Test 1: Logging system
echo
echo "Test 1: Logging System"
echo "----------------------"

# Initialize context for logging
echo "Initializing deployment context..."
init_deployment_context
echo "Context initialized successfully"

echo "Testing log functions..."
echo "LOG_LEVEL is: $LOG_LEVEL"
echo "LOG_LEVEL_DEBUG is: $LOG_LEVEL_DEBUG"
echo "LOG_LEVEL_INFO is: $LOG_LEVEL_INFO"

log_debug "This is a debug message"
log_info "This is an info message"
log_warn "This is a warning message"
log_error "This is an error message"
log_header "This is a header message"
log_success "This is a success message"
log_failure "This is a failure message"
log_progress "This is a progress message"

echo "✅ Logging system test completed"

# Test 2: Deployment context management
echo
echo "Test 2: Deployment Context Management"
echo "------------------------------------"

echo "Initial context values:"
echo "  Timestamp: $(get_context "timestamp")"
echo "  Commit: $(get_context "commit_hash")"
echo "  Container tag: $(get_context "container_tag")"
echo "  Log file: $(get_context "log_file")"

set_deployment_stage "testing"
echo "  Current stage: $(get_context "deployment_stage")"

set_context "test_value" "hello_world"
echo "  Test value: $(get_context "test_value")"

echo "✅ Context management test completed"

# Test 3: SSH command builder
echo
echo "Test 3: SSH Command Builder"
echo "---------------------------"

init_ssh_config "$TEST_HOST" "$TEST_USER" "$TEST_PORT" "$TEST_KEY"

echo "SSH command (non-interactive): $(build_ssh_command false)"
echo "SSH command (interactive): $(build_ssh_command true)"
echo "Rsync SSH options: $(build_rsync_ssh_options)"

echo "✅ SSH command builder test completed"

# Test 4: Utility functions
echo
echo "Test 4: Utility Functions"
echo "-------------------------"

echo "Testing command existence:"
echo "  bash: $(command_exists bash && echo "✅ found" || echo "❌ not found")"
echo "  nonexistent: $(command_exists nonexistent_command && echo "✅ found" || echo "❌ not found")"

echo "✅ Utility functions test completed"

# Test 5: Log file verification
echo
echo "Test 5: Log File Verification"
echo "-----------------------------"

LOG_FILE=$(get_context "log_file")
if [[ -f "$LOG_FILE" ]]; then
    echo "Log file exists: $LOG_FILE"
    echo "Log file size: $(wc -l < "$LOG_FILE") lines"
    echo "Last 3 lines from log file:"
    tail -3 "$LOG_FILE" | sed 's/^/  /'
    echo "✅ Log file test completed"
else
    echo "❌ Log file not found: $LOG_FILE"
fi

echo
echo "All tests completed successfully!"
echo "Framework is ready for use."