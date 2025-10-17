#!/bin/bash
# Git Fetch Retry Wrapper Script
# Handles network failures and git fetch issues in Kubernetes environments

set -euo pipefail

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5
TIMEOUT=600
LOG_PREFIX="🔄 Git Fetch Retry"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${LOG_PREFIX} $1"
}

# Error logging
error_log() {
    echo -e "${RED}${LOG_PREFIX} ERROR: $1${NC}" >&2
}

# Success logging
success_log() {
    echo -e "${GREEN}${LOG_PREFIX} SUCCESS: $1${NC}"
}

# Warning logging
warning_log() {
    echo -e "${YELLOW}${LOG_PREFIX} WARNING: $1${NC}"
}

# Configure git for optimal performance in Kubernetes
configure_git() {
    log "Configuring git for Kubernetes environment..."
    
    # Network optimization
    git config --global http.postBuffer 524288000
    git config --global http.maxRequestBuffer 100M
    git config --global core.compression 0
    git config --global http.version HTTP/1.1
    git config --global http.lowSpeedLimit 1000
    git config --global http.lowSpeedTime 60
    git config --global http.timeout $TIMEOUT
    
    # Memory optimization
    git config --global pack.windowMemory 256m
    git config --global pack.packSizeLimit 256m
    git config --global pack.threads 1
    
    # Retry configuration
    git config --global http.retry $MAX_RETRIES
    git config --global http.postBuffer 524288000
    
    # LFS optimization
    git config --global lfs.skipSmudge 1
    
    success_log "Git configuration optimized for Kubernetes"
}

# Check network connectivity
check_network() {
    log "Checking network connectivity..."
    
    # Test connectivity to common git hosts
    local hosts=("github.com" "gitlab.com" "bitbucket.org")
    local reachable=false
    
    for host in "${hosts[@]}"; do
        if timeout 10 bash -c "cat < /dev/null > /dev/tcp/$host/443" 2>/dev/null; then
            success_log "Network connectivity to $host: OK"
            reachable=true
            break
        else
            warning_log "Network connectivity to $host: FAILED"
        fi
    done
    
    if [ "$reachable" = false ]; then
        error_log "No network connectivity to git hosts"
        return 1
    fi
    
    return 0
}

# Retry wrapper for git operations
git_retry() {
    local cmd="$1"
    local attempt=1
    local max_attempts=$MAX_RETRIES
    
    log "Executing: $cmd"
    
    while [ $attempt -le $max_attempts ]; do
        log "Attempt $attempt of $max_attempts..."
        
        if eval "$cmd"; then
            success_log "Command succeeded on attempt $attempt"
            return 0
        else
            local exit_code=$?
            error_log "Command failed with exit code $exit_code on attempt $attempt"
            
            if [ $attempt -lt $max_attempts ]; then
                local delay=$((RETRY_DELAY * attempt))
                warning_log "Retrying in $delay seconds..."
                sleep $delay
                
                # Clean up any partial state
                log "Cleaning up partial state..."
                git gc --auto || true
                git clean -fd || true
            else
                error_log "All attempts failed"
                return $exit_code
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Main execution
main() {
    log "Starting git fetch retry wrapper..."
    
    # Configure git
    configure_git
    
    # Check network connectivity
    if ! check_network; then
        error_log "Network connectivity check failed"
        exit 1
    fi
    
    # Execute the provided command with retry logic
    if [ $# -eq 0 ]; then
        error_log "No command provided"
        exit 1
    fi
    
    git_retry "$*"
}

# Run main function with all arguments
main "$@"