#!/bin/bash

# Pixelated Empathy Deployment Framework
# Core utilities for safe pipeline-style deployment with health checks and rollback capabilities

set -euo pipefail

# =============================================================================
# DEPLOYMENT CONTEXT MANAGEMENT
# =============================================================================

# Global deployment context
declare -A DEPLOYMENT_CONTEXT=(
    ["timestamp"]=""
    ["commit_hash"]=""
    ["node_version"]="24.7.0"
    ["pnpm_version"]="10.15.0"
    ["container_tag"]=""
    ["backup_path"]=""
    ["health_check_results"]=""
    ["registry_push_status"]=""
    ["deployment_stage"]=""
    ["start_time"]=""
    ["log_file"]=""
)

# Initialize deployment context
init_deployment_context() {
    local timestamp=$(date '+%Y-%m-%d-%H%M%S')
    local commit_hash
    
    # Safely get git commit hash
    if git rev-parse --git-dir >/dev/null 2>&1; then
        commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    else
        commit_hash="unknown"
    fi
    
    DEPLOYMENT_CONTEXT["timestamp"]="$timestamp"
    DEPLOYMENT_CONTEXT["commit_hash"]="$commit_hash"
    DEPLOYMENT_CONTEXT["container_tag"]="pixelated-empathy:${timestamp}-${commit_hash}"
    DEPLOYMENT_CONTEXT["backup_path"]="/root/pixelated-backup-${timestamp}"
    DEPLOYMENT_CONTEXT["deployment_stage"]="initialization"
    DEPLOYMENT_CONTEXT["start_time"]=$(date '+%s')
    DEPLOYMENT_CONTEXT["log_file"]="/tmp/deployment-${timestamp}.log"
    
    # Create log file
    touch "${DEPLOYMENT_CONTEXT["log_file"]}" || {
        log_error "Failed to create log file: ${DEPLOYMENT_CONTEXT["log_file"]}"
        return 1
    }
    
    log_info "Deployment context initialized"
    log_info "Timestamp: ${DEPLOYMENT_CONTEXT["timestamp"]}"
    log_info "Commit: ${DEPLOYMENT_CONTEXT["commit_hash"]}"
    log_info "Container tag: ${DEPLOYMENT_CONTEXT["container_tag"]}"
    log_info "Log file: ${DEPLOYMENT_CONTEXT["log_file"]}"
}

# Update deployment stage
set_deployment_stage() {
    local stage="$1"
    DEPLOYMENT_CONTEXT["deployment_stage"]="$stage"
    log_info "Deployment stage: $stage"
}

# Get deployment context value
get_context() {
    local key="$1"
    echo "${DEPLOYMENT_CONTEXT[$key]:-}"
}

# Set deployment context value
set_context() {
    local key="$1"
    local value="$2"
    DEPLOYMENT_CONTEXT["$key"]="$value"
}

# =============================================================================
# LOGGING SYSTEM WITH COLORED OUTPUT AND TIMESTAMPS
# =============================================================================

# Color definitions
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m' # No Color

# Log levels
readonly LOG_LEVEL_DEBUG=0
readonly LOG_LEVEL_INFO=1
readonly LOG_LEVEL_WARN=2
readonly LOG_LEVEL_ERROR=3
readonly LOG_LEVEL_FATAL=4

# Current log level (default: INFO)
LOG_LEVEL=${LOG_LEVEL:-$LOG_LEVEL_INFO}

# Get timestamp for logging
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Get elapsed time since deployment start
get_elapsed_time() {
    local start_time="${DEPLOYMENT_CONTEXT["start_time"]:-$(date '+%s')}"
    local current_time=$(date '+%s')
    local elapsed=$((current_time - start_time))
    printf "%02d:%02d:%02d" $((elapsed/3600)) $((elapsed%3600/60)) $((elapsed%60))
}

# Core logging function
_log() {
    local level="$1"
    local color="$2"
    local prefix="$3"
    local message="$4"
    local timestamp=$(get_timestamp)
    local elapsed=$(get_elapsed_time)
    local stage="${DEPLOYMENT_CONTEXT["deployment_stage"]:-"unknown"}"
    
    # Format: [TIMESTAMP] [ELAPSED] [STAGE] [LEVEL] MESSAGE
    local formatted_message="[${timestamp}] [${elapsed}] [${stage}] ${prefix} ${message}"
    
    # Output to console with color
    echo -e "${color}${formatted_message}${NC}" >&2
    
    # Output to log file without color (if log file exists)
    local log_file="${DEPLOYMENT_CONTEXT["log_file"]:-}"
    if [[ -n "$log_file" && -f "$log_file" ]]; then
        echo "$formatted_message" >> "$log_file"
    fi
}

# Logging functions
log_debug() {
    if [[ $LOG_LEVEL -le $LOG_LEVEL_DEBUG ]]; then
        _log $LOG_LEVEL_DEBUG "$CYAN" "[DEBUG]" "$1"
    fi
    return 0
}

log_info() {
    if [[ $LOG_LEVEL -le $LOG_LEVEL_INFO ]]; then
        _log $LOG_LEVEL_INFO "$GREEN" "[INFO]" "$1"
    fi
    return 0
}

log_warn() {
    if [[ $LOG_LEVEL -le $LOG_LEVEL_WARN ]]; then
        _log $LOG_LEVEL_WARN "$YELLOW" "[WARN]" "$1"
    fi
    return 0
}

log_error() {
    if [[ $LOG_LEVEL -le $LOG_LEVEL_ERROR ]]; then
        _log $LOG_LEVEL_ERROR "$RED" "[ERROR]" "$1"
    fi
    return 0
}

log_fatal() {
    if [[ $LOG_LEVEL -le $LOG_LEVEL_FATAL ]]; then
        _log $LOG_LEVEL_FATAL "$RED" "[FATAL]" "$1"
    fi
    return 0
}

# Special logging functions for deployment stages
log_header() {
    local message="$1"
    local separator=$(printf '=%.0s' {1..80})
    _log $LOG_LEVEL_INFO "$BLUE" "[STEP]" "$separator"
    _log $LOG_LEVEL_INFO "$BLUE" "[STEP]" "🚀 $message"
    _log $LOG_LEVEL_INFO "$BLUE" "[STEP]" "$separator"
}

log_success() {
    _log $LOG_LEVEL_INFO "$GREEN" "[SUCCESS]" "✅ $1"
}

log_failure() {
    _log $LOG_LEVEL_ERROR "$RED" "[FAILURE]" "❌ $1"
}

log_progress() {
    _log $LOG_LEVEL_INFO "$PURPLE" "[PROGRESS]" "⏳ $1"
}

# =============================================================================
# SSH COMMAND BUILDER WITH PROPER KEY AND PORT HANDLING
# =============================================================================

# SSH configuration
declare -A SSH_CONFIG=(
    ["host"]=""
    ["user"]=""
    ["port"]="22"
    ["key"]=""
    ["strict_host_checking"]="no"
    ["connect_timeout"]="30"
    ["server_alive_interval"]="60"
    ["server_alive_count_max"]="3"
)

# Initialize SSH configuration
init_ssh_config() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key="${4:-}"
    
    SSH_CONFIG["host"]="$host"
    SSH_CONFIG["user"]="$user"
    SSH_CONFIG["port"]="$port"
    SSH_CONFIG["key"]="$key"
    
    log_info "SSH configuration initialized"
    log_info "Target: ${user}@${host}:${port}"
    log_info "Key: ${key:-"default"}"
}

# Build SSH command with all options
build_ssh_command() {
    local interactive="${1:-false}"
    local ssh_cmd="ssh"
    
    # Add interactive flag if requested
    if [[ "$interactive" == "true" ]]; then
        ssh_cmd="$ssh_cmd -t"
    fi
    
    # Add SSH key if specified
    if [[ -n "${SSH_CONFIG["key"]}" ]]; then
        ssh_cmd="$ssh_cmd -i ${SSH_CONFIG["key"]}"
    fi
    
    # Add port
    ssh_cmd="$ssh_cmd -p ${SSH_CONFIG["port"]}"
    
    # Add connection options
    ssh_cmd="$ssh_cmd -o StrictHostKeyChecking=${SSH_CONFIG["strict_host_checking"]}"
    ssh_cmd="$ssh_cmd -o ConnectTimeout=${SSH_CONFIG["connect_timeout"]}"
    ssh_cmd="$ssh_cmd -o ServerAliveInterval=${SSH_CONFIG["server_alive_interval"]}"
    ssh_cmd="$ssh_cmd -o ServerAliveCountMax=${SSH_CONFIG["server_alive_count_max"]}"
    
    # Add compression for better performance
    ssh_cmd="$ssh_cmd -o Compression=yes"
    
    # Add host
    ssh_cmd="$ssh_cmd ${SSH_CONFIG["user"]}@${SSH_CONFIG["host"]}"
    
    echo "$ssh_cmd"
}

# Build rsync SSH options
build_rsync_ssh_options() {
    local ssh_opts="ssh"
    
    # Add SSH key if specified
    if [[ -n "${SSH_CONFIG["key"]}" ]]; then
        ssh_opts="$ssh_opts -i ${SSH_CONFIG["key"]}"
    fi
    
    # Add port
    ssh_opts="$ssh_opts -p ${SSH_CONFIG["port"]}"
    
    # Add connection options
    ssh_opts="$ssh_opts -o StrictHostKeyChecking=${SSH_CONFIG["strict_host_checking"]}"
    ssh_opts="$ssh_opts -o ConnectTimeout=${SSH_CONFIG["connect_timeout"]}"
    ssh_opts="$ssh_opts -o Compression=yes"
    
    echo "-e '$ssh_opts'"
}

# Test SSH connectivity
test_ssh_connection() {
    log_progress "Testing SSH connection to ${SSH_CONFIG["user"]}@${SSH_CONFIG["host"]}:${SSH_CONFIG["port"]}"
    
    local ssh_cmd=$(build_ssh_command false)
    local test_command="echo 'SSH connection test successful - $(date)'"
    
    if timeout 30 $ssh_cmd "$test_command" 2>/dev/null; then
        log_success "SSH connection established successfully"
        return 0
    else
        log_failure "SSH connection failed"
        log_error "Unable to connect to ${SSH_CONFIG["user"]}@${SSH_CONFIG["host"]}:${SSH_CONFIG["port"]}"
        log_error "Please verify:"
        log_error "  - Host is reachable"
        log_error "  - SSH service is running"
        log_error "  - Port ${SSH_CONFIG["port"]} is open"
        log_error "  - SSH key is correct: ${SSH_CONFIG["key"]:-"default"}"
        log_error "  - User ${SSH_CONFIG["user"]} exists and has SSH access"
        return 1
    fi
}

# Execute remote command with proper error handling
execute_remote_command() {
    local command="$1"
    local description="${2:-"remote command"}"
    local timeout="${3:-300}" # 5 minutes default
    
    log_progress "Executing: $description"
    log_debug "Remote command: $command"
    
    local ssh_cmd=$(build_ssh_command true)
    
    if timeout "$timeout" $ssh_cmd "$command"; then
        log_success "$description completed"
        return 0
    else
        local exit_code=$?
        log_failure "$description failed (exit code: $exit_code)"
        return $exit_code
    fi
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate required tools
validate_required_tools() {
    local tools=("ssh" "rsync" "git" "docker")
    local missing_tools=()
    
    log_progress "Validating required tools"
    
    for tool in "${tools[@]}"; do
        if command_exists "$tool"; then
            log_debug "$tool: available"
        else
            missing_tools+=("$tool")
            log_error "$tool: not found"
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_failure "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again"
        return 1
    fi
    
    log_success "All required tools are available"
    return 0
}

# Generate deployment summary
generate_deployment_summary() {
    local status="$1"
    local end_time=$(date '+%s')
    local start_time="${DEPLOYMENT_CONTEXT["start_time"]}"
    local duration=$((end_time - start_time))
    local formatted_duration=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    log_header "DEPLOYMENT SUMMARY"
    log_info "Status: $status"
    log_info "Timestamp: ${DEPLOYMENT_CONTEXT["timestamp"]}"
    log_info "Commit: ${DEPLOYMENT_CONTEXT["commit_hash"]}"
    log_info "Container: ${DEPLOYMENT_CONTEXT["container_tag"]}"
    log_info "Duration: $formatted_duration"
    log_info "Log file: ${DEPLOYMENT_CONTEXT["log_file"]}"
    
    if [[ "$status" == "SUCCESS" ]]; then
        log_success "Deployment completed successfully!"
    else
        log_failure "Deployment failed!"
    fi
}

# Cleanup function for graceful shutdown
cleanup_deployment() {
    local exit_code=${1:-0}
    
    if [[ $exit_code -eq 0 ]]; then
        generate_deployment_summary "SUCCESS"
    else
        generate_deployment_summary "FAILED"
        log_error "Deployment failed with exit code: $exit_code"
    fi
    
    # Archive log file if deployment context exists
    local log_file="${DEPLOYMENT_CONTEXT["log_file"]:-}"
    if [[ -n "$log_file" && -f "$log_file" ]]; then
        local archive_dir="/tmp/deployment-logs"
        mkdir -p "$archive_dir"
        cp "$log_file" "$archive_dir/"
        log_info "Log archived to: $archive_dir/$(basename "$log_file")"
    fi
}

# Set up signal handlers for graceful shutdown (only if not in test mode)
if [[ "${DEPLOYMENT_TEST_MODE:-false}" != "true" ]]; then
    trap 'cleanup_deployment $?' EXIT
    trap 'log_warn "Deployment interrupted by user"; exit 130' INT TERM
fi

# =============================================================================
# FRAMEWORK INITIALIZATION
# =============================================================================

# Initialize the deployment framework
initialize_deployment_framework() {
    local host="$1"
    local user="$2"
    local port="${3:-22}"
    local key="${4:-}"
    
    log_header "INITIALIZING DEPLOYMENT FRAMEWORK"
    
    # Validate tools
    if ! validate_required_tools; then
        return 1
    fi
    
    # Initialize deployment context
    init_deployment_context
    
    # Initialize SSH configuration
    init_ssh_config "$host" "$user" "$port" "$key"
    
    # Test SSH connection
    if ! test_ssh_connection; then
        return 1
    fi
    
    log_success "Deployment framework initialized successfully"
    return 0
}

# Export functions for use in other scripts
export -f log_debug log_info log_warn log_error log_fatal
export -f log_header log_success log_failure log_progress
export -f get_context set_context set_deployment_stage
export -f build_ssh_command build_rsync_ssh_options execute_remote_command
export -f initialize_deployment_framework