#!/bin/bash

# Example deployment script using the deployment framework
# This demonstrates how to use the core utilities

set -euo pipefail

# Source the deployment framework
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deployment-framework.sh"

# Configuration
VPS_HOST="${1:-45.55.211.39}"
VPS_USER="${2:-root}"
VPS_PORT="${3:-22}"
SSH_KEY="${4:-~/.ssh/planet}"

# Show usage
show_usage() {
    echo "Usage: $0 [VPS_HOST] [VPS_USER] [VPS_PORT] [SSH_KEY]"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 208.117.84.253 root 22"
    echo "  $0 208.117.84.253 root 22 ~/.ssh/planet"
    echo ""
    echo "This script demonstrates the deployment framework"
    exit 1
}

# Main deployment function
main() {
    log_header "DEPLOYMENT FRAMEWORK EXAMPLE"
    
    # Initialize the deployment framework
    if ! initialize_deployment_framework "$VPS_HOST" "$VPS_USER" "$VPS_PORT" "$SSH_KEY"; then
        log_fatal "Failed to initialize deployment framework"
        exit 1
    fi
    
    # Example deployment stages
    set_deployment_stage "environment-setup"
    log_progress "Setting up environment on remote server"
    
    # Example remote command execution
    execute_remote_command "echo 'Hello from remote server: \$(hostname)'" "test remote connection"
    
    set_deployment_stage "validation"
    log_progress "Validating deployment environment"
    
    # Example context usage
    log_info "Current deployment context:"
    log_info "  Timestamp: $(get_context "timestamp")"
    log_info "  Commit: $(get_context "commit_hash")"
    log_info "  Container: $(get_context "container_tag")"
    
    set_deployment_stage "completion"
    log_success "Example deployment completed successfully"
    
    log_header "DEPLOYMENT COMPLETE"
    log_info "This was just an example - no actual deployment was performed"
    log_info "Log file: $(get_context "log_file")"
}

# Run main function
main "$@"