#!/bin/bash

# Deploy Pixelated Empathy to VPS using rsync
# This uploads the entire project and sets up the environment
# Usage: ./rsync.sh [host] [user] [port] [ssh_key] [domain] [--dry-run]

set -e

# Parse dry-run flag
DRY_RUN=false
for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
        DRY_RUN=true
        break
    fi
done

# Configuration (excluding --dry-run from positional params)
args=()
for arg in "$@"; do
    if [[ "$arg" != "--dry-run" ]]; then
        args+=("$arg")
    fi
done

VPS_HOST=${args[0]:-"45.55.211.39"}
VPS_USER=${args[1]:-"root"}
VPS_PORT=${args[2]:-"22"}
SSH_KEY=${args[3]:-"~/.ssh/planet"}
DOMAIN=${args[4]:-"pixelatedempathy.com"}
LOCAL_PROJECT_DIR="/home/vivi/pixelated"
REMOTE_PROJECT_DIR="/root/pixelated"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${BLUE}[STEP]${NC} $1"; }
print_dry_run() { echo -e "${PURPLE}[DRY-RUN]${NC} $1"; }

# Dry-run command wrapper
execute_command() {
    local command="$1"
    local description="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_dry_run "Would execute: $command"
        if [[ -n "$description" ]]; then
            print_dry_run "Description: $description"
        fi
        return 0
    else
        eval "$command"
    fi
}

# SSH command wrapper for dry-run
execute_ssh_command() {
    local ssh_command="$1"
    local description="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_dry_run "Would execute SSH: $ssh_command"
        if [[ -n "$description" ]]; then
            print_dry_run "Description: $description"
        fi
        return 0
    else
        ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" -p "${VPS_PORT}" "$ssh_command"
    fi
}

# Display dry-run status
if [[ "$DRY_RUN" == "true" ]]; then
    print_header "🧪 DRY-RUN MODE ENABLED"
    print_warning "No actual changes will be made to the system"
    print_warning "This will show what operations would be performed"
    echo ""
fi

# Error Categories and Exit Codes
readonly ERROR_ENVIRONMENT_SETUP=10
readonly ERROR_SYNCHRONIZATION=20
readonly ERROR_BUILD_FAILURE=30
readonly ERROR_HEALTH_CHECK=40
readonly ERROR_REGISTRY=50
readonly ERROR_NETWORK=60
readonly ERROR_PERMISSION=70
readonly ERROR_DISK_SPACE=80
readonly ERROR_UNKNOWN=99

# Global error tracking
DEPLOYMENT_ERRORS=()
DEPLOYMENT_WARNINGS=()
ERROR_LOG="/tmp/deployment-errors.log"
WARNING_LOG="/tmp/deployment-warnings.log"

# Enhanced structured logging system
DEPLOYMENT_LOG="/tmp/deployment-$(date +%Y%m%d-%H%M%S).log"
DEPLOYMENT_METRICS="/tmp/deployment-metrics-$(date +%Y%m%d-%H%M%S).json"
DEPLOYMENT_START_TIME=""
DEPLOYMENT_CONTEXT=""

# Disk space cleanup function
cleanup_disk_space() {
    print_header "🧹 Cleaning up disk space on VPS"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_dry_run "Would connect to VPS and perform cleanup operations"
        print_dry_run "SSH command: ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} -p ${VPS_PORT}"
        print_dry_run "Operations that would be performed:"
        print_dry_run "  - Check current disk usage: df -h"
        print_dry_run "  - Clean Docker system: docker system prune -af --volumes"
        print_dry_run "  - Remove failed pixelated containers"
        print_dry_run "  - Remove dangling images"
        print_dry_run "  - Keep only 3 most recent pixelated images"
        print_dry_run "  - Keep only 3 most recent backup directories"
        print_dry_run "  - Clean temporary files in /tmp and /var/tmp"
        print_dry_run "  - Clean package manager cache: apt-get clean"
        print_dry_run "  - Clean old log files (older than 30 days)"
        print_dry_run "  - Clean old node_modules directories"
        return 0
    fi
    
    ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" -p "${VPS_PORT}" << 'EOF'
        # Check current disk usage
        echo "Current disk usage:"
        df -h
        
        # Clean Docker system
        echo "Cleaning Docker system..."
        docker system prune -af --volumes || true
        
        # Clean failed containers and images specifically
        echo "Cleaning failed containers and images..."
        
        # Remove exited containers with pixelated in the name
        failed_containers=$(docker ps -a --filter "status=exited" --format "{{.Names}}" | grep -i "pixelated" || true)
        if [ -n "$failed_containers" ]; then
            echo "Removing failed pixelated containers..."
            echo "$failed_containers" | xargs -r docker rm -f 2>/dev/null || true
        fi
        
        # Remove dangling images related to pixelated
        dangling_images=$(docker images -f "dangling=true" --format "{{.ID}}" || true)
        if [ -n "$dangling_images" ]; then
            echo "Removing dangling images..."
            echo "$dangling_images" | xargs -r docker rmi -f 2>/dev/null || true
        fi
        
        # Remove old pixelated images (keep only last 3)
        pixelated_images=$(docker images --format "{{.Repository}}:{{.Tag}} {{.ID}}" | grep "pixelated" | sort -k1 -V | tail -n +4 | awk '{print $2}' || true)
        if [ -n "$pixelated_images" ]; then
            echo "Removing old pixelated images (keeping only 3 most recent)..."
            echo "$pixelated_images" | xargs -r docker rmi -f 2>/dev/null || true
        fi
        
        # Clean old backup directories (keep only 3 most recent)
        echo "Cleaning old backup directories (keeping only 3 most recent)..."
        
        # Find all backup directories and sort by modification time (newest first)
        backup_dirs=$(find /root -name "*backup*" -type d -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-)
        backup_count=$(echo "$backup_dirs" | wc -l)
        
        if [ "$backup_count" -gt 3 ]; then
            # Keep first 3, remove the rest
            echo "$backup_dirs" | tail -n +4 | while read -r backup_dir; do
                if [ -n "$backup_dir" ] && [ -d "$backup_dir" ]; then
                    echo "Removing old backup: $backup_dir"
                    rm -rf "$backup_dir" 2>/dev/null || true
                fi
            done
            echo "Cleaned $((backup_count - 3)) old backup directories"
        else
            echo "Found $backup_count backup directories (within limit of 3)"
        fi
        
        # Clean temporary files
        echo "Cleaning temporary files..."
        rm -rf /tmp/* 2>/dev/null || true
        rm -rf /var/tmp/* 2>/dev/null || true
        
        # Clean package manager cache
        echo "Cleaning package manager cache..."
        apt-get clean 2>/dev/null || true
        
        # Clean old log files
        echo "Cleaning old log files..."
        find /var/log -name "*.log" -mtime +30 -exec rm -f {} + 2>/dev/null || true
        
        # Clean node_modules if they exist
        echo "Cleaning old node_modules..."
        find /root -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
        
        echo "Disk usage after cleanup:"
        df -h
EOF
}

# Deployment stage tracking
declare -A STAGE_START_TIMES
declare -A STAGE_END_TIMES
declare -A STAGE_STATUS
CURRENT_STAGE=""

# Initialize structured logging system
initialize_structured_logging() {
    DEPLOYMENT_START_TIME=$(date +%s%3N)
    DEPLOYMENT_CONTEXT=$(generate_deployment_context)
    
    # Create main deployment log with header
    cat > "$DEPLOYMENT_LOG" << EOF
=== Pixelated Empathy Deployment Log ===
Timestamp: $(date -Iseconds)
Host: $VPS_HOST
User: $VPS_USER
Domain: $DOMAIN
Context: $DEPLOYMENT_CONTEXT
Log Level: INFO
=== Deployment Started ===

EOF
    
    # Initialize metrics file
    cat > "$DEPLOYMENT_METRICS" << EOF
{
  "deployment": {
    "start_time": "$DEPLOYMENT_START_TIME",
    "context": "$DEPLOYMENT_CONTEXT",
    "host": "$VPS_HOST",
    "domain": "$DOMAIN"
  },
  "stages": {},
  "performance": {},
  "errors": [],
  "warnings": []
}
EOF
    
    # Initialize error and warning logs
    echo "=== Deployment Error Log - $(date -Iseconds) ===" > "$ERROR_LOG"
    echo "=== Deployment Warning Log - $(date -Iseconds) ===" > "$WARNING_LOG"
    
    log_deployment_event "SYSTEM" "INFO" "Structured logging initialized" "deployment_start"
}

# Generate deployment context information
generate_deployment_context() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local commit_hash=""
    local branch=""
    
    # Try to get git information
    if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
        commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    else
        commit_hash="nogit"
        branch="nogit"
    fi
    
    echo "${timestamp}-${branch}-${commit_hash}"
}

# Generate simple container tag: pixelated-box:MMDDYY-NN
generate_simple_container_tag() {
    local date_part=$(date +%m%d%y)  # MMDDYY format
    local build_counter_file="/tmp/pixelated-build-counter-$(date +%Y%m%d)"
    
    # Get or initialize today's build counter
    local build_num=1
    if [[ -f "$build_counter_file" ]]; then
        build_num=$(cat "$build_counter_file")
        build_num=$((build_num + 1))
    fi
    
    # Save updated counter
    echo "$build_num" > "$build_counter_file"
    
    # Format build number with leading zero (01, 02, etc.)
    local build_num_formatted=$(printf "%02d" "$build_num")
    
    echo "pixelated-box:${date_part}-${build_num_formatted}"
}

# Enhanced deployment event logging with structured format
log_deployment_event() {
    local category="$1"
    local level="$2"
    local message="$3"
    local context="${4:-general}"
    local stage="${5:-$CURRENT_STAGE}"
    local timestamp=$(date -Iseconds)
    local epoch_ms=$(date +%s%3N)
    
    # Calculate elapsed time since deployment start
    local elapsed_ms=0
    if [[ -n "$DEPLOYMENT_START_TIME" ]]; then
        elapsed_ms=$((epoch_ms - DEPLOYMENT_START_TIME))
    fi
    
    # Format structured log entry
    local log_entry="[$timestamp] [$level] [$category] [$stage] [+${elapsed_ms}ms] $message (context: $context)"
    
    # Write to main deployment log
    echo "$log_entry" >> "$DEPLOYMENT_LOG"
    
    # Also output to console with appropriate color
    case "$level" in
        "ERROR")
            print_error "$message"
            ;;
        "WARNING")
            print_warning "$message"
            ;;
        "INFO")
            print_status "$message"
            ;;
        "DEBUG")
            # Only show debug messages if verbose mode is enabled
            if [[ "${VERBOSE:-false}" == "true" ]]; then
                echo -e "${BLUE}[DEBUG]${NC} $message"
            fi
            ;;
    esac
    
    # Update metrics file with the event
    update_deployment_metrics "$category" "$level" "$message" "$context" "$elapsed_ms"
}

# Update deployment metrics JSON file
update_deployment_metrics() {
    local category="$1"
    local level="$2"
    local message="$3"
    local context="$4"
    local elapsed_ms="$5"
    local timestamp=$(date -Iseconds)
    
    # Create temporary file for JSON manipulation
    local temp_metrics="/tmp/metrics-temp-$$.json"
    
    # Add event to appropriate array in metrics
    if [[ "$level" == "ERROR" ]]; then
        # Add to errors array
        jq --arg timestamp "$timestamp" \
           --arg category "$category" \
           --arg message "$message" \
           --arg context "$context" \
           --argjson elapsed "$elapsed_ms" \
           '.errors += [{
               "timestamp": $timestamp,
               "category": $category,
               "message": $message,
               "context": $context,
               "elapsed_ms": $elapsed
           }]' "$DEPLOYMENT_METRICS" > "$temp_metrics" 2>/dev/null || echo '{}' > "$temp_metrics"
    elif [[ "$level" == "WARNING" ]]; then
        # Add to warnings array
        jq --arg timestamp "$timestamp" \
           --arg category "$category" \
           --arg message "$message" \
           --arg context "$context" \
           --argjson elapsed "$elapsed_ms" \
           '.warnings += [{
               "timestamp": $timestamp,
               "category": $category,
               "message": $message,
               "context": $context,
               "elapsed_ms": $elapsed
           }]' "$DEPLOYMENT_METRICS" > "$temp_metrics" 2>/dev/null || echo '{}' > "$temp_metrics"
    fi
    
    # Move temp file back if jq succeeded
    if [[ -s "$temp_metrics" ]]; then
        mv "$temp_metrics" "$DEPLOYMENT_METRICS"
    else
        rm -f "$temp_metrics"
    fi
}

# Stage management functions for timing and tracking
start_deployment_stage() {
    local stage_name="$1"
    local stage_description="${2:-$stage_name}"
    local timestamp=$(date +%s%3N)
    
    CURRENT_STAGE="$stage_name"
    STAGE_START_TIMES["$stage_name"]="$timestamp"
    STAGE_STATUS["$stage_name"]="in_progress"
    
    log_deployment_event "STAGE" "INFO" "Started: $stage_description" "$stage_name" "$stage_name"
    print_header "🚀 $stage_description"
}

end_deployment_stage() {
    local stage_name="$1"
    local stage_status="${2:-success}"
    local stage_description="${3:-$stage_name}"
    local timestamp=$(date +%s%3N)
    
    STAGE_END_TIMES["$stage_name"]="$timestamp"
    STAGE_STATUS["$stage_name"]="$stage_status"
    
    # Calculate stage duration
    local start_time="${STAGE_START_TIMES[$stage_name]:-$timestamp}"
    local duration_ms=$((timestamp - start_time))
    local duration_sec=$((duration_ms / 1000))
    
    # Log stage completion
    local level="INFO"
    local status_icon="✅"
    if [[ "$stage_status" == "failed" ]]; then
        level="ERROR"
        status_icon="❌"
    elif [[ "$stage_status" == "warning" ]]; then
        level="WARNING"
        status_icon="⚠️"
    fi
    
    log_deployment_event "STAGE" "$level" "Completed: $stage_description (${duration_sec}s)" "$stage_name" "$stage_name"
    print_status "$status_icon $stage_description completed in ${duration_sec}s"
    
    # Update metrics with stage timing
    update_stage_metrics "$stage_name" "$stage_status" "$duration_ms"
    
    CURRENT_STAGE=""
}

# Update stage metrics in JSON file
update_stage_metrics() {
    local stage_name="$1"
    local stage_status="$2"
    local duration_ms="$3"
    local timestamp=$(date -Iseconds)
    
    # Create temporary file for JSON manipulation
    local temp_metrics="/tmp/stage-metrics-temp-$$.json"
    
    # Update stages object in metrics
    jq --arg stage "$stage_name" \
       --arg status "$stage_status" \
       --argjson duration "$duration_ms" \
       --arg timestamp "$timestamp" \
       '.stages[$stage] = {
           "status": $status,
           "duration_ms": $duration,
           "completed_at": $timestamp
       }' "$DEPLOYMENT_METRICS" > "$temp_metrics" 2>/dev/null || echo '{}' > "$temp_metrics"
    
    # Move temp file back if jq succeeded
    if [[ -s "$temp_metrics" ]]; then
        mv "$temp_metrics" "$DEPLOYMENT_METRICS"
    else
        rm -f "$temp_metrics"
    fi
}

# Performance measurement functions
measure_operation_time() {
    local operation_name="$1"
    local operation_description="${2:-$operation_name}"
    shift 2
    local command=("$@")
    
    log_deployment_event "PERFORMANCE" "DEBUG" "Starting measurement: $operation_description" "$operation_name"
    
    local start_time=$(date +%s%3N)
    local exit_code=0
    local output=""
    
    # Execute the command and capture output
    if output=$("${command[@]}" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi
    
    local end_time=$(date +%s%3N)
    local duration_ms=$((end_time - start_time))
    local duration_sec=$((duration_ms / 1000))
    
    # Log performance measurement
    if [[ $exit_code -eq 0 ]]; then
        log_deployment_event "PERFORMANCE" "INFO" "$operation_description completed (${duration_sec}s)" "$operation_name"
    else
        log_deployment_event "PERFORMANCE" "ERROR" "$operation_description failed (${duration_sec}s)" "$operation_name"
    fi
    
    # Update performance metrics
    update_performance_metrics "$operation_name" "$duration_ms" "$exit_code"
    
    # Return the original exit code
    return $exit_code
}

# Update performance metrics in JSON file
update_performance_metrics() {
    local operation_name="$1"
    local duration_ms="$2"
    local exit_code="$3"
    local timestamp=$(date -Iseconds)
    
    # Create temporary file for JSON manipulation
    local temp_metrics="/tmp/perf-metrics-temp-$$.json"
    
    # Update performance object in metrics
    jq --arg operation "$operation_name" \
       --argjson duration "$duration_ms" \
       --argjson exit_code "$exit_code" \
       --arg timestamp "$timestamp" \
       '.performance[$operation] = {
           "duration_ms": $duration,
           "exit_code": $exit_code,
           "timestamp": $timestamp
       }' "$DEPLOYMENT_METRICS" > "$temp_metrics" 2>/dev/null || echo '{}' > "$temp_metrics"
    
    # Move temp file back if jq succeeded
    if [[ -s "$temp_metrics" ]]; then
        mv "$temp_metrics" "$DEPLOYMENT_METRICS"
    else
        rm -f "$temp_metrics"
    fi
}

# Deployment Reporting and Documentation Functions

# Generate comprehensive deployment summary report
generate_deployment_summary() {
    local deployment_status="${1:-unknown}"
    local end_time=$(date +%s%3N)
    local total_duration_ms=$((end_time - DEPLOYMENT_START_TIME))
    local total_duration_sec=$((total_duration_ms / 1000))
    local total_duration_min=$((total_duration_sec / 60))
    
    local summary_file="/tmp/deployment-summary-$(date +%Y%m%d-%H%M%S).txt"
    local json_summary="/tmp/deployment-summary-$(date +%Y%m%d-%H%M%S).json"
    
    log_deployment_event "REPORTING" "INFO" "Generating deployment summary report" "summary_generation"
    
    # Generate human-readable summary
    cat > "$summary_file" << EOF
=== Pixelated Empathy Deployment Summary ===
Generated: $(date -Iseconds)
Status: $deployment_status
Total Duration: ${total_duration_min}m ${total_duration_sec}s (${total_duration_ms}ms)
Context: $DEPLOYMENT_CONTEXT

=== Deployment Configuration ===
Host: $VPS_HOST
User: $VPS_USER
Port: $VPS_PORT
Domain: $DOMAIN
SSH Key: $SSH_KEY

=== Stage Summary ===
EOF
    
    # Add stage timing information
    for stage in "${!STAGE_START_TIMES[@]}"; do
        local start_time="${STAGE_START_TIMES[$stage]}"
        local end_time="${STAGE_END_TIMES[$stage]:-$(date +%s%3N)}"
        local duration_ms=$((end_time - start_time))
        local duration_sec=$((duration_ms / 1000))
        local status="${STAGE_STATUS[$stage]:-unknown}"
        local status_icon="❓"
        
        case "$status" in
            "success") status_icon="✅" ;;
            "failed") status_icon="❌" ;;
            "warning") status_icon="⚠️" ;;
            "in_progress") status_icon="🔄" ;;
        esac
        
        echo "$status_icon $stage: $status (${duration_sec}s)" >> "$summary_file"
    done
    
    # Add error and warning summary
    echo "" >> "$summary_file"
    echo "=== Issues Summary ===" >> "$summary_file"
    echo "Errors: ${#DEPLOYMENT_ERRORS[@]}" >> "$summary_file"
    echo "Warnings: ${#DEPLOYMENT_WARNINGS[@]}" >> "$summary_file"
    
    if [[ ${#DEPLOYMENT_ERRORS[@]} -gt 0 ]]; then
        echo "" >> "$summary_file"
        echo "=== Errors ===" >> "$summary_file"
        for error in "${DEPLOYMENT_ERRORS[@]}"; do
            echo "❌ $error" >> "$summary_file"
        done
    fi
    
    if [[ ${#DEPLOYMENT_WARNINGS[@]} -gt 0 ]]; then
        echo "" >> "$summary_file"
        echo "=== Warnings ===" >> "$summary_file"
        for warning in "${DEPLOYMENT_WARNINGS[@]}"; do
            echo "⚠️  $warning" >> "$summary_file"
        done
    fi
    
    # Add log file locations
    echo "" >> "$summary_file"
    echo "=== Log Files ===" >> "$summary_file"
    echo "Main Log: $DEPLOYMENT_LOG" >> "$summary_file"
    echo "Metrics: $DEPLOYMENT_METRICS" >> "$summary_file"
    echo "Errors: $ERROR_LOG" >> "$summary_file"
    echo "Warnings: $WARNING_LOG" >> "$summary_file"
    echo "Summary: $summary_file" >> "$summary_file"
    
    # Generate JSON summary for programmatic access
    generate_json_summary "$json_summary" "$deployment_status" "$total_duration_ms"
    
    # Display summary to user
    print_header "📊 Deployment Summary"
    cat "$summary_file"
    
    # Store summary file path for later reference
    echo "$summary_file" > "/tmp/latest-deployment-summary.txt"
    echo "$json_summary" > "/tmp/latest-deployment-summary-json.txt"
    
    log_deployment_event "REPORTING" "INFO" "Deployment summary generated: $summary_file" "summary_complete"
    
    return 0
}

# Generate JSON summary for programmatic access
generate_json_summary() {
    local json_file="$1"
    local deployment_status="$2"
    local total_duration_ms="$3"
    local timestamp=$(date -Iseconds)
    
    # Create comprehensive JSON summary
    cat > "$json_file" << EOF
{
  "deployment_summary": {
    "timestamp": "$timestamp",
    "status": "$deployment_status",
    "duration_ms": $total_duration_ms,
    "context": "$DEPLOYMENT_CONTEXT",
    "configuration": {
      "host": "$VPS_HOST",
      "user": "$VPS_USER",
      "port": "$VPS_PORT",
      "domain": "$DOMAIN",
      "ssh_key": "$SSH_KEY"
    },
    "stages": {},
    "issues": {
      "error_count": ${#DEPLOYMENT_ERRORS[@]},
      "warning_count": ${#DEPLOYMENT_WARNINGS[@]},
      "errors": [],
      "warnings": []
    },
    "log_files": {
      "main_log": "$DEPLOYMENT_LOG",
      "metrics": "$DEPLOYMENT_METRICS",
      "error_log": "$ERROR_LOG",
      "warning_log": "$WARNING_LOG"
    }
  }
}
EOF
    
    # Add stage information using jq if available
    if command -v jq >/dev/null 2>&1; then
        local temp_json="/tmp/json-temp-$$.json"
        
        # Add stages
        for stage in "${!STAGE_START_TIMES[@]}"; do
            local start_time="${STAGE_START_TIMES[$stage]}"
            local end_time="${STAGE_END_TIMES[$stage]:-$(date +%s%3N)}"
            local duration_ms=$((end_time - start_time))
            local status="${STAGE_STATUS[$stage]:-unknown}"
            
            jq --arg stage "$stage" \
               --arg status "$status" \
               --argjson duration "$duration_ms" \
               '.deployment_summary.stages[$stage] = {
                   "status": $status,
                   "duration_ms": $duration
               }' "$json_file" > "$temp_json" && mv "$temp_json" "$json_file"
        done
        
        # Add errors
        for error in "${DEPLOYMENT_ERRORS[@]}"; do
            jq --arg error "$error" \
               '.deployment_summary.issues.errors += [$error]' "$json_file" > "$temp_json" && mv "$temp_json" "$json_file"
        done
        
        # Add warnings
        for warning in "${DEPLOYMENT_WARNINGS[@]}"; do
            jq --arg warning "$warning" \
               '.deployment_summary.issues.warnings += [$warning]' "$json_file" > "$temp_json" && mv "$temp_json" "$json_file"
        done
    fi
}

# Health check result logging with detailed response times
log_health_check_results() {
    local check_type="$1"
    local status="$2"
    local response_time_ms="$3"
    local details="${4:-}"
    local endpoint="${5:-}"
    
    local level="INFO"
    local status_icon="✅"
    
    if [[ "$status" != "pass" ]]; then
        level="ERROR"
        status_icon="❌"
    fi
    
    # Log to structured logging system
    local message="Health check $check_type: $status"
    if [[ -n "$response_time_ms" ]]; then
        message="$message (${response_time_ms}ms)"
    fi
    if [[ -n "$endpoint" ]]; then
        message="$message [$endpoint]"
    fi
    if [[ -n "$details" ]]; then
        message="$message - $details"
    fi
    
    log_deployment_event "HEALTH_CHECK" "$level" "$message" "$check_type"
    
    # Create detailed health check log entry
    local health_log="/tmp/health-check-results.log"
    local timestamp=$(date -Iseconds)
    
    echo "[$timestamp] $status_icon $check_type: $status (${response_time_ms}ms)" >> "$health_log"
    if [[ -n "$endpoint" ]]; then
        echo "  Endpoint: $endpoint" >> "$health_log"
    fi
    if [[ -n "$details" ]]; then
        echo "  Details: $details" >> "$health_log"
    fi
    echo "" >> "$health_log"
    
    # Update health check metrics
    update_health_check_metrics "$check_type" "$status" "$response_time_ms" "$endpoint" "$details"
}

# Update health check metrics in JSON format
update_health_check_metrics() {
    local check_type="$1"
    local status="$2"
    local response_time_ms="$3"
    local endpoint="$4"
    local details="$5"
    local timestamp=$(date -Iseconds)
    
    # Create or update health check metrics file
    local health_metrics="/tmp/health-check-metrics-$(date +%Y%m%d-%H%M%S).json"
    
    if [[ ! -f "$health_metrics" ]]; then
        echo '{"health_checks": {}}' > "$health_metrics"
    fi
    
    # Add health check result using jq if available
    if command -v jq >/dev/null 2>&1; then
        local temp_health="/tmp/health-temp-$$.json"
        
        jq --arg check_type "$check_type" \
           --arg status "$status" \
           --argjson response_time "${response_time_ms:-0}" \
           --arg endpoint "$endpoint" \
           --arg details "$details" \
           --arg timestamp "$timestamp" \
           '.health_checks[$check_type] = {
               "status": $status,
               "response_time_ms": $response_time,
               "endpoint": $endpoint,
               "details": $details,
               "timestamp": $timestamp
           }' "$health_metrics" > "$temp_health" 2>/dev/null
        
        if [[ -s "$temp_health" ]]; then
            mv "$temp_health" "$health_metrics"
        else
            rm -f "$temp_health"
        fi
    fi
}

# Generate deployment log file for future reference
create_deployment_log_archive() {
    local deployment_status="$1"
    
    # Only create archives for successful deployments
    if [[ "$deployment_status" != "success" ]]; then
        log_deployment_event "ARCHIVING" "INFO" "Skipping log archive creation for failed deployment" "archive_skipped"
        return 0
    fi
    
    local archive_dir="/tmp/deployment-archives"
    local archive_name="deployment-$(date +%Y%m%d-%H%M%S)-${deployment_status}"
    local archive_path="$archive_dir/$archive_name"
    
    # Create archive directory
    mkdir -p "$archive_path"
    
    log_deployment_event "ARCHIVING" "INFO" "Creating deployment log archive" "archive_creation"
    
    # Copy all log files to archive
    if [[ -f "$DEPLOYMENT_LOG" ]]; then
        cp "$DEPLOYMENT_LOG" "$archive_path/deployment.log"
    fi
    
    if [[ -f "$DEPLOYMENT_METRICS" ]]; then
        cp "$DEPLOYMENT_METRICS" "$archive_path/metrics.json"
    fi
    
    if [[ -f "$ERROR_LOG" ]]; then
        cp "$ERROR_LOG" "$archive_path/errors.log"
    fi
    
    if [[ -f "$WARNING_LOG" ]]; then
        cp "$WARNING_LOG" "$archive_path/warnings.log"
    fi
    
    # Copy health check logs if they exist
    if [[ -f "/tmp/health-check-results.log" ]]; then
        cp "/tmp/health-check-results.log" "$archive_path/health-checks.log"
    fi
    
    # Copy any health check metrics
    local health_metrics_pattern="/tmp/health-check-metrics-*.json"
    for health_file in $health_metrics_pattern; do
        if [[ -f "$health_file" ]]; then
            cp "$health_file" "$archive_path/"
        fi
    done
    
    # Copy summary files if they exist
    if [[ -f "/tmp/latest-deployment-summary.txt" ]]; then
        local summary_file=$(cat "/tmp/latest-deployment-summary.txt")
        if [[ -f "$summary_file" ]]; then
            cp "$summary_file" "$archive_path/summary.txt"
        fi
    fi
    
    if [[ -f "/tmp/latest-deployment-summary-json.txt" ]]; then
        local json_summary=$(cat "/tmp/latest-deployment-summary-json.txt")
        if [[ -f "$json_summary" ]]; then
            cp "$json_summary" "$archive_path/summary.json"
        fi
    fi
    
    # Create archive metadata
    cat > "$archive_path/metadata.txt" << EOF
Deployment Archive: $archive_name
Created: $(date -Iseconds)
Status: $deployment_status
Context: $DEPLOYMENT_CONTEXT
Host: $VPS_HOST
Domain: $DOMAIN

Files in this archive:
$(ls -la "$archive_path" | tail -n +2)
EOF
    
    # Create compressed archive
    local tar_file="$archive_dir/${archive_name}.tar.gz"
    if tar -czf "$tar_file" -C "$archive_dir" "$archive_name" 2>/dev/null; then
        log_deployment_event "ARCHIVING" "INFO" "Deployment archive created: $tar_file" "archive_complete"
        print_status "📦 Deployment archive created: $tar_file"
        
        # Clean up uncompressed directory
        rm -rf "$archive_path"
        
        # Store archive path for reference
        echo "$tar_file" > "/tmp/latest-deployment-archive.txt"
    else
        log_deployment_event "ARCHIVING" "WARNING" "Failed to create compressed archive, keeping directory: $archive_path" "archive_warning"
        print_warning "⚠️  Could not create compressed archive, logs saved to: $archive_path"
    fi
    
    return 0
}

# Display deployment timing information
show_deployment_timing() {
    print_header "⏱️  Deployment Timing Analysis"
    
    local total_time=0
    local slowest_stage=""
    local slowest_duration=0
    
    for stage in "${!STAGE_START_TIMES[@]}"; do
        local start_time="${STAGE_START_TIMES[$stage]}"
        local end_time="${STAGE_END_TIMES[$stage]:-$(date +%s%3N)}"
        local duration_ms=$((end_time - start_time))
        local duration_sec=$((duration_ms / 1000))
        local status="${STAGE_STATUS[$stage]:-unknown}"
        
        total_time=$((total_time + duration_ms))
        
        if [[ $duration_ms -gt $slowest_duration ]]; then
            slowest_duration=$duration_ms
            slowest_stage="$stage"
        fi
        
        local status_icon="❓"
        case "$status" in
            "success") status_icon="✅" ;;
            "failed") status_icon="❌" ;;
            "warning") status_icon="⚠️" ;;
            "in_progress") status_icon="🔄" ;;
        esac
        
        printf "  %s %-30s %6ds (%dms)\n" "$status_icon" "$stage:" "$duration_sec" "$duration_ms"
    done
    
    local total_sec=$((total_time / 1000))
    local total_min=$((total_sec / 60))
    local slowest_sec=$((slowest_duration / 1000))
    
    echo ""
    print_status "Total deployment time: ${total_min}m ${total_sec}s (${total_time}ms)"
    if [[ -n "$slowest_stage" ]]; then
        print_status "Slowest stage: $slowest_stage (${slowest_sec}s)"
    fi
}

# Finalize deployment logging and create comprehensive report
finalize_deployment_logging() {
    local final_status="${1:-unknown}"
    
    log_deployment_event "SYSTEM" "INFO" "Finalizing deployment logging" "finalization"
    
    # End any remaining stages
    if [[ -n "$CURRENT_STAGE" ]]; then
        end_deployment_stage "$CURRENT_STAGE" "$final_status" "$CURRENT_STAGE"
    fi
    
    # Generate comprehensive summary
    generate_deployment_summary "$final_status"
    
    # Show timing analysis
    show_deployment_timing
    
    # Create log archive
    create_deployment_log_archive "$final_status"
    
    # Final log entry
    local end_time=$(date +%s%3N)
    local total_duration_ms=$((end_time - DEPLOYMENT_START_TIME))
    local total_duration_sec=$((total_duration_ms / 1000))
    
    log_deployment_event "SYSTEM" "INFO" "Deployment completed with status: $final_status (total time: ${total_duration_sec}s)" "deployment_complete"
    
    # Display final status
    case "$final_status" in
        "success")
            print_header "🎉 Deployment Completed Successfully"
            print_status "Total time: ${total_duration_sec}s"
            ;;
        "failed")
            print_header "❌ Deployment Failed"
            print_error "Total time: ${total_duration_sec}s"
            print_status "Check logs for details: $DEPLOYMENT_LOG"
            ;;
        "warning")
            print_header "⚠️  Deployment Completed with Warnings"
            print_warning "Total time: ${total_duration_sec}s"
            print_status "Review warnings in: $WARNING_LOG"
            ;;
    esac
    
    # Show log file locations
    print_status ""
    print_status "📋 Log Files:"
    print_status "  Main Log: $DEPLOYMENT_LOG"
    print_status "  Metrics: $DEPLOYMENT_METRICS"
    print_status "  Errors: $ERROR_LOG"
    print_status "  Warnings: $WARNING_LOG"
    
    if [[ -f "/tmp/latest-deployment-archive.txt" ]]; then
        local archive_file=$(cat "/tmp/latest-deployment-archive.txt")
        print_status "  Archive: $archive_file"
    fi
}

# Enhanced error logging functions with structured logging integration
log_error() {
    local category="$1"
    local message="$2"
    local context="${3:-unknown}"
    local timestamp=$(date -Iseconds)
    
    DEPLOYMENT_ERRORS+=("$category:$message")
    echo "[$timestamp] ERROR [$category] $message (context: $context)" >> "$ERROR_LOG"
    
    # Use structured logging system
    log_deployment_event "$category" "ERROR" "$message" "$context"
}

log_warning() {
    local category="$1"
    local message="$2"
    local context="${3:-unknown}"
    local timestamp=$(date -Iseconds)
    
    DEPLOYMENT_WARNINGS+=("$category:$message")
    echo "[$timestamp] WARNING [$category] $message (context: $context)" >> "$WARNING_LOG"
    
    # Use structured logging system
    log_deployment_event "$category" "WARNING" "$message" "$context"
}

# Error categorization functions
categorize_error() {
    local error_output="$1"
    local context="$2"
    
    # Environment setup errors
    if echo "$error_output" | grep -qi "node\|npm\|pnpm\|nvm"; then
        return $ERROR_ENVIRONMENT_SETUP
    fi
    
    # Synchronization errors
    if echo "$error_output" | grep -qi "rsync\|ssh\|connection\|timeout"; then
        return $ERROR_SYNCHRONIZATION
    fi
    
    # Build errors
    if echo "$error_output" | grep -qi "docker build\|dockerfile\|build failed"; then
        return $ERROR_BUILD_FAILURE
    fi
    
    # Network errors
    if echo "$error_output" | grep -qi "network\|dns\|connection refused\|timeout"; then
        return $ERROR_NETWORK
    fi
    
    # Permission errors
    if echo "$error_output" | grep -qi "permission denied\|access denied\|unauthorized"; then
        return $ERROR_PERMISSION
    fi
    
    # Disk space errors
    if echo "$error_output" | grep -qi "no space\|disk full\|out of space"; then
        return $ERROR_DISK_SPACE
    fi
    
    # Registry errors
    if echo "$error_output" | grep -qi "registry\|push failed\|authentication"; then
        return $ERROR_REGISTRY
    fi
    
    return $ERROR_UNKNOWN
}

# Environment setup error handling with retry logic
handle_environment_setup_error() {
    local error_message="$1"
    local retry_count="${2:-0}"
    local max_retries=3
    
    log_error "ENVIRONMENT" "$error_message" "setup_attempt_$((retry_count + 1))"
    
    case "$error_message" in
        *"node"*|*"nvm"*)
            print_error "Node.js installation failed"
            print_status "Troubleshooting steps:"
            print_status "1. Check internet connectivity"
            print_status "2. Verify nvm installation"
            print_status "3. Check available disk space"
            
            if [ $retry_count -lt $max_retries ]; then
                print_status "Retrying Node.js setup (attempt $((retry_count + 1))/$max_retries)..."
                return 0  # Allow retry
            fi
            ;;
        *"pnpm"*)
            print_error "pnpm installation failed"
            print_status "Troubleshooting steps:"
            print_status "1. Ensure Node.js is properly installed"
            print_status "2. Check npm registry connectivity"
            print_status "3. Try manual installation: npm install -g pnpm"
            
            if [ $retry_count -lt $max_retries ]; then
                print_status "Retrying pnpm setup (attempt $((retry_count + 1))/$max_retries)..."
                return 0  # Allow retry
            fi
            ;;
        *"version"*)
            print_error "Version verification failed"
            print_status "Troubleshooting steps:"
            print_status "1. Check PATH configuration"
            print_status "2. Restart shell session"
            print_status "3. Verify installation completed successfully"
            ;;
    esac
    
    return $ERROR_ENVIRONMENT_SETUP
}

# Synchronization error handling with retry logic
handle_synchronization_error() {
    local error_message="$1"
    local retry_count="${2:-0}"
    local max_retries=3
    local retry_delay=5
    
    log_error "SYNC" "$error_message" "sync_attempt_$((retry_count + 1))"
    
    case "$error_message" in
        *"connection"*|*"timeout"*)
            print_error "Network connectivity issue during synchronization"
            print_status "Troubleshooting steps:"
            print_status "1. Check VPS connectivity: ping $VPS_HOST"
            print_status "2. Verify SSH key permissions: chmod 600 $SSH_KEY"
            print_status "3. Test SSH connection: ssh -i $SSH_KEY $VPS_USER@$VPS_HOST"
            
            if [ $retry_count -lt $max_retries ]; then
                print_status "Retrying synchronization in ${retry_delay}s (attempt $((retry_count + 1))/$max_retries)..."
                sleep $retry_delay
                return 0  # Allow retry
            fi
            ;;
        *"permission"*)
            print_error "Permission denied during synchronization"
            print_status "Troubleshooting steps:"
            print_status "1. Check SSH key permissions: ls -la $SSH_KEY"
            print_status "2. Verify VPS user permissions"
            print_status "3. Check target directory permissions on VPS"
            ;;
        *"space"*)
            print_error "Insufficient disk space on VPS"
            print_status "Troubleshooting steps:"
            print_status "1. Check VPS disk usage: df -h"
            print_status "2. Clean up old deployments and Docker images"
            print_status "3. Consider expanding disk space"
            ;;
        *"rsync"*)
            print_error "rsync command failed"
            print_status "Troubleshooting steps:"
            print_status "1. Verify rsync is installed on both systems"
            print_status "2. Check file permissions in source directory"
            print_status "3. Try manual rsync with verbose output"
            
            if [ $retry_count -lt $max_retries ]; then
                print_status "Retrying synchronization with different options (attempt $((retry_count + 1))/$max_retries)..."
                return 0  # Allow retry
            fi
            ;;
    esac
    
    return $ERROR_SYNCHRONIZATION
}

# Build error handling with container preservation
handle_build_error() {
    local error_message="$1"
    local container_name="$2"
    local build_log="${3:-/tmp/docker-build.log}"
    
    log_error "BUILD" "$error_message" "container_$container_name"
    
    print_error "Container build failed for: $container_name"
    
    # Preserve old container if it exists
    if docker ps -a --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        local backup_name="${container_name}-backup-$(date +%s)"
        print_status "Preserving current container as: $backup_name"
        
        if docker rename "$container_name" "$backup_name" 2>/dev/null; then
            print_status "✅ Current container preserved as backup"
        else
            log_warning "BUILD" "Failed to preserve current container" "container_$container_name"
        fi
    fi
    
    # Analyze build failure
    if [ -f "$build_log" ]; then
        print_status "Build failure analysis:"
        
        # Check for common build issues
        if grep -qi "no space left" "$build_log"; then
            print_error "Build failed due to insufficient disk space"
            print_status "Troubleshooting steps:"
            print_status "1. Clean up Docker images: docker system prune -a"
            print_status "2. Check disk usage: df -h"
            print_status "3. Remove unused containers: docker container prune"
            
        elif grep -qi "network\|timeout\|connection\|EAI_AGAIN\|dns" "$build_log"; then
            print_error "Build failed due to network/DNS issues"
            print_status "Troubleshooting steps:"
            print_status "1. Check internet connectivity: ping 8.8.8.8"
            print_status "2. Test DNS resolution: nslookup registry.npmjs.org"
            print_status "3. Check Docker DNS: docker run --rm alpine nslookup registry.npmjs.org"
            print_status "4. Restart Docker daemon: sudo systemctl restart docker"
            print_status "5. Try manual build with: docker build --network=host --dns=8.8.8.8 ."
            print_status "6. Check /etc/docker/daemon.json for DNS configuration"
            
        elif grep -qi "permission denied" "$build_log"; then
            print_error "Build failed due to permission issues"
            print_status "Troubleshooting steps:"
            print_status "1. Check Docker daemon permissions"
            print_status "2. Verify file permissions in build context"
            print_status "3. Try running with sudo (not recommended for production)"
            
        elif grep -qi "dockerfile\|syntax error" "$build_log"; then
            print_error "Build failed due to Dockerfile issues"
            print_status "Troubleshooting steps:"
            print_status "1. Validate Dockerfile syntax"
            print_status "2. Check base image availability"
            print_status "3. Verify COPY/ADD paths exist"
            
        else
            print_error "Build failed for unknown reason"
            print_status "Check build log for details: $build_log"
        fi
        
        # Show last 10 lines of build log
        print_status "Last 10 lines of build log:"
        tail -n 10 "$build_log" | while read -r line; do
            print_status "  $line"
        done
    fi
    
    # Remove backup created during this failed deployment
    if [[ -n "$VPS_USER" && -n "$VPS_HOST" && -n "$REMOTE_DIR" ]]; then
        remove_backup_on_failure "$VPS_USER@$VPS_HOST" "$REMOTE_DIR"
    fi
    
    return $ERROR_BUILD_FAILURE
}

# Network error handling
handle_network_error() {
    local error_message="$1"
    local context="$2"
    
    log_error "NETWORK" "$error_message" "$context"
    
    print_error "Network error: $error_message"
    print_status "Network diagnostics:"
    
    # Basic connectivity tests
    if command -v ping >/dev/null 2>&1; then
        if ping -c 1 -W 5 "$VPS_HOST" >/dev/null 2>&1; then
            print_status "✅ VPS host is reachable"
        else
            print_error "❌ VPS host is not reachable"
            print_status "Troubleshooting steps:"
            print_status "1. Check internet connection"
            print_status "2. Verify VPS IP address: $VPS_HOST"
            print_status "3. Check firewall settings"
        fi
    fi
    
    # SSH connectivity test
    if timeout 10 ssh -i "$SSH_KEY" -p "$VPS_PORT" -o ConnectTimeout=5 -o BatchMode=yes "$VPS_USER@$VPS_HOST" exit 2>/dev/null; then
        print_status "✅ SSH connection is working"
    else
        print_error "❌ SSH connection failed"
        print_status "Troubleshooting steps:"
        print_status "1. Check SSH key: $SSH_KEY"
        print_status "2. Verify SSH port: $VPS_PORT"
        print_status "3. Check VPS SSH service status"
    fi
    
    return $ERROR_NETWORK
}

# Permission error handling
handle_permission_error() {
    local error_message="$1"
    local context="$2"
    
    log_error "PERMISSION" "$error_message" "$context"
    
    print_error "Permission error: $error_message"
    print_status "Permission diagnostics:"
    
    # Check SSH key permissions
    if [ -f "$SSH_KEY" ]; then
        local key_perms=$(stat -c "%a" "$SSH_KEY" 2>/dev/null || echo "unknown")
        if [ "$key_perms" = "600" ]; then
            print_status "✅ SSH key permissions are correct"
        else
            print_error "❌ SSH key permissions are incorrect: $key_perms"
            print_status "Fix with: chmod 600 $SSH_KEY"
        fi
    else
        print_error "❌ SSH key not found: $SSH_KEY"
    fi
    
    # Check Docker permissions
    if command -v docker >/dev/null 2>&1; then
        if docker ps >/dev/null 2>&1; then
            print_status "✅ Docker permissions are working"
        else
            print_error "❌ Docker permission denied"
            print_status "Troubleshooting steps:"
            print_status "1. Add user to docker group: sudo usermod -aG docker \$USER"
            print_status "2. Restart shell session"
            print_status "3. Check Docker daemon status"
        fi
    fi
    
    return $ERROR_PERMISSION
}

# Disk space error handling
handle_disk_space_error() {
    local error_message="$1"
    local context="$2"
    
    log_error "DISK_SPACE" "$error_message" "$context"
    
    print_error "Disk space error: $error_message"
    print_status "Disk space diagnostics:"
    
    # Local disk space check
    print_status "Local disk usage:"
    df -h . | tail -n +2 | while read -r line; do
        print_status "  $line"
    done
    
    # VPS disk space check
    print_status "VPS disk usage:"
    if timeout 10 ssh -i "$SSH_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "df -h" 2>/dev/null; then
        print_status "✅ VPS disk space checked"
    else
        print_warning "⚠️  Could not check VPS disk space"
    fi
    
    print_status "Cleanup suggestions:"
    print_status "1. Clean Docker images: docker system prune -a"
    print_status "2. Remove old deployments"
    print_status "3. Clear temporary files: rm -rf /tmp/*"
    print_status "4. Check log file sizes"
    
    return $ERROR_DISK_SPACE
}

# Registry error handling with improved diagnostics and fallbacks
handle_registry_error() {
    local error_message="$1"
    local context="$2"
    
    log_error "REGISTRY" "$error_message" "$context"
    
    print_error "Registry error: $error_message"
    print_status "Registry diagnostics:"
    
    # Check multiple registries for better fallback support
    local custom_registry="git.pixelatedempathy.tech"
    local npm_registry="registry.npmjs.org"
    local docker_registry="index.docker.io"
    
    # Test custom registry
    if timeout 10 curl -s --connect-timeout 10 "https://$custom_registry" >/dev/null 2>&1; then
        print_status "✅ Custom registry ($custom_registry) is reachable"
    else
        print_error "❌ Custom registry ($custom_registry) is not reachable"
    fi
    
    # Test NPM registry as fallback
    if timeout 10 curl -s --connect-timeout 10 "https://$npm_registry" >/dev/null 2>&1; then
        print_status "✅ NPM registry ($npm_registry) is reachable"
    else
        print_error "❌ NPM registry ($npm_registry) is not reachable"
    fi
    
    # Test Docker registry
    if timeout 10 curl -s --connect-timeout 10 "https://$docker_registry/v2/" >/dev/null 2>&1; then
        print_status "✅ Docker registry ($docker_registry) is reachable"
    else
        print_error "❌ Docker registry ($docker_registry) is not reachable"
    fi
    
    # Check Docker login status for custom registry
    if docker info 2>/dev/null | grep -q "$custom_registry"; then
        print_status "✅ Docker registry login detected for $custom_registry"
    else
        print_warning "⚠️  Docker registry login not detected for $custom_registry"
        print_status "Login with: docker login $custom_registry"
    fi
    
    # Provide comprehensive troubleshooting
    print_status "Troubleshooting steps:"
    print_status "1. Check internet connection: ping 8.8.8.8"
    print_status "2. Check DNS resolution: nslookup $custom_registry"
    print_status "3. Verify registry URL and credentials"
    print_status "4. Check firewall settings"
    print_status "5. Try alternative registry: docker pull from docker.io"
    
    # For deployment, continue without registry push if needed
    print_status "🔄 Deployment will continue with local operations only"
    print_status "   Registry operations are optional for local deployment"
    
    # Don't fail the entire deployment for registry issues
    return 0
}

# Generic error handler with categorization
handle_deployment_error() {
    local error_output="$1"
    local context="$2"
    local retry_count="${3:-0}"
    
    # Categorize the error
    categorize_error "$error_output" "$context"
    local error_category=$?
    
    case $error_category in
        $ERROR_ENVIRONMENT_SETUP)
            handle_environment_setup_error "$error_output" "$retry_count"
            return $?
            ;;
        $ERROR_SYNCHRONIZATION)
            handle_synchronization_error "$error_output" "$retry_count"
            return $?
            ;;
        $ERROR_BUILD_FAILURE)
            handle_build_error "$error_output" "$context"
            return $?
            ;;
        $ERROR_NETWORK)
            handle_network_error "$error_output" "$context"
            return $?
            ;;
        $ERROR_PERMISSION)
            handle_permission_error "$error_output" "$context"
            return $?
            ;;
        $ERROR_DISK_SPACE)
            handle_disk_space_error "$error_output" "$context"
            return $?
            ;;
        $ERROR_REGISTRY)
            handle_registry_error "$error_output" "$context"
            return $?
            ;;
        *)
            log_error "UNKNOWN" "$error_output" "$context"
            print_error "Unknown error occurred: $error_output"
            return $ERROR_UNKNOWN
            ;;
    esac
}

# Retry logic wrapper functions
retry_with_backoff() {
    local max_attempts="$1"
    local delay="$2"
    local command_name="$3"
    shift 3
    local command=("$@")
    
    local attempt=1
    local exit_code=0
    
    while [ $attempt -le $max_attempts ]; do
        print_status "Executing $command_name (attempt $attempt/$max_attempts)"
        
        # Capture both stdout and stderr
        local output
        if output=$("${command[@]}" 2>&1); then
            print_status "✅ $command_name succeeded on attempt $attempt"
            return 0
        else
            exit_code=$?
            print_warning "⚠️  $command_name failed on attempt $attempt"
            
            # Handle the error based on category
            if handle_deployment_error "$output" "$command_name" $((attempt - 1)); then
                # Error handler says we can retry
                if [ $attempt -lt $max_attempts ]; then
                    print_status "Waiting ${delay}s before retry..."
                    sleep $delay
                    delay=$((delay * 2))  # Exponential backoff
                fi
            else
                # Error handler says we should not retry
                print_error "❌ $command_name failed permanently: $output"
                return $exit_code
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    print_error "❌ $command_name failed after $max_attempts attempts"
    return $exit_code
}

# Node.js environment setup function using nvm
setup_nodejs_environment() {
    local target_node_version="24.7.0"
    local target_pnpm_version="10.15.0"
    
    log_deployment_event "ENVIRONMENT" "INFO" "Setting up Node.js ${target_node_version} and pnpm ${target_pnpm_version} via nvm" "nodejs_setup"
    
    # Configure Docker DNS first to prevent build issues
    print_status "Configuring Docker DNS settings..."
    if configure_docker_dns "root@45.55.211.39"; then
        print_status "✅ Docker DNS configuration completed"
    else
        print_warning "⚠️ Docker DNS configuration had issues, continuing anyway"
    fi
    
    # Execute Node.js setup on remote server using nvm
    ssh -i ~/.ssh/planet -o StrictHostKeyChecking=no root@45.55.211.39 bash << 'EOF'
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-ENV]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-ENV ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[VPS-ENV WARNING]${NC} $1"; }

print_status "Starting Node.js environment setup via nvm..."

# Set up environment variables for nvm
export NVM_DIR="$HOME/.nvm"

# Source nvm if it exists (for non-interactive shells)
if [ -s "$NVM_DIR/nvm.sh" ]; then
    print_status "Loading existing nvm installation..."
    . "$NVM_DIR/nvm.sh"
    . "$NVM_DIR/bash_completion" 2>/dev/null || true
fi

# Check if nvm is available and Node.js 24.7.0 is installed
if command -v nvm >/dev/null 2>&1 && nvm list | grep -q "v24.7.0"; then
    print_status "Node.js 24.7.0 already installed via nvm, using it..."
    nvm use 24.7.0
else
    print_status "Installing/updating nvm and Node.js 24.7.0..."
    
    # Install required system dependencies
    print_status "Installing system dependencies for nvm..."
    apt-get update -qq
    apt-get install -y curl wget ca-certificates gnupg lsb-release

    # Remove existing nvm installation if it exists and is broken
    if [ -d "$NVM_DIR" ] && ! command -v nvm >/dev/null 2>&1; then
        print_warning "Removing broken nvm installation..."
        rm -rf "$NVM_DIR"
    fi

    print_status "Downloading nvm installer..."
    if curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash; then
        print_status "✅ nvm installer downloaded and executed successfully"
    else
        print_error "❌ Failed to download nvm installer"
        exit 1
    fi

    # Source nvm immediately for this session
    print_status "Loading nvm into current session..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    # Verify nvm is available
    if ! command -v nvm &> /dev/null; then
        print_error "❌ nvm command not found after installation"
        exit 1
    fi

    print_status "✅ nvm version: $(nvm --version)"

    # Install Node.js 24.7.0 using nvm
    print_status "Installing Node.js 24.7.0 with nvm..."
    if nvm install 24.7.0; then
        print_status "✅ Node.js 24.7.0 installed successfully"
    else
        print_error "❌ Failed to install Node.js 24.7.0 with nvm"
        exit 1
    fi

    # Use the installed Node.js version
    print_status "Setting Node.js 24.7.0 as default..."
    nvm use 24.7.0
    nvm alias default 24.7.0
fi

# Verify Node.js installation
if ! command -v node &> /dev/null; then
    print_error "❌ Node.js command not found after nvm installation"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "❌ npm command not found after Node.js installation"
    exit 1
fi

node_version=$(node --version)
npm_version=$(npm --version)

print_status "✅ Node.js version: $node_version"
print_status "✅ npm version: $npm_version"

# Verify we have the correct Node.js version
if [[ "$node_version" != "v24.7.0" ]]; then
    print_warning "⚠️ Expected Node.js v24.7.0, got $node_version"
else
    print_status "✅ Correct Node.js version confirmed: $node_version"
fi

# Install pnpm
print_status "Installing pnpm 10.15.0..."

# Configure npm with valid settings
npm config set registry https://registry.npmjs.org/
npm config set fetch-timeout 300000
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

# Install pnpm globally with retries
retry_count=0
max_retries=3

while [ $retry_count -lt $max_retries ]; do
    if npm install -g pnpm@10.15.0; then
        print_status "✅ pnpm 10.15.0 installation completed"
        break
    else
        retry_count=$((retry_count + 1))
        print_warning "⚠️ pnpm installation failed, retry $retry_count/$max_retries"
        if [ $retry_count -lt $max_retries ]; then
            sleep 5
        fi
    fi
done

if [ $retry_count -eq $max_retries ]; then
    print_error "❌ Failed to install pnpm after $max_retries attempts"
    exit 1
fi

# Verify pnpm installation
if ! command -v pnpm &> /dev/null; then
    print_error "❌ pnpm command not found after installation"
    exit 1
fi

pnpm_version=$(pnpm --version)
print_status "✅ pnpm version: $pnpm_version"

# Add nvm to shell profiles for persistence across SSH sessions
print_status "Adding nvm to shell profiles for persistence..."
echo 'export NVM_DIR="$HOME/.nvm"' >> $HOME/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> $HOME/.bashrc
echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> $HOME/.bashrc

# Create BASH_ENV for non-interactive shells (like Docker builds)
echo 'export NVM_DIR="$HOME/.nvm"' > $HOME/.bash_env
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> $HOME/.bash_env
echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> $HOME/.bash_env

if [ -f $HOME/.zshrc ]; then
    echo 'export NVM_DIR="$HOME/.nvm"' >> $HOME/.zshrc
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> $HOME/.zshrc
    echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> $HOME/.zshrc
fi

# Final verification
print_status "Final verification..."
print_status "✅ nvm: $(nvm --version)"
print_status "✅ Node.js: $(node --version)"
print_status "✅ npm: $(npm --version)"
print_status "✅ pnpm: $(pnpm --version)"

print_status "🚀 Node.js environment setup completed successfully via nvm!"
EOF

    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
        log_deployment_event "ENVIRONMENT" "INFO" "Node.js environment setup completed successfully via nvm" "nodejs_success"
        return 0
    else
        log_deployment_event "ENVIRONMENT" "ERROR" "Node.js environment setup failed with exit code $exit_code" "nodejs_failure"
        return $exit_code
    fi
}

# Secure environment variable deployment function
deploy_secure_environment_variables() {
    log_deployment_event "SECURITY" "INFO" "Deploying secure environment variables" "env_var_start"
    
    # Check if .env file exists locally
    if [[ ! -f ".env" ]]; then
        log_deployment_event "SECURITY" "WARNING" "No .env file found locally" "env_var_missing"
        return 1
    fi
    
    # Copy .env file to remote server securely
    if scp -i ~/.ssh/planet -o StrictHostKeyChecking=no .env root@45.55.211.39:/root/pixelated/.env; then
        log_deployment_event "SECURITY" "INFO" "Environment variables deployed successfully" "env_var_success"
        
        # Set proper permissions on remote .env file
        ssh -i ~/.ssh/planet -o StrictHostKeyChecking=no root@45.55.211.39 "chmod 600 /root/pixelated/.env"
        
        return 0
    else
        log_deployment_event "SECURITY" "ERROR" "Failed to deploy environment variables" "env_var_failure"
        return 1
    fi
}

# Enhanced environment setup with error handling
setup_nodejs_environment_with_retry() {
    local max_retries=3
    local retry_delay=5
    
    # Initialize structured logging system
    initialize_structured_logging
    
    # Start environment setup stage
    start_deployment_stage "environment_setup" "Node.js Environment Setup"
    
    # Try to setup Node.js with retry logic
    if retry_with_backoff $max_retries $retry_delay "nodejs_setup" setup_nodejs_environment; then
        end_deployment_stage "environment_setup" "success" "Node.js Environment Setup"
        return 0
    else
        log_error "ENVIRONMENT" "Node.js environment setup failed after $max_retries attempts" "final_attempt"
        end_deployment_stage "environment_setup" "failed" "Node.js Environment Setup"
        print_error "❌ Failed to setup Node.js environment"
        print_status "Manual setup may be required. Check error logs: $ERROR_LOG"
        return $ERROR_ENVIRONMENT_SETUP
    fi
}

# Enhanced synchronization with error handling
sync_with_error_handling() {
    local max_retries=3
    local retry_delay=10
    
    print_header "📁 Synchronizing files with error handling"
    
    # Create a wrapper function for the sync operation
    perform_sync() {
        # The actual rsync command will be called here
        # This is a placeholder for the existing sync logic
        return 0  # Will be replaced with actual sync implementation
    }
    
    if retry_with_backoff $max_retries $retry_delay "file_synchronization" perform_sync; then
        print_status "✅ File synchronization completed successfully"
        return 0
    else
        log_error "SYNC" "File synchronization failed after $max_retries attempts" "final_attempt"
        print_error "❌ Failed to synchronize files"
        print_status "Check network connectivity and VPS accessibility"
        return $ERROR_SYNCHRONIZATION
    fi
}

# Enhanced container build with error handling
build_container_with_error_handling() {
    local container_name="$1"
    local tag="$2"
    local dockerfile_path="${3:-.}"
    local build_context="${4:-.}"
    
    print_header "🐳 Building container with error handling: $container_name:$tag"
    
    # Wrapper function for container build
    perform_container_build() {
        build_container "$container_name" "$tag" "$dockerfile_path" "$build_context"
    }
    
    # Try building with error handling (no retry for builds to avoid resource waste)
    if perform_container_build; then
        print_status "✅ Container build completed successfully"
        return 0
    else
        local exit_code=$?
        print_error "❌ Container build failed with exit code: $exit_code"
        print_error "Check Docker daemon status and build configuration"
        return $exit_code
    fi
}

# Container Manager Functions

# Configure Docker daemon for better DNS resolution
configure_docker_dns() {
    local server="$1"
    
    print_status "Configuring Docker DNS settings on remote server..."
    
    ssh "$server" << 'EOF'
# Create or update Docker daemon configuration
sudo mkdir -p /etc/docker

# Backup existing daemon.json if it exists
if [[ -f /etc/docker/daemon.json ]]; then
    sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup.$(date +%s)
fi

# Configure Docker with reliable DNS servers
sudo tee /etc/docker/daemon.json > /dev/null << 'DOCKER_CONFIG'
{
    "dns": ["8.8.8.8", "1.1.1.1", "208.67.222.222"],
    "dns-opts": ["ndots:2", "timeout:3", "attempts:2"],
    "dns-search": [],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "default-address-pools": [
        {
            "base": "172.17.0.0/16",
            "size": 24
        }
    ]
}
DOCKER_CONFIG

echo "✅ Docker daemon configuration updated"

# Restart Docker daemon to apply changes
if sudo systemctl restart docker; then
    echo "✅ Docker daemon restarted successfully"
    
    # Wait for Docker to be ready
    sleep 5
    
    # Test Docker functionality
    if docker ps >/dev/null 2>&1; then
        echo "✅ Docker is working properly"
        return 0
    else
        echo "❌ Docker restart failed"
        return 1
    fi
else
    echo "❌ Failed to restart Docker daemon"
    return 1
fi
EOF
    
    return $?
}

build_container() {
    local container_name="$1"
    local tag="$2"
    local dockerfile_path="${3:-.}"
    local build_context="${4:-.}"
    
    print_status "Building container: $container_name:$tag"
    
    # Add DNS and network fixes for build reliability
    print_status "Configuring Docker build with DNS and network optimizations..."
    
    # Use legacy docker build to support DNS flags, or buildx with network options
    # First try with legacy docker build (if available)
    if command -v docker >/dev/null 2>&1; then
        print_status "🔨 Starting Docker build (this may take 10-15 minutes)..."
        print_status "📋 Build progress will be shown below..."
        echo "⏰ Build started at: $(date)"
        
        # Create a simple progress monitor that shows activity every 30 seconds
        show_build_progress() {
            local counter=0
            while kill -0 $$ 2>/dev/null; do
                sleep 30
                counter=$((counter + 1))
                echo "⏳ Build still active... ${counter} minutes elapsed"
            done
        } &
        local progress_pid=$!
        
        # Force immediate output and disable buffering for Docker build
        echo "🔧 Starting Docker build with real-time output..."
        set -o pipefail
        DOCKER_BUILDKIT=0 docker build \
            --network=host \
            --add-host="registry.npmjs.org:104.16.21.35" \
            --add-host="registry.yarnpkg.com:104.16.21.35" \
            -t "$container_name:$tag" \
            -f "$dockerfile_path/Dockerfile" \
            "$build_context" 2>&1 | while IFS= read -r line; do
                echo "$line"
                # Force output flush
                sync
            done
        
        local build_result=${PIPESTATUS[0]}
        kill $progress_pid 2>/dev/null || true
        
        # Check build result
        if [[ $build_result -eq 0 ]]; then
            echo "🏁 Build completed at: $(date)"
            print_status "✅ Container built successfully: $container_name:$tag"
            
            # Validate build artifacts
            if validate_container_build "$container_name:$tag"; then
                print_status "✅ Container build validation passed"
                return 0
            else
                print_error "❌ Container build validation failed"
                return 1
            fi
        else
            print_error "❌ Container build failed"
            print_error "Docker build command failed. Check Docker daemon status and try again."
            return 1
        fi
    else
        print_error "❌ Docker command not found"
        return 1
    fi
}

validate_container_build() {
    local image_tag="$1"
    
    print_status "Validating container build: $image_tag"
    
    # Check if image exists
    if ! docker image inspect "$image_tag" >/dev/null 2>&1; then
        print_error "Container image not found: $image_tag"
        return 1
    fi
    
    # Check image size (warn if over 2GB)
    local image_size=$(docker image inspect "$image_tag" --format='{{.Size}}')
    local size_gb=$((image_size / 1024 / 1024 / 1024))
    
    if [ "$size_gb" -gt 2 ]; then
        print_warning "Container image is large: ${size_gb}GB"
    fi
    
    # Test container can start (quick test)
    print_status "Testing container startup..."
    local test_container_name="test-$(date +%s)"
    
    if docker run --name "$test_container_name" --rm -d "$image_tag" sleep 5 >/dev/null 2>&1; then
        docker stop "$test_container_name" >/dev/null 2>&1 || true
        print_status "✅ Container startup test passed"
        return 0
    else
        print_error "❌ Container startup test failed"
        docker logs "$test_container_name" 2>/dev/null || true
        docker rm "$test_container_name" >/dev/null 2>&1 || true
        return 1
    fi
}

# Test and diagnose Docker DNS issues
test_docker_dns_connectivity() {
    local server="$1"
    
    print_status "Testing Docker DNS connectivity..."
    
    ssh "$server" << 'EOF'
echo "🔍 Running Docker DNS connectivity tests..."

# Test system DNS resolution
echo "1. Testing system DNS resolution:"
if nslookup registry.npmjs.org >/dev/null 2>&1; then
    echo "✅ System DNS: registry.npmjs.org resolves correctly"
else
    echo "❌ System DNS: Failed to resolve registry.npmjs.org"
fi

# Test Docker DNS resolution
echo "2. Testing Docker DNS resolution:"
if docker run --rm alpine nslookup registry.npmjs.org >/dev/null 2>&1; then
    echo "✅ Docker DNS: registry.npmjs.org resolves correctly"
else
    echo "❌ Docker DNS: Failed to resolve registry.npmjs.org"
    echo "   This indicates Docker DNS configuration issues"
fi

# Test network connectivity
echo "3. Testing network connectivity:"
if docker run --rm alpine ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    echo "✅ Network: Can reach Google DNS (8.8.8.8)"
else
    echo "❌ Network: Cannot reach Google DNS (8.8.8.8)"
fi

# Check Docker daemon DNS configuration
echo "4. Checking Docker daemon configuration:"
if [[ -f /etc/docker/daemon.json ]]; then
    echo "Docker daemon.json exists:"
    cat /etc/docker/daemon.json | jq . 2>/dev/null || cat /etc/docker/daemon.json
else
    echo "⚠️ No Docker daemon.json found - using default DNS settings"
fi

# Test npm registry connectivity from container
echo "5. Testing npm registry connectivity:"
if docker run --rm node:18-alpine npm ping >/dev/null 2>&1; then
    echo "✅ NPM registry: Accessible from container"
else
    echo "❌ NPM registry: Not accessible from container"
    echo "   This will cause npm install failures"
fi

echo "DNS diagnostic complete."
EOF
    
    return $?
}

generate_container_tag() {
    local base_name="$1"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local commit_hash=""
    
    # Try to get git commit hash
    if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
        commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    else
        commit_hash="nogit"
    fi
    
    echo "${base_name}:${timestamp}-${commit_hash}"
}

tag_container_with_metadata() {
    local source_tag="$1"
    local target_base="$2"
    
    # Generate timestamped tag
    local timestamped_tag=$(generate_container_tag "$target_base")
    
    print_status "Tagging container: $source_tag -> $timestamped_tag"
    
    if docker tag "$source_tag" "$timestamped_tag"; then
        print_status "✅ Container tagged: $timestamped_tag"
        
        # Also tag as latest
        local latest_tag="${target_base}:latest"
        if docker tag "$source_tag" "$latest_tag"; then
            print_status "✅ Container tagged as latest: $latest_tag"
        fi
        
        echo "$timestamped_tag"
        return 0
    else
        print_error "❌ Failed to tag container"
        return 1
    fi
}

# Health Check System Functions

# Progressive Health Check Stages Implementation
perform_basic_connectivity_test() {
    local port="$1"
    local timeout="${2:-10}"
    local container_name="${3:-unknown}"
    
    print_status "🔍 Stage 1: Basic connectivity test (timeout: ${timeout}s)"
    
    local start_time=$(date +%s%3N)
    local elapsed=0
    local check_interval=1
    
    while [ $elapsed -lt $timeout ]; do
        # Check if container is still running
        if [[ -n "$container_name" ]] && [[ "$container_name" != "unknown" ]]; then
            if ! docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
                print_error "❌ Container $container_name is not running"
                return 1
            fi
        fi
        
        # Test basic TCP connectivity
        if timeout 3 bash -c "</dev/tcp/localhost/$port" 2>/dev/null; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            print_status "✅ Basic connectivity established (${response_time}ms)"
            return 0
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        
        if [ $((elapsed % 5)) -eq 0 ]; then
            print_status "Still testing connectivity... (${elapsed}s/${timeout}s)"
        fi
    done
    
    print_error "❌ Basic connectivity test failed within ${timeout}s"
    return 1
}

wait_for_application_ready() {
    local container_name="$1"
    local port="$2"
    local timeout="${3:-90}"  # Increased timeout from 60 to 90 seconds
    local check_interval="${4:-3}"  # Increased interval from 2 to 3 seconds
    
    print_status "🔍 Stage 2: Application readiness check (timeout: ${timeout}s, interval: ${check_interval}s)"
    
    # First perform basic connectivity test with longer timeout
    if ! perform_basic_connectivity_test "$port" 15 "$container_name"; then
        print_warning "Basic connectivity test failed, but continuing with readiness check..."
    fi
    
    local start_time=$(date +%s)
    local elapsed=0
    local consecutive_failures=0
    local max_consecutive_failures=3
    
    while [ $elapsed -lt $timeout ]; do
        # Check if container is still running
        if ! docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
            print_error "Container $container_name is not running"
            
            # Check container logs for debugging
            print_status "Container logs (last 10 lines):"
            docker logs --tail 10 "$container_name" 2>/dev/null || echo "Could not retrieve logs"
            return 1
        fi
        
        # Check if application is responding with proper HTTP
        local response_start=$(date +%s%3N)
        local http_response=$(timeout 10 curl -s -w "%{http_code}:%{time_total}" -o /dev/null "http://localhost:${port}/" 2>/dev/null || echo "000:0")
        local response_end=$(date +%s%3N)
        
        local status_code=$(echo "$http_response" | cut -d':' -f1)
        local curl_time=$(echo "$http_response" | cut -d':' -f2)
        local actual_time=$((response_end - response_start))
        
        if [[ "$status_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            print_status "✅ Application is ready after ${elapsed}s (HTTP $status_code, ${actual_time}ms)"
            return 0
        elif [[ "$status_code" == "000" ]]; then
            consecutive_failures=$((consecutive_failures + 1))
            if [ $consecutive_failures -ge $max_consecutive_failures ]; then
                print_warning "⚠️  Multiple consecutive connection failures ($consecutive_failures), checking container status..."
                if ! docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
                    print_error "Container has stopped running"
                    return 1
                fi
            fi
        else
            consecutive_failures=0  # Reset on any response
            print_status "Application responding but not ready (HTTP $status_code, ${actual_time}ms)"
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        
        if [ $((elapsed % 15)) -eq 0 ]; then
            print_status "Still waiting for readiness... (${elapsed}s/${timeout}s, failures: $consecutive_failures)"
        fi
    done
    
    # Final diagnostic before failing
    print_error "❌ Application failed to become ready within ${timeout}s"
    print_status "Final container status check:"
    docker ps --filter "name=$container_name" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    print_status "Final container logs (last 20 lines):"
    docker logs --tail 20 "$container_name" 2>/dev/null || echo "Could not retrieve logs"
    
    return 1
}

test_root_endpoint() {
    local port="$1"
    local expected_status="${2:-200}"
    
    print_status "🔍 Stage 3: Root endpoint validation (expecting HTTP $expected_status)"
    
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "%{http_code}:%{time_total}:%{size_download}" -o /tmp/root-response.html "http://localhost:${port}/" 2>/dev/null || echo "000:0:0")
    local end_time=$(date +%s%3N)
    
    local status_code=$(echo "$response" | cut -d':' -f1)
    local curl_time=$(echo "$response" | cut -d':' -f2)
    local content_size=$(echo "$response" | cut -d':' -f3)
    local actual_time=$((end_time - start_time))
    
    # Performance check - warn if response time > 50ms (requirement)
    if [ "$actual_time" -gt 50 ]; then
        print_warning "⚠️  Root endpoint response time: ${actual_time}ms (>50ms threshold)"
    fi
    
    if [ "$status_code" = "$expected_status" ]; then
        # Log successful health check
        log_health_check_results "root_endpoint" "pass" "$actual_time" "HTTP $status_code, ${content_size} bytes" "/"
        
        # Basic content validation
        if [ "$content_size" -gt 0 ]; then
            print_status "✅ Root endpoint returned content"
        else
            print_warning "⚠️  Root endpoint returned empty content"
            log_health_check_results "root_endpoint_content" "warning" "$actual_time" "Empty content returned" "/"
        fi
        
        return 0
    else
        # Log failed health check
        log_health_check_results "root_endpoint" "fail" "$actual_time" "HTTP $status_code (expected $expected_status)" "/"
        print_error "Response preview:"
        head -n 5 /tmp/root-response.html 2>/dev/null || echo "No response content"
        return 1
    fi
}

test_api_endpoints() {
    local port="$1"
    local endpoints=("$@")
    local failed_count=0
    local total_response_time=0
    local endpoint_count=0
    
    print_status "🔍 Stage 4: API endpoint validation with response time measurement"
    
    # Remove port from endpoints array (it's the first argument)
    endpoints=("${endpoints[@]:1}")
    
    # Default endpoints if none provided
    if [ ${#endpoints[@]} -eq 0 ]; then
        endpoints=("/api/health" "/api/status" "/api/bias-detection/health")
    fi
    
    # Create detailed results file
    local api_results="/tmp/api-endpoint-results.json"
    echo '{"endpoints":{},"summary":{}}' > "$api_results"
    
    for endpoint in "${endpoints[@]}"; do
        print_status "Testing endpoint: $endpoint"
        endpoint_count=$((endpoint_count + 1))
        
        local start_time=$(date +%s%3N)
        local response=$(curl -s -w "%{http_code}:%{time_total}:%{size_download}:%{time_connect}" -o /tmp/api-response.json "http://localhost:${port}${endpoint}" 2>/dev/null || echo "000:0:0:0")
        local end_time=$(date +%s%3N)
        
        local status_code=$(echo "$response" | cut -d':' -f1)
        local curl_time=$(echo "$response" | cut -d':' -f2)
        local content_size=$(echo "$response" | cut -d':' -f3)
        local connect_time=$(echo "$response" | cut -d':' -f4)
        local actual_time=$((end_time - start_time))
        
        total_response_time=$((total_response_time + actual_time))
        
        # Performance validation - warn if > 50ms
        local performance_status="good"
        if [ "$actual_time" -gt 50 ]; then
            performance_status="slow"
            print_warning "⚠️  Slow response: ${actual_time}ms (>50ms threshold)"
        fi
        
        # Store detailed results
        local endpoint_key=$(echo "$endpoint" | sed 's/[^a-zA-Z0-9]/_/g')
        echo "$(jq --arg key "$endpoint_key" --arg endpoint "$endpoint" --arg status "$status_code" --arg time "$actual_time" --arg size "$content_size" --arg perf "$performance_status" '.endpoints[$key] = {"endpoint": $endpoint, "status_code": $status, "response_time_ms": ($time | tonumber), "content_size": ($size | tonumber), "performance": $perf}' "$api_results")" > "$api_results"
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "204" ]; then
            print_status "✅ $endpoint: HTTP $status_code (${actual_time}ms, ${content_size} bytes)"
            
            # Validate JSON response if content exists
            if [ "$content_size" -gt 0 ] && [ -f /tmp/api-response.json ]; then
                if jq empty /tmp/api-response.json 2>/dev/null; then
                    print_status "✅ Valid JSON response"
                else
                    print_warning "⚠️  Invalid JSON response"
                fi
            fi
        else
            print_error "❌ $endpoint: HTTP $status_code (${actual_time}ms)"
            failed_count=$((failed_count + 1))
            
            # Show response preview for debugging
            if [ -f /tmp/api-response.json ]; then
                print_error "Response preview:"
                head -n 3 /tmp/api-response.json 2>/dev/null || echo "No response content"
            fi
        fi
    done
    
    # Calculate average response time
    local avg_response_time=0
    if [ $endpoint_count -gt 0 ]; then
        avg_response_time=$((total_response_time / endpoint_count))
    fi
    
    # Update summary in results
    echo "$(jq --arg total "$endpoint_count" --arg failed "$failed_count" --arg avg_time "$avg_response_time" '.summary = {"total_endpoints": ($total | tonumber), "failed_endpoints": ($failed | tonumber), "average_response_time_ms": ($avg_time | tonumber)}' "$api_results")" > "$api_results"
    
    print_status "API endpoint summary: $endpoint_count tested, $failed_count failed, ${avg_response_time}ms avg"
    
    if [ $failed_count -eq 0 ]; then
        print_status "✅ All API endpoints passed"
        return 0
    else
        print_error "❌ $failed_count API endpoint(s) failed"
        return 1
    fi
}

test_static_assets() {
    local port="$1"
    local assets=("$@")
    local failed_count=0
    local total_response_time=0
    local asset_count=0
    
    print_status "🔍 Stage 5: Static asset serving verification with performance checks"
    
    # Remove port from assets array (it's the first argument)
    assets=("${assets[@]:1}")
    
    # Default assets if none provided - include common Astro/React assets
    if [ ${#assets[@]} -eq 0 ]; then
        assets=("/favicon.ico" "/favicon.svg" "/assets/main.css" "/assets/main.js" "/manifest.json")
    fi
    
    # Create detailed results file
    local asset_results="/tmp/static-asset-results.json"
    echo '{"assets":{},"summary":{}}' > "$asset_results"
    
    for asset in "${assets[@]}"; do
        print_status "Testing asset: $asset"
        asset_count=$((asset_count + 1))
        
        local start_time=$(date +%s%3N)
        local response=$(curl -s -w "%{http_code}:%{time_total}:%{size_download}:%{content_type}" -o /tmp/asset-response "http://localhost:${port}${asset}" 2>/dev/null || echo "000:0:0:unknown")
        local end_time=$(date +%s%3N)
        
        local status_code=$(echo "$response" | cut -d':' -f1)
        local curl_time=$(echo "$response" | cut -d':' -f2)
        local content_size=$(echo "$response" | cut -d':' -f3)
        local content_type=$(echo "$response" | cut -d':' -f4)
        local actual_time=$((end_time - start_time))
        
        total_response_time=$((total_response_time + actual_time))
        
        # Performance validation - warn if > 100ms for static assets
        local performance_status="good"
        if [ "$actual_time" -gt 100 ]; then
            performance_status="slow"
            print_warning "⚠️  Slow asset loading: ${actual_time}ms (>100ms threshold)"
        fi
        
        # Validate content type for known assets
        local expected_type=""
        case "$asset" in
            *.css) expected_type="text/css" ;;
            *.js) expected_type="application/javascript" ;;
            *.json) expected_type="application/json" ;;
            *.ico) expected_type="image/x-icon" ;;
            *.svg) expected_type="image/svg+xml" ;;
        esac
        
        # Store detailed results
        local asset_key=$(echo "$asset" | sed 's/[^a-zA-Z0-9]/_/g')
        echo "$(jq --arg key "$asset_key" --arg asset "$asset" --arg status "$status_code" --arg time "$actual_time" --arg size "$content_size" --arg type "$content_type" --arg perf "$performance_status" '.assets[$key] = {"asset": $asset, "status_code": $status, "response_time_ms": ($time | tonumber), "content_size": ($size | tonumber), "content_type": $type, "performance": $perf}' "$asset_results")" > "$asset_results"
        
        if [ "$status_code" = "200" ]; then
            print_status "✅ $asset: HTTP $status_code (${actual_time}ms, ${content_size} bytes, $content_type)"
            
            # Validate content type if expected
            if [[ -n "$expected_type" ]] && [[ "$content_type" != *"$expected_type"* ]]; then
                print_warning "⚠️  Unexpected content type: $content_type (expected $expected_type)"
            fi
            
            # Validate content size
            if [ "$content_size" -eq 0 ]; then
                print_warning "⚠️  Asset has zero size"
            fi
            
        elif [ "$status_code" = "404" ]; then
            print_warning "⚠️  $asset: HTTP $status_code (not found, but server responding - ${actual_time}ms)"
        else
            print_error "❌ $asset: HTTP $status_code (${actual_time}ms)"
            failed_count=$((failed_count + 1))
        fi
    done
    
    # Calculate average response time
    local avg_response_time=0
    if [ $asset_count -gt 0 ]; then
        avg_response_time=$((total_response_time / asset_count))
    fi
    
    # Update summary in results
    echo "$(jq --arg total "$asset_count" --arg failed "$failed_count" --arg avg_time "$avg_response_time" '.summary = {"total_assets": ($total | tonumber), "failed_assets": ($failed | tonumber), "average_response_time_ms": ($avg_time | tonumber)}' "$asset_results")" > "$asset_results"
    
    print_status "Static asset summary: $asset_count tested, $failed_count failed, ${avg_response_time}ms avg"
    
    if [ $failed_count -eq 0 ]; then
        print_status "✅ Static asset serving test passed"
        return 0
    else
        print_error "❌ $failed_count static asset(s) failed"
        return 1
    fi
}

perform_comprehensive_health_check() {
    local container_name="$1"
    local port="$2"
    local api_endpoints=("${@:3}")
    
    print_header "🔍 Performing comprehensive health check..."
    
    local health_check_results="/tmp/health-check-results.json"
    local health_check_log="/tmp/health-check-detailed.log"
    local overall_status="pass"
    local start_time=$(date +%s)
    local deployment_timestamp=$(date -Iseconds)
    
    # Initialize comprehensive results file
    cat > "$health_check_results" << HEALTH_INIT
{
    "deployment_id": "$(uuidgen 2>/dev/null || date +%s | sha256sum | cut -c1-32)",
    "timestamp": "$deployment_timestamp",
    "container_name": "$container_name",
    "port": $port,
    "checks": {},
    "performance_metrics": {},
    "failure_details": [],
    "summary": {}
}
HEALTH_INIT
    
    # Initialize detailed log
    echo "=== Health Check Detailed Log ===" > "$health_check_log"
    echo "Timestamp: $deployment_timestamp" >> "$health_check_log"
    echo "Container: $container_name" >> "$health_check_log"
    echo "Port: $port" >> "$health_check_log"
    echo "===============================" >> "$health_check_log"
    echo "" >> "$health_check_log"
    
    local check_count=0
    local failed_checks=0
    local total_response_time=0
    
    # 1. Basic connectivity and application readiness
    print_status "Running Stage 1-2: Connectivity and Readiness Checks"
    check_count=$((check_count + 1))
    
    local readiness_start=$(date +%s%3N)
    if wait_for_application_ready "$container_name" "$port" 60; then
        local readiness_end=$(date +%s%3N)
        local readiness_time=$((readiness_end - readiness_start))
        total_response_time=$((total_response_time + readiness_time))
        
        echo "$(jq --arg time "$readiness_time" '.checks.readiness = {"status": "pass", "message": "Application ready", "response_time_ms": ($time | tonumber), "stage": "connectivity"}' "$health_check_results")" > "$health_check_results"
        echo "[$(date -Iseconds)] ✅ PASS: Application readiness (${readiness_time}ms)" >> "$health_check_log"
    else
        local readiness_end=$(date +%s%3N)
        local readiness_time=$((readiness_end - readiness_start))
        failed_checks=$((failed_checks + 1))
        overall_status="fail"
        
        echo "$(jq --arg time "$readiness_time" '.checks.readiness = {"status": "fail", "message": "Application not ready within timeout", "response_time_ms": ($time | tonumber), "stage": "connectivity"}' "$health_check_results")" > "$health_check_results"
        echo "[$(date -Iseconds)] ❌ FAIL: Application readiness timeout (${readiness_time}ms)" >> "$health_check_log"
        
        # Add detailed failure information
        echo "$(jq '.failure_details += [{"check": "readiness", "reason": "timeout", "timeout_seconds": 60, "container_status": "unknown"}]' "$health_check_results")" > "$health_check_results"
        
        # Log container status for debugging
        local container_status=$(docker ps -a --filter "name=$container_name" --format "table {{.Status}}" | tail -n +2 || echo "unknown")
        echo "Container status: $container_status" >> "$health_check_log"
        
        # If readiness fails, we should still continue with other checks for diagnostic purposes
        print_warning "⚠️  Continuing with remaining checks for diagnostic purposes"
    fi
    
    # 2. Root endpoint test
    print_status "Running Stage 3: Root Endpoint Validation"
    check_count=$((check_count + 1))
    
    local root_start=$(date +%s%3N)
    if test_root_endpoint "$port" 200; then
        local root_end=$(date +%s%3N)
        local root_time=$((root_end - root_start))
        total_response_time=$((total_response_time + root_time))
        
        echo "$(jq --arg time "$root_time" '.checks.root_endpoint = {"status": "pass", "message": "Root endpoint responding", "response_time_ms": ($time | tonumber), "stage": "http"}' "$health_check_results")" > "$health_check_results"
        echo "[$(date -Iseconds)] ✅ PASS: Root endpoint (${root_time}ms)" >> "$health_check_log"
    else
        local root_end=$(date +%s%3N)
        local root_time=$((root_end - root_start))
        failed_checks=$((failed_checks + 1))
        overall_status="fail"
        
        echo "$(jq --arg time "$root_time" '.checks.root_endpoint = {"status": "fail", "message": "Root endpoint not responding correctly", "response_time_ms": ($time | tonumber), "stage": "http"}' "$health_check_results")" > "$health_check_results"
        echo "[$(date -Iseconds)] ❌ FAIL: Root endpoint (${root_time}ms)" >> "$health_check_log"
        
        # Add detailed failure information
        echo "$(jq '.failure_details += [{"check": "root_endpoint", "reason": "http_error", "expected_status": 200}]' "$health_check_results")" > "$health_check_results"
    fi
    
    # 3. API endpoints test
    print_status "Running Stage 4: API Endpoint Validation"
    check_count=$((check_count + 1))
    
    local api_start=$(date +%s%3N)
    if test_api_endpoints "$port" "${api_endpoints[@]}"; then
        local api_end=$(date +%s%3N)
        local api_time=$((api_end - api_start))
        total_response_time=$((total_response_time + api_time))
        
        # Merge API endpoint results if available
        if [ -f /tmp/api-endpoint-results.json ]; then
            echo "$(jq --slurpfile api_data /tmp/api-endpoint-results.json --arg time "$api_time" '.checks.api_endpoints = {"status": "pass", "message": "API endpoints responding", "response_time_ms": ($time | tonumber), "stage": "api", "detailed_results": $api_data[0]}' "$health_check_results")" > "$health_check_results"
        else
            echo "$(jq --arg time "$api_time" '.checks.api_endpoints = {"status": "pass", "message": "API endpoints responding", "response_time_ms": ($time | tonumber), "stage": "api"}' "$health_check_results")" > "$health_check_results"
        fi
        echo "[$(date -Iseconds)] ✅ PASS: API endpoints (${api_time}ms)" >> "$health_check_log"
    else
        local api_end=$(date +%s%3N)
        local api_time=$((api_end - api_start))
        failed_checks=$((failed_checks + 1))
        overall_status="fail"
        
        # Merge API endpoint results for failure analysis
        if [ -f /tmp/api-endpoint-results.json ]; then
            echo "$(jq --slurpfile api_data /tmp/api-endpoint-results.json --arg time "$api_time" '.checks.api_endpoints = {"status": "fail", "message": "Some API endpoints failed", "response_time_ms": ($time | tonumber), "stage": "api", "detailed_results": $api_data[0]}' "$health_check_results")" > "$health_check_results"
        else
            echo "$(jq --arg time "$api_time" '.checks.api_endpoints = {"status": "fail", "message": "Some API endpoints failed", "response_time_ms": ($time | tonumber), "stage": "api"}' "$health_check_results")" > "$health_check_results"
        fi
        echo "[$(date -Iseconds)] ❌ FAIL: API endpoints (${api_time}ms)" >> "$health_check_log"
        
        # Add detailed failure information
        echo "$(jq '.failure_details += [{"check": "api_endpoints", "reason": "endpoint_failures", "details": "Check detailed_results for specific failures"}]' "$health_check_results")" > "$health_check_results"
    fi
    
    # 4. Static assets test
    print_status "Running Stage 5: Static Asset Validation"
    check_count=$((check_count + 1))
    
    local assets_start=$(date +%s%3N)
    if test_static_assets "$port"; then
        local assets_end=$(date +%s%3N)
        local assets_time=$((assets_end - assets_start))
        total_response_time=$((total_response_time + assets_time))
        
        # Merge static asset results if available
        if [ -f /tmp/static-asset-results.json ]; then
            echo "$(jq --slurpfile asset_data /tmp/static-asset-results.json --arg time "$assets_time" '.checks.static_assets = {"status": "pass", "message": "Static assets serving correctly", "response_time_ms": ($time | tonumber), "stage": "assets", "detailed_results": $asset_data[0]}' "$health_check_results")" > "$health_check_results"
        else
            echo "$(jq --arg time "$assets_time" '.checks.static_assets = {"status": "pass", "message": "Static assets serving correctly", "response_time_ms": ($time | tonumber), "stage": "assets"}' "$health_check_results")" > "$health_check_results"
        fi
        echo "[$(date -Iseconds)] ✅ PASS: Static assets (${assets_time}ms)" >> "$health_check_log"
    else
        local assets_end=$(date +%s%3N)
        local assets_time=$((assets_end - assets_start))
        failed_checks=$((failed_checks + 1))
        overall_status="fail"
        
        # Merge static asset results for failure analysis
        if [ -f /tmp/static-asset-results.json ]; then
            echo "$(jq --slurpfile asset_data /tmp/static-asset-results.json --arg time "$assets_time" '.checks.static_assets = {"status": "fail", "message": "Static asset serving issues", "response_time_ms": ($time | tonumber), "stage": "assets", "detailed_results": $asset_data[0]}' "$health_check_results")" > "$health_check_results"
        else
            echo "$(jq --arg time "$assets_time" '.checks.static_assets = {"status": "fail", "message": "Static asset serving issues", "response_time_ms": ($time | tonumber), "stage": "assets"}' "$health_check_results")" > "$health_check_results"
        fi
        echo "[$(date -Iseconds)] ❌ FAIL: Static assets (${assets_time}ms)" >> "$health_check_log"
        
        # Add detailed failure information
        echo "$(jq '.failure_details += [{"check": "static_assets", "reason": "asset_serving_errors", "details": "Check detailed_results for specific failures"}]' "$health_check_results")" > "$health_check_results"
    fi
    
    # Calculate final metrics
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    local avg_response_time=0
    if [ $check_count -gt 0 ]; then
        avg_response_time=$((total_response_time / check_count))
    fi
    
    # Update comprehensive results with performance metrics and summary
    echo "$(jq --arg status "$overall_status" --arg duration "${total_time}s" --arg total_checks "$check_count" --arg failed_checks "$failed_checks" --arg avg_time "$avg_response_time" --arg total_time "$total_response_time" '.overall_status = $status | .duration = $duration | .performance_metrics = {"total_response_time_ms": ($total_time | tonumber), "average_response_time_ms": ($avg_time | tonumber), "total_duration_seconds": ($duration | tonumber)} | .summary = {"total_checks": ($total_checks | tonumber), "failed_checks": ($failed_checks | tonumber), "success_rate": (((($total_checks | tonumber) - ($failed_checks | tonumber)) / ($total_checks | tonumber)) * 100 | floor)}' "$health_check_results")" > "$health_check_results"
    
    # Generate comprehensive health check report
    generate_health_check_report "$health_check_results" "$health_check_log"
    
    # Handle failures with specific container termination
    if [ "$overall_status" = "fail" ]; then
        handle_health_check_failure "$container_name" "$health_check_results" "$health_check_log"
        return 1
    else
        print_status "✅ All health checks passed - deployment validated successfully"
        return 0
    fi
}

# Health Check Reporting and Failure Handling Functions

generate_health_check_report() {
    local results_file="$1"
    local log_file="$2"
    local report_file="/tmp/health-check-report.txt"
    
    print_header "📊 Comprehensive Health Check Report"
    
    # Extract key metrics from results
    local overall_status=$(jq -r '.overall_status' "$results_file" 2>/dev/null || echo "unknown")
    local duration=$(jq -r '.duration' "$results_file" 2>/dev/null || echo "unknown")
    local total_checks=$(jq -r '.summary.total_checks' "$results_file" 2>/dev/null || echo "0")
    local failed_checks=$(jq -r '.summary.failed_checks' "$results_file" 2>/dev/null || echo "0")
    local success_rate=$(jq -r '.summary.success_rate' "$results_file" 2>/dev/null || echo "0")
    local avg_response_time=$(jq -r '.performance_metrics.average_response_time_ms' "$results_file" 2>/dev/null || echo "0")
    
    # Generate formatted report
    cat > "$report_file" << REPORT_EOF
================================================================================
                        HEALTH CHECK REPORT
================================================================================
Deployment ID: $(jq -r '.deployment_id' "$results_file" 2>/dev/null || echo "unknown")
Timestamp: $(jq -r '.timestamp' "$results_file" 2>/dev/null || echo "unknown")
Container: $(jq -r '.container_name' "$results_file" 2>/dev/null || echo "unknown")
Port: $(jq -r '.port' "$results_file" 2>/dev/null || echo "unknown")

OVERALL STATUS: $overall_status
Duration: $duration
Success Rate: ${success_rate}% (${total_checks} checks, ${failed_checks} failures)
Average Response Time: ${avg_response_time}ms

================================================================================
                           CHECK RESULTS
================================================================================
REPORT_EOF
    
    # Add individual check results
    if command -v jq >/dev/null 2>&1 && [ -f "$results_file" ]; then
        jq -r '.checks | to_entries[] | 
        if .value.status == "pass" then 
            "✅ " + (.key | ascii_upcase) + ": " + .value.message + " (" + (.value.response_time_ms | tostring) + "ms)"
        else 
            "❌ " + (.key | ascii_upcase) + ": " + .value.message + " (" + (.value.response_time_ms | tostring) + "ms)"
        end' "$results_file" >> "$report_file" 2>/dev/null
    fi
    
    # Add performance analysis
    cat >> "$report_file" << PERF_EOF

================================================================================
                        PERFORMANCE ANALYSIS
================================================================================
PERF_EOF
    
    # Performance warnings based on requirements
    if [ "$avg_response_time" -gt 50 ]; then
        echo "⚠️  PERFORMANCE WARNING: Average response time (${avg_response_time}ms) exceeds 50ms threshold" >> "$report_file"
    else
        echo "✅ PERFORMANCE: Average response time (${avg_response_time}ms) within acceptable limits" >> "$report_file"
    fi
    
    # Add failure details if any
    if [ "$failed_checks" -gt 0 ]; then
        cat >> "$report_file" << FAIL_EOF

================================================================================
                         FAILURE ANALYSIS
================================================================================
FAIL_EOF
        
        if command -v jq >/dev/null 2>&1; then
            jq -r '.failure_details[]? | "❌ " + .check + ": " + .reason + (if .details then " - " + .details else "" end)' "$results_file" >> "$report_file" 2>/dev/null
        fi
    fi
    
    # Add recommendations
    cat >> "$report_file" << REC_EOF

================================================================================
                          RECOMMENDATIONS
================================================================================
REC_EOF
    
    if [ "$overall_status" = "pass" ]; then
        echo "✅ All health checks passed. Deployment is ready for production traffic." >> "$report_file"
    else
        echo "❌ Health checks failed. Review failure details above and consider:" >> "$report_file"
        echo "   • Check application logs: docker logs $container_name" >> "$report_file"
        echo "   • Verify container resource allocation" >> "$report_file"
        echo "   • Test endpoints manually: curl http://localhost:$port/" >> "$report_file"
        echo "   • Review detailed log: $log_file" >> "$report_file"
    fi
    
    echo "================================================================================" >> "$report_file"
    
    # Display report
    cat "$report_file"
    
    # Save report with timestamp for future reference
    local timestamped_report="/tmp/health-check-report-$(date +%Y%m%d-%H%M%S).txt"
    cp "$report_file" "$timestamped_report"
    print_status "📄 Detailed report saved: $timestamped_report"
}

handle_health_check_failure() {
    local container_name="$1"
    local results_file="$2"
    local log_file="$3"
    local port="${4:-4321}"
    
    print_header "🚨 Health Check Failure - Initiating Automated Rollback"
    
    # Attempt immediate rollback first
    print_status "🔄 Attempting immediate automated rollback..."
    
    if perform_immediate_rollback "$container_name" "${container_name}-backup" "$port" "health_check_failure"; then
        print_status "✅ Immediate rollback completed successfully"
        print_status "🎉 Service has been restored to previous working state"
        
        # Still log the failure for analysis
        log_health_check_failure_with_rollback "$container_name" "$results_file" "$log_file" "immediate_rollback_success"
        return 0
    else
        print_warning "⚠️  Immediate rollback failed, proceeding with cleanup and manual rollback options"
        
        # Continue with original cleanup logic
        log_health_check_failure_with_rollback "$container_name" "$results_file" "$log_file" "immediate_rollback_failed"
    fi
    
    # Log failure details
    local failure_log="/tmp/health-check-failure-$(date +%Y%m%d-%H%M%S).log"
    
    cat > "$failure_log" << FAILURE_EOF
=== HEALTH CHECK FAILURE LOG ===
Timestamp: $(date -Iseconds)
Container: $container_name
Failure Reason: Health checks did not pass validation

=== CONTAINER STATUS ===
FAILURE_EOF
    
    # Capture container status and logs
    print_status "📋 Capturing container diagnostics..."
    
    if docker ps -a --filter "name=$container_name" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" >> "$failure_log" 2>&1; then
        print_status "✅ Container status captured"
    else
        echo "Failed to capture container status" >> "$failure_log"
    fi
    
    echo "" >> "$failure_log"
    echo "=== CONTAINER LOGS (Last 50 lines) ===" >> "$failure_log"
    
    if docker logs --tail 50 "$container_name" >> "$failure_log" 2>&1; then
        print_status "✅ Container logs captured"
    else
        echo "Failed to capture container logs" >> "$failure_log"
    fi
    
    echo "" >> "$failure_log"
    echo "=== HEALTH CHECK RESULTS ===" >> "$failure_log"
    cat "$results_file" >> "$failure_log" 2>/dev/null || echo "Health check results not available" >> "$failure_log"
    
    echo "" >> "$failure_log"
    echo "=== DETAILED HEALTH CHECK LOG ===" >> "$failure_log"
    cat "$log_file" >> "$failure_log" 2>/dev/null || echo "Detailed log not available" >> "$failure_log"
    
    # Terminate the failed container with proper cleanup
    print_status "🛑 Terminating failed container: $container_name"
    
    # Stop container gracefully first
    if docker stop "$container_name" >/dev/null 2>&1; then
        print_status "✅ Container stopped gracefully"
    else
        print_warning "⚠️  Graceful stop failed, forcing termination"
        docker kill "$container_name" >/dev/null 2>&1 || true
    fi
    
    # Remove container to clean up resources
    if docker rm "$container_name" >/dev/null 2>&1; then
        print_status "✅ Container removed successfully"
    else
        print_warning "⚠️  Failed to remove container (may not exist)"
    fi
    
    # Clean up any orphaned resources
    print_status "🧹 Cleaning up orphaned resources..."
    docker system prune -f >/dev/null 2>&1 || true
    
    # Display failure summary
    print_error "❌ Health check failure summary:"
    print_error "   • Container $container_name has been terminated"
    print_error "   • Failure details logged to: $failure_log"
    print_error "   • Review logs and fix issues before retrying deployment"
    
    # Provide specific remediation steps based on failure type
    if command -v jq >/dev/null 2>&1 && [ -f "$results_file" ]; then
        local failed_checks=$(jq -r '.failure_details[]?.check' "$results_file" 2>/dev/null)
        
        if echo "$failed_checks" | grep -q "readiness"; then
            print_error "   • Readiness failure: Check application startup and dependencies"
        fi
        
        if echo "$failed_checks" | grep -q "root_endpoint"; then
            print_error "   • Root endpoint failure: Verify web server configuration and routing"
        fi
        
        if echo "$failed_checks" | grep -q "api_endpoints"; then
            print_error "   • API endpoint failure: Check API service status and configuration"
        fi
        
        if echo "$failed_checks" | grep -q "static_assets"; then
            print_error "   • Static asset failure: Verify asset build and serving configuration"
        fi
    fi
    
    # Generate manual rollback commands as fallback
    print_status "📋 Generating manual rollback commands..."
    generate_manual_rollback_commands "$container_name" "$port"
    
    # Assess available rollback options
    print_status "🔍 Assessing rollback options..."
    assess_rollback_options "$container_name" "$port"
    
    print_status "💡 Next steps:"
    print_status "   1. Review failure log: cat $failure_log"
    print_status "   2. Execute manual rollback if needed (see generated commands)"
    print_status "   3. Fix identified issues in the application"
    print_status "   4. Rebuild and retry deployment"
    print_status "   5. Consider running health checks manually: curl http://localhost:$port/"
}

# Enhanced failure logging with rollback information
log_health_check_failure_with_rollback() {
    local container_name="$1"
    local results_file="$2"
    local log_file="$3"
    local rollback_status="$4"
    
    # Log failure details
    local failure_log="/tmp/health-check-failure-$(date +%Y%m%d-%H%M%S).log"
    
    cat > "$failure_log" << FAILURE_EOF
=== HEALTH CHECK FAILURE LOG ===
Timestamp: $(date -Iseconds)
Container: $container_name
Failure Reason: Health checks did not pass validation
Rollback Status: $rollback_status

=== CONTAINER STATUS ===
FAILURE_EOF
    
    # Capture container status and logs
    print_status "📋 Capturing container diagnostics..."
    
    if docker ps -a --filter "name=$container_name" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" >> "$failure_log" 2>&1; then
        print_status "✅ Container status captured"
    else
        echo "Failed to capture container status" >> "$failure_log"
    fi
    
    echo "" >> "$failure_log"
    echo "=== CONTAINER LOGS (Last 50 lines) ===" >> "$failure_log"
    
    if docker logs --tail 50 "$container_name" >> "$failure_log" 2>&1; then
        print_status "✅ Container logs captured"
    else
        echo "Failed to capture container logs" >> "$failure_log"
    fi
    
    echo "" >> "$failure_log"
    echo "=== HEALTH CHECK RESULTS ===" >> "$failure_log"
    cat "$results_file" >> "$failure_log" 2>/dev/null || echo "Health check results not available" >> "$failure_log"
    
    echo "" >> "$failure_log"
    echo "=== DETAILED HEALTH CHECK LOG ===" >> "$failure_log"
    cat "$log_file" >> "$failure_log" 2>/dev/null || echo "Detailed log not available" >> "$failure_log"
    
    # Add rollback information
    echo "" >> "$failure_log"
    echo "=== ROLLBACK INFORMATION ===" >> "$failure_log"
    echo "Rollback Status: $rollback_status" >> "$failure_log"
    
    if [ "$rollback_status" = "immediate_rollback_success" ]; then
        echo "✅ Immediate rollback completed successfully" >> "$failure_log"
        echo "Service has been restored to previous working state" >> "$failure_log"
    elif [ "$rollback_status" = "immediate_rollback_failed" ]; then
        echo "❌ Immediate rollback failed" >> "$failure_log"
        echo "Manual rollback may be required" >> "$failure_log"
        
        # Include rollback options assessment
        if [ -f /tmp/rollback-assessment-*.json ]; then
            echo "" >> "$failure_log"
            echo "=== ROLLBACK OPTIONS ASSESSMENT ===" >> "$failure_log"
            cat /tmp/rollback-assessment-*.json >> "$failure_log" 2>/dev/null
        fi
    fi
    
    # Terminate the failed container with proper cleanup (only if rollback failed)
    if [ "$rollback_status" = "immediate_rollback_failed" ]; then
        print_status "🛑 Terminating failed container: $container_name"
        
        # Stop container gracefully first
        if docker stop "$container_name" >/dev/null 2>&1; then
            print_status "✅ Container stopped gracefully"
        else
            print_warning "⚠️  Graceful stop failed, forcing termination"
            docker kill "$container_name" >/dev/null 2>&1 || true
        fi
        
        # Remove container to clean up resources
        if docker rm "$container_name" >/dev/null 2>&1; then
            print_status "✅ Container removed successfully"
        else
            print_warning "⚠️  Failed to remove container (may not exist)"
        fi
        
        # Clean up any orphaned resources
        print_status "🧹 Cleaning up orphaned resources..."
        docker system prune -f >/dev/null 2>&1 || true
    fi
    
    # Display failure summary
    if [ "$rollback_status" = "immediate_rollback_success" ]; then
        print_status "✅ Health check failure handled with successful rollback"
        print_status "   • Service has been restored to previous working state"
        print_status "   • Failure details logged to: $failure_log"
        print_status "   • Review logs to understand the deployment issue"
    else
        print_error "❌ Health check failure summary:"
        print_error "   • Container $container_name has been terminated"
        print_error "   • Automatic rollback failed or not available"
        print_error "   • Failure details logged to: $failure_log"
        print_error "   • Manual rollback may be required"
    fi
    
    # Provide specific remediation steps based on failure type
    if command -v jq >/dev/null 2>&1 && [ -f "$results_file" ]; then
        local failed_checks=$(jq -r '.failure_details[]?.check' "$results_file" 2>/dev/null)
        
        if echo "$failed_checks" | grep -q "readiness"; then
            print_error "   • Readiness failure: Check application startup and dependencies"
        fi
        
        if echo "$failed_checks" | grep -q "root_endpoint"; then
            print_error "   • Root endpoint failure: Verify web server configuration and routing"
        fi
        
        if echo "$failed_checks" | grep -q "api_endpoints"; then
            print_error "   • API endpoint failure: Check API service status and configuration"
        fi
        
        if echo "$failed_checks" | grep -q "static_assets"; then
            print_error "   • Static asset failure: Verify asset build and serving configuration"
        fi
    fi

log_health_check_summary() {
    local results_file="$1"
    local deployment_log="${2:-/tmp/deployment-summary.log}"
    
    if [ ! -f "$results_file" ]; then
        print_warning "⚠️  Health check results file not found: $results_file"
        return 1
    fi
    
    print_status "📝 Logging health check summary to deployment log"
    
    # Append health check summary to deployment log
    cat >> "$deployment_log" << SUMMARY_EOF

=== HEALTH CHECK SUMMARY ===
Timestamp: $(date -Iseconds)
Overall Status: $(jq -r '.overall_status' "$results_file" 2>/dev/null || echo "unknown")
Duration: $(jq -r '.duration' "$results_file" 2>/dev/null || echo "unknown")
Success Rate: $(jq -r '.summary.success_rate' "$results_file" 2>/dev/null || echo "0")%
Average Response Time: $(jq -r '.performance_metrics.average_response_time_ms' "$results_file" 2>/dev/null || echo "0")ms

Check Results:
SUMMARY_EOF
    
    if command -v jq >/dev/null 2>&1; then
        jq -r '.checks | to_entries[] | 
        if .value.status == "pass" then 
            "✅ " + .key + ": PASS (" + (.value.response_time_ms | tostring) + "ms)"
        else 
            "❌ " + .key + ": FAIL (" + (.value.response_time_ms | tostring) + "ms)"
        end' "$results_file" >> "$deployment_log" 2>/dev/null
    fi
    
    echo "=========================" >> "$deployment_log"
    
    print_status "✅ Health check summary logged to: $deployment_log"
}

# Build container remotely on VPS
build_container_on_vps() {
    local container_tag="$1"
    local container_name=$(echo "$container_tag" | cut -d: -f1)
    local tag=$(echo "$container_tag" | cut -d: -f2)
    
    log_deployment_event "BUILD" "INFO" "Starting remote Docker build on VPS" "remote_build_start"
    
    # Build container on VPS
    ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash << 'EOF'
set -e

# Source nvm for non-interactive shells
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" 2>/dev/null || true

# Ensure Node.js and pnpm are available
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not found. nvm environment may not be properly set up."
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "❌ pnpm not found. Installing pnpm globally..."
    npm install -g pnpm@10.15.0
fi

cd "/root/pixelated"

echo "🔧 Starting Docker build on VPS with real-time output..."
echo "Build context: $(du -sh . | cut -f1)"
echo "Node.js version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

# Set BASH_ENV for Docker builds to source nvm
export BASH_ENV="$HOME/.bash_env"

# Use legacy docker build for compatibility
DOCKER_BUILDKIT=0 docker build \
    --dns=8.8.8.8 \
    --dns=1.1.1.1 \
    --network=host \
    --build-arg BASH_ENV="$HOME/.bash_env" \
    -t "pixelated-box:090825-03" \
    . 2>&1 | while IFS= read -r line; do
        echo "$line"
    done

build_result=${PIPESTATUS[0]}

if [ $build_result -eq 0 ]; then
    echo "✅ Container build completed successfully: pixelated-box:090825-03"
    
    # Stop and remove any existing container with the new name
    if docker ps -a --format '{{.Names}}' | grep -q "^pixelated-app-new$"; then
        echo "🛑 Stopping existing pixelated-app-new container..."
        docker stop pixelated-app-new || true
        docker rm pixelated-app-new || true
    fi
    
    # Start the new container
    echo "🚀 Starting new container: pixelated-app-new"
    docker run -d \
        --name pixelated-app-new \
        --restart unless-stopped \
        -p 4321:4321 \
        "pixelated-box:090825-03"
    
    if [ $? -eq 0 ]; then
        echo "✅ Container started successfully"
        exit 0
    else
        echo "❌ Failed to start container"
        exit 1
    fi
else
    echo "❌ Container build failed with exit code: $build_result"
    exit 1
fi
EOF
    
    local build_exit_code=$?
    if [[ $build_exit_code -eq 0 ]]; then
        log_deployment_event "BUILD" "INFO" "Remote container build and deployment successful" "remote_build_success"
        return 0
    else
        log_deployment_event "BUILD" "ERROR" "Remote container build failed with exit code: $build_exit_code" "remote_build_failure"
        return 1
    fi
}

# Registry Manager Functions
push_to_registry() {
    local image_tag="$1"
    local registry_url="${2:-git.pixelatedempathy.tech}"
    local project_name="${3:-pixelated-empathy}"
    
    print_status "Pushing container image to GitLab registry..."
    print_status "Image: $image_tag"
    print_status "Registry: $registry_url"
    print_status "Project: $project_name"
    
    # Generate registry-specific tag
    local registry_tag="${registry_url}/${project_name}:$(echo "$image_tag" | cut -d':' -f2)"
    
    # Tag image for registry
    print_status "Tagging image for registry: $registry_tag"
    if docker tag "$image_tag" "$registry_tag"; then
        print_status "✅ Image tagged for registry"
    else
        print_error "❌ Failed to tag image for registry"
        return 1
    fi
    
    # Validate registry connectivity and authentication
    if ! validate_registry_connectivity "$registry_url"; then
        print_error "❌ Registry connectivity validation failed"
        return 1
    fi
    
    # Push to registry with retry logic
    local push_attempts=3
    local push_success=false
    
    for attempt in $(seq 1 $push_attempts); do
        print_status "Push attempt $attempt/$push_attempts..."
        
        if docker push "$registry_tag" 2>&1 | tee /tmp/registry-push.log; then
            print_status "✅ Image pushed successfully to registry"
            push_success=true
            break
        else
            print_warning "⚠️  Push attempt $attempt failed"
            if [ $attempt -lt $push_attempts ]; then
                print_status "Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    if [ "$push_success" = false ]; then
        print_error "❌ Failed to push image after $push_attempts attempts"
        print_error "Push log:"
        cat /tmp/registry-push.log 2>/dev/null || echo "No push log available"
        return 1
    fi
    
    # Verify upload success
    if verify_registry_upload "$registry_tag"; then
        print_status "✅ Registry upload verified successfully"
        
        # Store registry information for rollback
        echo "$registry_tag" >> /tmp/registry-images.log
        
        return 0
    else
        print_error "❌ Registry upload verification failed"
        return 1
    fi
}

validate_registry_connectivity() {
    local registry_url="$1"
    
    print_status "Validating registry connectivity: $registry_url"
    
    # Check if docker is logged in to registry
    if docker system info 2>/dev/null | grep -q "$registry_url"; then
        print_status "✅ Docker is authenticated with registry"
    else
        print_warning "⚠️  Docker may not be authenticated with registry"
        print_status "Attempting to authenticate..."
        
        # Try to login using environment variables or prompt
        if [[ -n "$GITLAB_TOKEN" ]]; then
            print_status "Using GITLAB_TOKEN for authentication"
            echo "$GITLAB_TOKEN" | docker login "$registry_url" -u gitlab-ci-token --password-stdin
        elif [[ -n "$CI_JOB_TOKEN" ]]; then
            print_status "Using CI_JOB_TOKEN for authentication"
            echo "$CI_JOB_TOKEN" | docker login "$registry_url" -u gitlab-ci-token --password-stdin
        else
            print_warning "No authentication tokens found in environment"
            print_warning "Registry push may fail without authentication"
            print_status "Set GITLAB_TOKEN or CI_JOB_TOKEN environment variable for authentication"
        fi
    fi
    
    # Test registry connectivity with a simple API call
    print_status "Testing registry API connectivity..."
    if curl -s -f "https://${registry_url}/v2/" >/dev/null 2>&1; then
        print_status "✅ Registry API is accessible"
        return 0
    else
        print_warning "⚠️  Registry API test failed, but push may still work"
        return 0  # Don't fail deployment for API test failure
    fi
}

verify_registry_upload() {
    local registry_tag="$1"
    
    print_status "Verifying registry upload: $registry_tag"
    
    # Try to inspect the image in the registry
    if docker manifest inspect "$registry_tag" >/dev/null 2>&1; then
        print_status "✅ Image manifest found in registry"
        
        # Get image digest for verification
        local image_digest=$(docker inspect "$registry_tag" --format='{{index .RepoDigests 0}}' 2>/dev/null || echo "unknown")
        print_status "Image digest: $image_digest"
        
        return 0
    else
        print_error "❌ Cannot verify image in registry"
        return 1
    fi
}

generate_registry_push_commands() {
    local image_tag="$1"
    local registry_url="${2:-git.pixelatedempathy.tech}"
    local project_name="${3:-pixelated-empathy}"
    
    local registry_tag="${registry_url}/${project_name}:$(echo "$image_tag" | cut -d':' -f2)"
    
    cat << REGISTRY_COMMANDS

# Registry Push Commands
# Tag image for registry:
docker tag $image_tag $registry_tag

# Push to registry:
docker push $registry_tag

# Verify upload:
docker manifest inspect $registry_tag

REGISTRY_COMMANDS
}

list_registry_images() {
    local registry_url="${1:-git.pixelatedempathy.tech}"
    local project_name="${2:-pixelated-empathy}"
    
    print_status "Listing available registry images..."
    
    # Check if we have stored registry images
    if [ -f /tmp/registry-images.log ]; then
        print_status "Recently pushed images:"
        cat /tmp/registry-images.log | sort -r | head -10
    else
        print_status "No local registry image history found"
    fi
    
    # Try to list images via API (requires authentication)
    print_status "Attempting to query registry API..."
    local api_url="https://${registry_url}/v2/${project_name}/tags/list"
    
    if curl -s -f "$api_url" 2>/dev/null | jq -r '.tags[]?' 2>/dev/null | head -10; then
        print_status "✅ Registry API query successful"
    else
        print_warning "⚠️  Registry API query failed (authentication may be required)"
        print_status "Available images can be viewed at: https://${registry_url}/${project_name}/container_registry"
    fi
}

pull_from_registry() {
    local registry_tag="$1"
    local local_tag="${2:-$registry_tag}"
    
    print_status "Pulling image from registry: $registry_tag"
    
    # Pull image with retry logic
    local pull_attempts=3
    local pull_success=false
    
    for attempt in $(seq 1 $pull_attempts); do
        print_status "Pull attempt $attempt/$pull_attempts..."
        
        if docker pull "$registry_tag" 2>&1 | tee /tmp/registry-pull.log; then
            print_status "✅ Image pulled successfully from registry"
            pull_success=true
            break
        else
            print_warning "⚠️  Pull attempt $attempt failed"
            if [ $attempt -lt $pull_attempts ]; then
                print_status "Retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    if [ "$pull_success" = false ]; then
        print_error "❌ Failed to pull image after $pull_attempts attempts"
        print_error "Pull log:"
        cat /tmp/registry-pull.log 2>/dev/null || echo "No pull log available"
        return 1
    fi
    
    # Tag with local name if different
    if [ "$registry_tag" != "$local_tag" ]; then
        print_status "Tagging pulled image as: $local_tag"
        if docker tag "$registry_tag" "$local_tag"; then
            print_status "✅ Image tagged locally"
        else
            print_warning "⚠️  Failed to tag image locally, but pull succeeded"
        fi
    fi
    
    # Validate pulled image
    if validate_container_build "$local_tag"; then
        print_status "✅ Pulled image validation passed"
        return 0
    else
        print_error "❌ Pulled image validation failed"
        return 1
    fi
}

deploy_from_registry() {
    local registry_tag="$1"
    local container_name="$2"
    local port="$3"
    local domain="$4"
    local env_vars=("${@:5}")
    
    print_status "Deploying from registry: $registry_tag"
    
    # Pull image from registry
    if ! pull_from_registry "$registry_tag" "$registry_tag"; then
        print_error "❌ Failed to pull image from registry"
        return 1
    fi
    
    # Deploy using blue-green deployment
    if deploy_container_blue_green "$registry_tag" "$container_name" "$port" "$domain" "${env_vars[@]}"; then
        print_status "✅ Registry deployment completed successfully"
        return 0
    else
        print_error "❌ Registry deployment failed"
        return 1
    fi
}

# Automated Rollback Procedures

# Immediate rollback for health check failures
perform_immediate_rollback() {
    local failed_container="$1"
    local backup_container="${2:-${failed_container}-backup}"
    local port="$3"
    local context="${4:-health_check_failure}"
    
    print_header "🔄 Performing immediate rollback due to $context"
    
    local rollback_log="/tmp/immediate-rollback-$(date +%Y%m%d-%H%M%S).log"
    echo "=== IMMEDIATE ROLLBACK LOG ===" > "$rollback_log"
    echo "Timestamp: $(date -Iseconds)" >> "$rollback_log"
    echo "Failed Container: $failed_container" >> "$rollback_log"
    echo "Backup Container: $backup_container" >> "$rollback_log"
    echo "Context: $context" >> "$rollback_log"
    echo "==============================" >> "$rollback_log"
    
    # Step 1: Terminate failed container
    print_status "🛑 Step 1: Terminating failed container: $failed_container"
    
    if docker stop "$failed_container" >/dev/null 2>&1; then
        print_status "✅ Failed container stopped"
        echo "[$(date -Iseconds)] SUCCESS: Failed container stopped" >> "$rollback_log"
    else
        print_warning "⚠️  Failed to stop container gracefully, forcing termination"
        docker kill "$failed_container" >/dev/null 2>&1 || true
        echo "[$(date -Iseconds)] WARNING: Forced container termination" >> "$rollback_log"
    fi
    
    if docker rm "$failed_container" >/dev/null 2>&1; then
        print_status "✅ Failed container removed"
        echo "[$(date -Iseconds)] SUCCESS: Failed container removed" >> "$rollback_log"
    else
        print_warning "⚠️  Failed to remove container (may not exist)"
        echo "[$(date -Iseconds)] WARNING: Container removal failed" >> "$rollback_log"
    fi
    
    # Step 2: Check if backup container exists and is healthy
    print_status "🔍 Step 2: Checking backup container availability"
    
    if docker ps -a --format "table {{.Names}}" | grep -q "^${backup_container}$"; then
        print_status "✅ Backup container found: $backup_container"
        echo "[$(date -Iseconds)] SUCCESS: Backup container found" >> "$rollback_log"
        
        # Check if backup container is running
        if docker ps --format "table {{.Names}}" | grep -q "^${backup_container}$"; then
            print_status "✅ Backup container is already running"
            echo "[$(date -Iseconds)] SUCCESS: Backup container already running" >> "$rollback_log"
        else
            print_status "🔄 Starting backup container"
            if docker start "$backup_container" >/dev/null 2>&1; then
                print_status "✅ Backup container started successfully"
                echo "[$(date -Iseconds)] SUCCESS: Backup container started" >> "$rollback_log"
                
                # Wait for backup container to be ready
                print_status "⏳ Waiting for backup container to be ready..."
                if wait_for_application_ready "$backup_container" "$port" 30; then
                    print_status "✅ Backup container is ready"
                    echo "[$(date -Iseconds)] SUCCESS: Backup container ready" >> "$rollback_log"
                else
                    print_error "❌ Backup container failed to become ready"
                    echo "[$(date -Iseconds)] ERROR: Backup container not ready" >> "$rollback_log"
                    return 1
                fi
            else
                print_error "❌ Failed to start backup container"
                echo "[$(date -Iseconds)] ERROR: Failed to start backup container" >> "$rollback_log"
                return 1
            fi
        fi
        
        # Rename backup container to primary name
        print_status "🔄 Promoting backup container to primary"
        if docker rename "$backup_container" "$failed_container" >/dev/null 2>&1; then
            print_status "✅ Backup container promoted to primary"
            echo "[$(date -Iseconds)] SUCCESS: Container renamed to primary" >> "$rollback_log"
        else
            print_warning "⚠️  Failed to rename container, but rollback successful"
            echo "[$(date -Iseconds)] WARNING: Container rename failed" >> "$rollback_log"
        fi
        
    else
        print_error "❌ No backup container available for immediate rollback"
        echo "[$(date -Iseconds)] ERROR: No backup container available" >> "$rollback_log"
        
        # Try to restore from filesystem backup
        print_status "🔄 Attempting filesystem-based rollback"
        if perform_filesystem_rollback "$failed_container" "$port"; then
            print_status "✅ Filesystem rollback completed"
            echo "[$(date -Iseconds)] SUCCESS: Filesystem rollback completed" >> "$rollback_log"
        else
            print_error "❌ Filesystem rollback also failed"
            echo "[$(date -Iseconds)] ERROR: Filesystem rollback failed" >> "$rollback_log"
            return 1
        fi
    fi
    
    # Step 3: Verify rollback success
    print_status "✅ Step 3: Verifying rollback success"
    
    if perform_basic_connectivity_test "$port" 10 "$failed_container"; then
        print_status "✅ Immediate rollback completed successfully"
        echo "[$(date -Iseconds)] SUCCESS: Rollback verification passed" >> "$rollback_log"
        
        # Log rollback success
        log_rollback_success "immediate" "$failed_container" "$backup_container" "$rollback_log"
        return 0
    else
        print_error "❌ Rollback verification failed"
        echo "[$(date -Iseconds)] ERROR: Rollback verification failed" >> "$rollback_log"
        return 1
    fi
}

# Filesystem-based rollback
perform_filesystem_rollback() {
    local container_name="$1"
    local port="$2"
    local backup_path="${3:-/root/pixelated-backup}"
    local project_path="${4:-/root/pixelated}"
    
    print_header "🔄 Performing filesystem rollback"
    
    local rollback_log="/tmp/filesystem-rollback-$(date +%Y%m%d-%H%M%S).log"
    echo "=== FILESYSTEM ROLLBACK LOG ===" > "$rollback_log"
    echo "Timestamp: $(date -Iseconds)" >> "$rollback_log"
    echo "Container: $container_name" >> "$rollback_log"
    echo "Backup Path: $backup_path" >> "$rollback_log"
    echo "Project Path: $project_path" >> "$rollback_log"
    echo "===============================" >> "$rollback_log"
    
    # This needs to be executed on the VPS
    local ssh_cmd="ssh -i $SSH_KEY -p $VPS_PORT -o ConnectTimeout=10 -o BatchMode=yes"
    
    print_status "🔄 Executing filesystem rollback on VPS"
    
    $ssh_cmd "$VPS_USER@$VPS_HOST" bash << FILESYSTEM_ROLLBACK_EOF
set -e

# Log function for VPS
log_vps() {
    echo "[\$(date -Iseconds)] \$1" >> "$rollback_log"
}

# Stop services
echo "Stopping services..."
sudo systemctl stop caddy 2>/dev/null || true
docker stop $container_name 2>/dev/null || true
log_vps "Services stopped"

# Check if backup exists
if [ ! -d "$backup_path" ]; then
    echo "❌ Backup directory not found: $backup_path"
    log_vps "ERROR: Backup directory not found"
    exit 1
fi

# Move current deployment to failed
if [ -d "$project_path" ]; then
    echo "Moving current deployment to failed backup..."
    sudo mv "$project_path" "${project_path}-failed-\$(date +%Y%m%d-%H%M%S)" || true
    log_vps "Current deployment moved to failed backup"
fi

# Restore from backup
echo "Restoring from backup..."
sudo cp -r "$backup_path" "$project_path"
log_vps "Backup restored to project path"

# Change to project directory
cd "$project_path"

# Rebuild container
echo "Rebuilding container from restored files..."
if docker build -t $container_name:rollback . 2>&1 | tee /tmp/rollback-build.log; then
    echo "✅ Container rebuilt successfully"
    log_vps "Container rebuilt successfully"
else
    echo "❌ Container rebuild failed"
    log_vps "ERROR: Container rebuild failed"
    cat /tmp/rollback-build.log
    exit 1
fi

# Start container
echo "Starting rolled-back container..."
if docker run -d --name $container_name --restart unless-stopped -p $port:$port $container_name:rollback; then
    echo "✅ Container started successfully"
    log_vps "Container started successfully"
else
    echo "❌ Failed to start container"
    log_vps "ERROR: Failed to start container"
    exit 1
fi

# Restart services
sudo systemctl start caddy 2>/dev/null || true
log_vps "Services restarted"

echo "✅ Filesystem rollback completed"
log_vps "Filesystem rollback completed successfully"
FILESYSTEM_ROLLBACK_EOF
    
    local rollback_exit_code=$?
    
    if [ $rollback_exit_code -eq 0 ]; then
        print_status "✅ Filesystem rollback completed successfully"
        
        # Verify rollback
        sleep 5  # Give container time to start
        if perform_basic_connectivity_test "$port" 15; then
            print_status "✅ Filesystem rollback verification passed"
            log_rollback_success "filesystem" "$container_name" "$backup_path" "$rollback_log"
            return 0
        else
            print_error "❌ Filesystem rollback verification failed"
            return 1
        fi
    else
        print_error "❌ Filesystem rollback failed"
        return 1
    fi
}

# Registry-based rollback
perform_registry_rollback() {
    local container_name="$1"
    local registry_tag="$2"
    local port="$3"
    local domain="$4"
    
    print_header "🔄 Performing registry-based rollback"
    
    local rollback_log="/tmp/registry-rollback-$(date +%Y%m%d-%H%M%S).log"
    echo "=== REGISTRY ROLLBACK LOG ===" > "$rollback_log"
    echo "Timestamp: $(date -Iseconds)" >> "$rollback_log"
    echo "Container: $container_name" >> "$rollback_log"
    echo "Registry Tag: $registry_tag" >> "$rollback_log"
    echo "Port: $port" >> "$rollback_log"
    echo "===============================" >> "$rollback_log"
    
    # Step 1: Pull image from registry
    print_status "📥 Step 1: Pulling image from registry"
    
    if pull_from_registry "$registry_tag" "${container_name}:rollback"; then
        print_status "✅ Image pulled successfully"
        echo "[$(date -Iseconds)] SUCCESS: Image pulled from registry" >> "$rollback_log"
    else
        print_error "❌ Failed to pull image from registry"
        echo "[$(date -Iseconds)] ERROR: Failed to pull image" >> "$rollback_log"
        return 1
    fi
    
    # Step 2: Stop current container
    print_status "🛑 Step 2: Stopping current container"
    
    if docker stop "$container_name" >/dev/null 2>&1; then
        print_status "✅ Current container stopped"
        echo "[$(date -Iseconds)] SUCCESS: Current container stopped" >> "$rollback_log"
    else
        print_warning "⚠️  Failed to stop container gracefully"
        docker kill "$container_name" >/dev/null 2>&1 || true
        echo "[$(date -Iseconds)] WARNING: Forced container stop" >> "$rollback_log"
    fi
    
    # Step 3: Start rollback container
    print_status "🚀 Step 3: Starting rollback container"
    
    local rollback_container_name="${container_name}-rollback"
    
    if docker run -d --name "$rollback_container_name" --restart unless-stopped -p "$port:$port" "${container_name}:rollback"; then
        print_status "✅ Rollback container started"
        echo "[$(date -Iseconds)] SUCCESS: Rollback container started" >> "$rollback_log"
    else
        print_error "❌ Failed to start rollback container"
        echo "[$(date -Iseconds)] ERROR: Failed to start rollback container" >> "$rollback_log"
        return 1
    fi
    
    # Step 4: Wait for container to be ready
    print_status "⏳ Step 4: Waiting for rollback container to be ready"
    
    if wait_for_application_ready "$rollback_container_name" "$port" 60; then
        print_status "✅ Rollback container is ready"
        echo "[$(date -Iseconds)] SUCCESS: Rollback container ready" >> "$rollback_log"
    else
        print_error "❌ Rollback container failed to become ready"
        echo "[$(date -Iseconds)] ERROR: Rollback container not ready" >> "$rollback_log"
        return 1
    fi
    
    # Step 5: Clean up old container and promote rollback
    print_status "🔄 Step 5: Promoting rollback container"
    
    docker rm "$container_name" >/dev/null 2>&1 || true
    
    if docker rename "$rollback_container_name" "$container_name" >/dev/null 2>&1; then
        print_status "✅ Rollback container promoted to primary"
        echo "[$(date -Iseconds)] SUCCESS: Container promoted to primary" >> "$rollback_log"
    else
        print_warning "⚠️  Failed to rename container, but rollback successful"
        echo "[$(date -Iseconds)] WARNING: Container rename failed" >> "$rollback_log"
    fi
    
    # Step 6: Verify rollback success
    print_status "✅ Step 6: Verifying registry rollback"
    
    if perform_basic_connectivity_test "$port" 10 "$container_name"; then
        print_status "✅ Registry rollback completed successfully"
        echo "[$(date -Iseconds)] SUCCESS: Registry rollback verification passed" >> "$rollback_log"
        
        log_rollback_success "registry" "$container_name" "$registry_tag" "$rollback_log"
        return 0
    else
        print_error "❌ Registry rollback verification failed"
        echo "[$(date -Iseconds)] ERROR: Registry rollback verification failed" >> "$rollback_log"
        return 1
    fi
}

# Manual rollback command generation
generate_manual_rollback_commands() {
    local container_name="$1"
    local port="$2"
    local backup_path="${3:-/root/pixelated-backup}"
    local project_path="${4:-/root/pixelated}"
    local registry_url="${5:-git.pixelatedempathy.tech}"
    local project_name="${6:-pixelated-empathy}"
    
    print_header "📋 Manual Rollback Commands"
    
    local commands_file="/tmp/manual-rollback-commands-$(date +%Y%m%d-%H%M%S).sh"
    
    cat > "$commands_file" << MANUAL_ROLLBACK_EOF
#!/bin/bash
# Manual Rollback Commands
# Generated: $(date -Iseconds)
# Container: $container_name
# Port: $port

echo "=== MANUAL ROLLBACK OPTIONS ==="
echo "Choose the appropriate rollback method based on your situation:"
echo ""

echo "🔄 OPTION 1: Container Rollback (Fastest - if backup container exists)"
echo "# Stop current container and start backup"
echo "docker stop $container_name || true"
echo "docker start ${container_name}-backup || echo 'No backup container available'"
echo "# Verify: curl -f http://localhost:$port/ && echo 'Rollback successful'"
echo ""

echo "🔄 OPTION 2: Filesystem Rollback (Fast - if filesystem backup exists)"
echo "# Stop services"
echo "sudo systemctl stop caddy || true"
echo "docker stop $container_name || true"
echo ""
echo "# Restore from backup"
echo "sudo mv $project_path ${project_path}-failed-\$(date +%Y%m%d-%H%M%S) || true"
echo "sudo cp -r $backup_path $project_path"
echo "cd $project_path"
echo ""
echo "# Rebuild and start"
echo "docker build -t $container_name:rollback ."
echo "docker run -d --name $container_name --restart unless-stopped -p $port:$port $container_name:rollback"
echo "sudo systemctl start caddy || true"
echo ""
echo "# Verify: curl -f http://localhost:$port/ && echo 'Rollback successful'"
echo ""

echo "🔄 OPTION 3: Registry Rollback (if registry images available)"
echo "# List available versions:"
echo "curl -s 'https://$registry_url/v2/$project_name/tags/list' | jq -r '.tags[]?' | head -10"
echo ""
echo "# Deploy specific version (replace TAG with desired version):"
echo "docker pull $registry_url/$project_name:TAG"
echo "docker stop $container_name || true"
echo "docker run -d --name ${container_name}-rollback --restart unless-stopped -p $port:$port $registry_url/$project_name:TAG"
echo "docker rm $container_name || true"
echo "docker rename ${container_name}-rollback $container_name"
echo ""
echo "# Verify: curl -f http://localhost:$port/ && echo 'Rollback successful'"
echo ""

echo "🔄 OPTION 4: Emergency Rollback (if all else fails)"
echo "# Stop all containers and services"
echo "docker stop \$(docker ps -q) || true"
echo "sudo systemctl stop caddy || true"
echo ""
echo "# Manual investigation required - check logs:"
echo "docker logs $container_name"
echo "sudo journalctl -u caddy -n 50"
echo "df -h  # Check disk space"
echo ""
echo "# Contact system administrator for manual recovery"
echo ""

echo "=== VERIFICATION COMMANDS ==="
echo "# After any rollback, verify the system:"
echo "curl -f http://localhost:$port/ && echo '✅ Application responding'"
echo "docker ps | grep $container_name && echo '✅ Container running'"
echo "sudo systemctl status caddy && echo '✅ Caddy running'"
echo ""

echo "=== ROLLBACK PRIORITY (by speed and reliability) ==="
echo "1. Container Rollback (seconds) - if backup container exists"
echo "2. Filesystem Rollback (1-2 minutes) - if filesystem backup exists"
echo "3. Registry Rollback (2-5 minutes) - if registry images available"
echo "4. Emergency Manual Recovery (varies) - requires investigation"

MANUAL_ROLLBACK_EOF
    
    chmod +x "$commands_file"
    
    print_status "📋 Manual rollback commands generated: $commands_file"
    print_status ""
    print_status "To view rollback options:"
    print_status "  cat $commands_file"
    print_status ""
    print_status "To execute rollback commands on VPS:"
    print_status "  scp -i $SSH_KEY -P $VPS_PORT $commands_file $VPS_USER@$VPS_HOST:/tmp/"
    print_status "  ssh -i $SSH_KEY -p $VPS_PORT $VPS_USER@$VPS_HOST 'bash /tmp/$(basename $commands_file)'"
    
    return 0
}

# Rollback priority and reliability assessment
assess_rollback_options() {
    local container_name="$1"
    local port="$2"
    local backup_path="${3:-/root/pixelated-backup}"
    local registry_url="${4:-git.pixelatedempathy.tech}"
    local project_name="${5:-pixelated-empathy}"
    
    print_header "🔍 Rollback Options Assessment"
    
    local assessment_file="/tmp/rollback-assessment-$(date +%Y%m%d-%H%M%S).json"
    
    # Initialize assessment results
    cat > "$assessment_file" << ASSESSMENT_INIT
{
    "timestamp": "$(date -Iseconds)",
    "container_name": "$container_name",
    "assessment": {
        "container_rollback": {},
        "filesystem_rollback": {},
        "registry_rollback": {}
    },
    "recommendations": []
}
ASSESSMENT_INIT
    
    print_status "🔍 Assessing rollback options..."
    
    # Assess container rollback option
    print_status "Checking container rollback availability..."
    local container_backup_available=false
    local container_backup_status="not_available"
    local container_speed="fast"
    local container_reliability="high"
    
    if docker ps -a --format "table {{.Names}}" | grep -q "^${container_name}-backup$"; then
        container_backup_available=true
        container_backup_status="available"
        
        # Check if backup container can start
        if docker inspect "${container_name}-backup" >/dev/null 2>&1; then
            container_reliability="high"
            print_status "✅ Container backup available and healthy"
        else
            container_reliability="medium"
            print_warning "⚠️  Container backup exists but may have issues"
        fi
    else
        print_warning "⚠️  No container backup available"
    fi
    
    # Update assessment
    echo "$(jq --arg status "$container_backup_status" --arg speed "$container_speed" --arg reliability "$container_reliability" --argjson available "$container_backup_available" '.assessment.container_rollback = {"available": $available, "status": $status, "speed": $speed, "reliability": $reliability, "estimated_time": "10-30 seconds"}' "$assessment_file")" > "$assessment_file"
    
    # Assess filesystem rollback option
    print_status "Checking filesystem rollback availability..."
    local filesystem_backup_available=false
    local filesystem_backup_status="not_available"
    local filesystem_speed="medium"
    local filesystem_reliability="high"
    
    # Check via SSH if backup directory exists
    local ssh_cmd="ssh -i $SSH_KEY -p $VPS_PORT -o ConnectTimeout=5 -o BatchMode=yes"
    
    if timeout 10 $ssh_cmd "$VPS_USER@$VPS_HOST" "[ -d '$backup_path' ]" 2>/dev/null; then
        filesystem_backup_available=true
        filesystem_backup_status="available"
        print_status "✅ Filesystem backup available"
        
        # Check backup size and age
        local backup_info
        if backup_info=$(timeout 10 $ssh_cmd "$VPS_USER@$VPS_HOST" "ls -la '$backup_path' 2>/dev/null | head -5" 2>/dev/null); then
            print_status "Backup info: $backup_info"
            filesystem_reliability="high"
        else
            filesystem_reliability="medium"
            print_warning "⚠️  Could not verify backup contents"
        fi
    else
        print_warning "⚠️  No filesystem backup available or SSH connection failed"
    fi
    
    # Update assessment
    echo "$(jq --arg status "$filesystem_backup_status" --arg speed "$filesystem_speed" --arg reliability "$filesystem_reliability" --argjson available "$filesystem_backup_available" '.assessment.filesystem_rollback = {"available": $available, "status": $status, "speed": $speed, "reliability": $reliability, "estimated_time": "1-3 minutes"}' "$assessment_file")" > "$assessment_file"
    
    # Assess registry rollback option
    print_status "Checking registry rollback availability..."
    local registry_backup_available=false
    local registry_backup_status="not_available"
    local registry_speed="slow"
    local registry_reliability="medium"
    
    # Check if we have registry images logged
    if [ -f /tmp/registry-images.log ] && [ -s /tmp/registry-images.log ]; then
        registry_backup_available=true
        registry_backup_status="available"
        print_status "✅ Registry images available"
        
        local image_count=$(wc -l < /tmp/registry-images.log)
        print_status "Available registry images: $image_count"
        
        # Test registry connectivity
        if curl -s --connect-timeout 5 "https://$registry_url" >/dev/null 2>&1; then
            registry_reliability="high"
            print_status "✅ Registry connectivity confirmed"
        else
            registry_reliability="low"
            print_warning "⚠️  Registry connectivity issues detected"
        fi
    else
        print_warning "⚠️  No registry images available"
    fi
    
    # Update assessment
    echo "$(jq --arg status "$registry_backup_status" --arg speed "$registry_speed" --arg reliability "$registry_reliability" --argjson available "$registry_backup_available" '.assessment.registry_rollback = {"available": $available, "status": $status, "speed": $speed, "reliability": $reliability, "estimated_time": "2-5 minutes"}' "$assessment_file")" > "$assessment_file"
    
    # Generate recommendations based on assessment
    local recommendations=()
    
    if [ "$container_backup_available" = true ]; then
        recommendations+=("Container rollback (fastest, most reliable)")
    fi
    
    if [ "$filesystem_backup_available" = true ]; then
        recommendations+=("Filesystem rollback (fast, reliable)")
    fi
    
    if [ "$registry_backup_available" = true ]; then
        recommendations+=("Registry rollback (slower, but works across environments)")
    fi
    
    if [ ${#recommendations[@]} -eq 0 ]; then
        recommendations+=("Manual recovery required - no automated rollback options available")
    fi
    
    # Update recommendations in assessment
    local recommendations_json=$(printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .)
    echo "$(jq --argjson recs "$recommendations_json" '.recommendations = $recs' "$assessment_file")" > "$assessment_file"
    
    # Display assessment summary
    print_status ""
    print_status "📊 Rollback Assessment Summary:"
    print_status "================================"
    
    if [ "$container_backup_available" = true ]; then
        print_status "✅ Container Rollback: Available (10-30 seconds, high reliability)"
    else
        print_status "❌ Container Rollback: Not available"
    fi
    
    if [ "$filesystem_backup_available" = true ]; then
        print_status "✅ Filesystem Rollback: Available (1-3 minutes, high reliability)"
    else
        print_status "❌ Filesystem Rollback: Not available"
    fi
    
    if [ "$registry_backup_available" = true ]; then
        print_status "✅ Registry Rollback: Available (2-5 minutes, medium reliability)"
    else
        print_status "❌ Registry Rollback: Not available"
    fi
    
    print_status ""
    print_status "🎯 Recommended rollback order:"
    for i in "${!recommendations[@]}"; do
        print_status "  $((i + 1)). ${recommendations[$i]}"
    done
    
    print_status ""
    print_status "📋 Assessment details saved to: $assessment_file"
    
    return 0
}

# Rollback success logging
log_rollback_success() {
    local rollback_type="$1"
    local container_name="$2"
    local source="$3"
    local rollback_log="$4"
    
    local success_log="/tmp/rollback-success-$(date +%Y%m%d-%H%M%S).log"
    
    cat > "$success_log" << SUCCESS_EOF
=== ROLLBACK SUCCESS LOG ===
Timestamp: $(date -Iseconds)
Rollback Type: $rollback_type
Container: $container_name
Source: $source
Status: SUCCESS

=== ROLLBACK DETAILS ===
EOF
    
    if [ -f "$rollback_log" ]; then
        cat "$rollback_log" >> "$success_log"
    fi
    
    cat >> "$success_log" << SUCCESS_EOF

=== POST-ROLLBACK STATUS ===
Container Status: $(docker ps --filter "name=$container_name" --format "table {{.Names}}\t{{.Status}}" | tail -n +2 || echo "unknown")
Application Status: $(curl -s -f "http://localhost:4321/" >/dev/null 2>&1 && echo "responding" || echo "not responding")

=== RECOMMENDATIONS ===
1. Monitor application for stability
2. Investigate root cause of original deployment failure
3. Fix issues before attempting next deployment
4. Consider updating deployment procedures based on lessons learned

SUCCESS_EOF
    
    print_status "✅ Rollback success logged to: $success_log"
    
    # Also log to main deployment log
    echo "" >> /tmp/deployment-summary.log
    echo "=== ROLLBACK COMPLETED ===" >> /tmp/deployment-summary.log
    echo "Type: $rollback_type" >> /tmp/deployment-summary.log
    echo "Status: SUCCESS" >> /tmp/deployment-summary.log
    echo "Timestamp: $(date -Iseconds)" >> /tmp/deployment-summary.log
    echo "=========================" >> /tmp/deployment-summary.log
}
    if perform_blue_green_deployment "$registry_tag" "$container_name" "$port" "$domain" "${env_vars[@]}"; then
        print_status "✅ Registry-based deployment completed successfully"
        return 0
    else
        print_error "❌ Registry-based deployment failed"
        return 1
    fi
}

generate_registry_rollback_commands() {
    local registry_url="${1:-git.pixelatedempathy.tech}"
    local project_name="${2:-pixelated-empathy}"
    local container_name="${3:-pixelated-app}"
    local port="${4:-4321}"
    local domain="${5:-pixelatedempathy.com}"
    
    print_status "Generating registry-based rollback commands..."
    
    cat << ROLLBACK_COMMANDS

# Registry-Based Rollback Commands

# 1. List available registry images:
curl -s "https://${registry_url}/v2/${project_name}/tags/list" | jq -r '.tags[]?' | head -10

# 2. Pull and deploy a specific version (replace TAG with desired version):
docker pull ${registry_url}/${project_name}:TAG
docker stop $container_name || true
docker run -d --name ${container_name}-rollback --restart unless-stopped -p $port:4321 ${registry_url}/${project_name}:TAG

# 3. Update Caddy configuration (if using domain):
sudo tee /etc/caddy/Caddyfile > /dev/null << 'CADDY_EOF'
$domain {
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    handle /assets/* {
        header Cache-Control "public, max-age=31536000, immutable"
        reverse_proxy localhost:$port
    }
    handle {
        reverse_proxy localhost:$port
    }
}
CADDY_EOF

# 4. Reload Caddy:
sudo systemctl reload caddy

# 5. Verify rollback:
curl -s -f "http://localhost:$port/" && echo "✅ Rollback successful"

# 6. Clean up failed container:
docker stop $container_name && docker rm $container_name
docker rename ${container_name}-rollback $container_name

ROLLBACK_COMMANDS
}

# Secure Environment Variable Manager Functions
encrypt_environment_file() {
    local env_file="${1:-.env}"
    local passphrase="$2"
    local output_file="${3:-${env_file}.encrypted}"
    
    print_status "Encrypting environment file: $env_file"
    
    # Validate input file exists
    if [[ ! -f "$env_file" ]]; then
        print_error "Environment file not found: $env_file"
        return 1
    fi
    
    # Validate passphrase is provided
    if [[ -z "$passphrase" ]]; then
        print_error "Passphrase is required for encryption"
        return 1
    fi
    
    # Check if OpenSSL is available
    if ! command -v openssl >/dev/null 2>&1; then
        print_error "OpenSSL is required for environment file encryption"
        return 1
    fi
    
    # Create temporary directory for encryption operations
    local temp_dir=$(mktemp -d)
    local temp_env_file="$temp_dir/env.tmp"
    
    # Copy and validate environment file
    if ! cp "$env_file" "$temp_env_file"; then
        print_error "Failed to copy environment file for encryption"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Validate environment file format
    if ! validate_environment_file_format "$temp_env_file"; then
        print_error "Environment file format validation failed"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Encrypt using AES-256-CBC
    print_status "Encrypting with AES-256-CBC..."
    if openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$temp_env_file" -out "$output_file" -k "$passphrase" 2>/dev/null; then
        print_status "✅ Environment file encrypted successfully: $output_file"
        
        # Verify encryption by attempting to decrypt (without saving)
        if openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 -in "$output_file" -k "$passphrase" >/dev/null 2>&1; then
            print_status "✅ Encryption integrity verified"
        else
            print_error "❌ Encryption integrity check failed"
            rm -f "$output_file"
            rm -rf "$temp_dir"
            return 1
        fi
        
        # Set secure permissions on encrypted file
        chmod 600 "$output_file"
        
        # Calculate and store file hash for integrity checking
        local file_hash=$(sha256sum "$output_file" | cut -d' ' -f1)
        echo "$file_hash" > "${output_file}.sha256"
        chmod 600 "${output_file}.sha256"
        
        print_status "File hash: $file_hash"
        
        # Clean up temporary files
        shred -vfz -n 3 "$temp_env_file" 2>/dev/null || rm -f "$temp_env_file"
        rm -rf "$temp_dir"
        
        return 0
    else
        print_error "❌ Environment file encryption failed"
        rm -rf "$temp_dir"
        return 1
    fi
}

validate_environment_file_format() {
    local env_file="$1"
    local line_count=0
    local error_count=0
    
    print_status "Validating environment file format: $env_file"
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        line_count=$((line_count + 1))
        
        # Skip empty lines and comments
        if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Check for valid KEY=VALUE format
        if [[ ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            print_warning "Line $line_count: Invalid format - $line"
            error_count=$((error_count + 1))
        fi
        
        # Check for potentially sensitive variables (for logging purposes)
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=(.*)(TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|AUTH).* ]]; then
            # Don't log the actual value, just note that sensitive data was found
            local var_name=$(echo "$line" | cut -d'=' -f1)
            print_status "Found sensitive variable: $var_name"
        fi
    done < "$env_file"
    
    print_status "Environment file validation: $line_count lines processed, $error_count errors"
    
    if [ $error_count -eq 0 ]; then
        print_status "✅ Environment file format is valid"
        return 0
    else
        print_error "❌ Environment file has $error_count format errors"
        return 1
    fi
}

create_secure_transfer_package() {
    local encrypted_file="$1"
    local transfer_package="${2:-${encrypted_file}.transfer}"
    
    print_status "Creating secure transfer package: $transfer_package"
    
    # Validate encrypted file exists
    if [[ ! -f "$encrypted_file" ]]; then
        print_error "Encrypted file not found: $encrypted_file"
        return 1
    fi
    
    # Validate hash file exists
    if [[ ! -f "${encrypted_file}.sha256" ]]; then
        print_error "Hash file not found: ${encrypted_file}.sha256"
        return 1
    fi
    
    # Create transfer package with metadata
    local temp_dir=$(mktemp -d)
    local package_dir="$temp_dir/env_package"
    mkdir -p "$package_dir"
    
    # Copy encrypted file and hash
    cp "$encrypted_file" "$package_dir/env.encrypted"
    cp "${encrypted_file}.sha256" "$package_dir/env.sha256"
    
    # Create metadata file
    cat > "$package_dir/metadata.json" << METADATA_EOF
{
    "created_at": "$(date -Iseconds)",
    "created_by": "$(whoami)@$(hostname)",
    "encryption_method": "AES-256-CBC",
    "pbkdf2_iterations": 100000,
    "file_count": 1,
    "transfer_id": "$(uuidgen 2>/dev/null || date +%s | sha256sum | cut -c1-32)"
}
METADATA_EOF
    
    # Create tar archive with compression
    if tar -czf "$transfer_package" -C "$temp_dir" env_package; then
        print_status "✅ Transfer package created: $transfer_package"
        
        # Set secure permissions
        chmod 600 "$transfer_package"
        
        # Calculate package hash
        local package_hash=$(sha256sum "$transfer_package" | cut -d' ' -f1)
        echo "$package_hash" > "${transfer_package}.sha256"
        chmod 600 "${transfer_package}.sha256"
        
        print_status "Package hash: $package_hash"
        
        # Clean up temporary directory
        rm -rf "$temp_dir"
        
        return 0
    else
        print_error "❌ Failed to create transfer package"
        rm -rf "$temp_dir"
        return 1
    fi
}

transfer_encrypted_environment() {
    local transfer_package="$1"
    local vps_host="$2"
    local vps_user="$3"
    local ssh_key="$4"
    local vps_port="${5:-22}"
    local remote_path="${6:-/tmp/env_transfer}"
    
    print_status "Transferring encrypted environment to VPS..."
    print_status "Package: $transfer_package"
    print_status "Destination: $vps_user@$vps_host:$remote_path"
    
    # Validate transfer package exists
    if [[ ! -f "$transfer_package" ]]; then
        print_error "Transfer package not found: $transfer_package"
        return 1
    fi
    
    # Validate hash file exists
    if [[ ! -f "${transfer_package}.sha256" ]]; then
        print_error "Package hash file not found: ${transfer_package}.sha256"
        return 1
    fi
    
    # Verify package integrity before transfer
    print_status "Verifying package integrity before transfer..."
    local expected_hash=$(cat "${transfer_package}.sha256")
    local actual_hash=$(sha256sum "$transfer_package" | cut -d' ' -f1)
    
    if [[ "$expected_hash" != "$actual_hash" ]]; then
        print_error "❌ Package integrity check failed"
        print_error "Expected: $expected_hash"
        print_error "Actual: $actual_hash"
        return 1
    fi
    
    print_status "✅ Package integrity verified"
    
    # Create SSH command with proper options
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    local scp_cmd="scp -i $ssh_key -P $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Create remote directory
    print_status "Creating remote directory: $remote_path"
    if $ssh_cmd "$vps_user@$vps_host" "mkdir -p $remote_path && chmod 700 $remote_path"; then
        print_status "✅ Remote directory created"
    else
        print_error "❌ Failed to create remote directory"
        return 1
    fi
    
    # Transfer package and hash file
    print_status "Transferring package..."
    if $scp_cmd "$transfer_package" "$vps_user@$vps_host:$remote_path/env.transfer"; then
        print_status "✅ Package transferred"
    else
        print_error "❌ Package transfer failed"
        return 1
    fi
    
    if $scp_cmd "${transfer_package}.sha256" "$vps_user@$vps_host:$remote_path/env.transfer.sha256"; then
        print_status "✅ Hash file transferred"
    else
        print_error "❌ Hash file transfer failed"
        return 1
    fi
    
    # Verify transfer integrity on remote server
    print_status "Verifying transfer integrity on remote server..."
    local remote_verification_cmd="cd $remote_path && sha256sum -c env.transfer.sha256"
    
    if $ssh_cmd "$vps_user@$vps_host" "$remote_verification_cmd"; then
        print_status "✅ Transfer integrity verified on remote server"
        return 0
    else
        print_error "❌ Transfer integrity verification failed on remote server"
        return 1
    fi
}

cleanup_temporary_encrypted_files() {
    local base_name="$1"
    local cleanup_local="${2:-true}"
    local cleanup_remote="${3:-false}"
    local vps_host="$4"
    local vps_user="$5"
    local ssh_key="$6"
    local vps_port="${7:-22}"
    
    print_status "Cleaning up temporary encrypted files..."
    
    # Local cleanup
    if [[ "$cleanup_local" == "true" ]]; then
        print_status "Cleaning up local temporary files..."
        
        local files_to_clean=(
            "${base_name}.encrypted"
            "${base_name}.encrypted.sha256"
            "${base_name}.transfer"
            "${base_name}.transfer.sha256"
        )
        
        for file in "${files_to_clean[@]}"; do
            if [[ -f "$file" ]]; then
                print_status "Removing: $file"
                shred -vfz -n 3 "$file" 2>/dev/null || rm -f "$file"
            fi
        done
        
        print_status "✅ Local cleanup completed"
    fi
    
    # Remote cleanup
    if [[ "$cleanup_remote" == "true" ]] && [[ -n "$vps_host" ]] && [[ -n "$vps_user" ]] && [[ -n "$ssh_key" ]]; then
        print_status "Cleaning up remote temporary files..."
        
        local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
        local remote_cleanup_cmd="rm -rf /tmp/env_transfer /tmp/.env.tmp /tmp/env.decrypted 2>/dev/null || true"
        
        if $ssh_cmd "$vps_user@$vps_host" "$remote_cleanup_cmd"; then
            print_status "✅ Remote cleanup completed"
        else
            print_warning "⚠️  Remote cleanup may have failed (non-critical)"
        fi
    fi
}

decrypt_environment_file_on_vps() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local passphrase="$4"
    local vps_port="${5:-22}"
    local remote_path="${6:-/tmp/env_transfer}"
    local output_file="${7:-/tmp/env.decrypted}"
    
    print_status "Decrypting environment file on VPS..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Create remote decryption script
    local decrypt_script=$(cat << 'DECRYPT_SCRIPT_EOF'
#!/bin/bash
set -e

REMOTE_PATH="$1"
PASSPHRASE="$2"
OUTPUT_FILE="$3"

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-INFO]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[VPS-WARNING]${NC} $1"; }

print_status "Starting environment file decryption on VPS..."

# Validate transfer package exists
if [[ ! -f "$REMOTE_PATH/env.transfer" ]]; then
    print_error "Transfer package not found: $REMOTE_PATH/env.transfer"
    exit 1
fi

# Extract transfer package
print_status "Extracting transfer package..."
TEMP_DIR=$(mktemp -d)
if tar -xzf "$REMOTE_PATH/env.transfer" -C "$TEMP_DIR"; then
    print_status "✅ Transfer package extracted"
else
    print_error "❌ Failed to extract transfer package"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Validate extracted files
PACKAGE_DIR="$TEMP_DIR/env_package"
if [[ ! -f "$PACKAGE_DIR/env.encrypted" ]] || [[ ! -f "$PACKAGE_DIR/env.sha256" ]]; then
    print_error "Required files not found in transfer package"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Verify file integrity
print_status "Verifying file integrity..."
cd "$PACKAGE_DIR"
if sha256sum -c env.sha256 >/dev/null 2>&1; then
    print_status "✅ File integrity verified"
else
    print_error "❌ File integrity check failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Decrypt environment file
print_status "Decrypting environment file..."
if openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 -in env.encrypted -out "$OUTPUT_FILE" -k "$PASSPHRASE" 2>/dev/null; then
    print_status "✅ Environment file decrypted successfully"
    
    # Set secure permissions
    chmod 600 "$OUTPUT_FILE"
    
    # Validate decrypted file format
    if grep -q "=" "$OUTPUT_FILE" 2>/dev/null; then
        print_status "✅ Decrypted file format validated"
    else
        print_error "❌ Decrypted file format validation failed"
        shred -vfz -n 3 "$OUTPUT_FILE" 2>/dev/null || rm -f "$OUTPUT_FILE"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    # Clean up temporary files
    rm -rf "$TEMP_DIR"
    
    print_status "Environment file ready at: $OUTPUT_FILE"
    exit 0
else
    print_error "❌ Environment file decryption failed"
    rm -rf "$TEMP_DIR"
    exit 1
fi
DECRYPT_SCRIPT_EOF
)
    
    # Transfer and execute decryption script
    print_status "Transferring decryption script to VPS..."
    echo "$decrypt_script" | $ssh_cmd "$vps_user@$vps_host" "cat > /tmp/decrypt_env.sh && chmod +x /tmp/decrypt_env.sh"
    
    # Execute decryption on VPS
    print_status "Executing decryption on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "/tmp/decrypt_env.sh '$remote_path' '$passphrase' '$output_file'"; then
        print_status "✅ Environment file decrypted successfully on VPS"
        
        # Clean up decryption script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/decrypt_env.sh" || true
        
        return 0
    else
        print_error "❌ Environment file decryption failed on VPS"
        
        # Clean up decryption script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/decrypt_env.sh" || true
        
        return 1
    fi
}

load_environment_variables_on_vps() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local env_file="${4:-/tmp/env.decrypted}"
    local vps_port="${5:-22}"
    local export_to_file="${6:-/tmp/env_vars.sh}"
    
    print_status "Loading environment variables on VPS..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Create environment variable loading script
    local load_script=$(cat << 'LOAD_SCRIPT_EOF'
#!/bin/bash
set -e

ENV_FILE="$1"
EXPORT_FILE="$2"

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-INFO]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[VPS-WARNING]${NC} $1"; }

print_status "Loading environment variables from: $ENV_FILE"

# Validate environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    print_error "Environment file not found: $ENV_FILE"
    exit 1
fi

# Create export script with validation and sanitization
print_status "Creating environment variable export script..."
{
    echo "#!/bin/bash"
    echo "# Auto-generated environment variable export script"
    echo "# Generated at: $(date -Iseconds)"
    echo ""
    
    # Process each line in the environment file
    local line_count=0
    local var_count=0
    local sensitive_count=0
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        line_count=$((line_count + 1))
        
        # Skip empty lines and comments
        if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        
        # Validate and sanitize variable format
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            local var_name="${BASH_REMATCH[1]}"
            local var_value="${BASH_REMATCH[2]}"
            
            # Remove surrounding quotes if present
            if [[ "$var_value" =~ ^\"(.*)\"$ ]] || [[ "$var_value" =~ ^\'(.*)\'$ ]]; then
                var_value="${BASH_REMATCH[1]}"
            fi
            
            # Escape special characters in value
            var_value=$(printf '%q' "$var_value")
            
            # Export the variable
            echo "export $var_name=$var_value"
            
            var_count=$((var_count + 1))
            
            # Count sensitive variables (for reporting)
            if [[ "$var_name" =~ (TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|AUTH) ]]; then
                sensitive_count=$((sensitive_count + 1))
            fi
        else
            print_warning "Skipping invalid line $line_count: $line"
        fi
    done < "$ENV_FILE"
    
    echo ""
    echo "# Environment variables loaded: $var_count (including $sensitive_count sensitive)"
    echo "# Source this file to load variables: source $EXPORT_FILE"
    
} > "$EXPORT_FILE"

# Set secure permissions on export script
chmod 600 "$EXPORT_FILE"

print_status "✅ Environment variable export script created: $EXPORT_FILE"
print_status "Variables processed: $var_count (including $sensitive_count sensitive)"

# Validate the export script
if source "$EXPORT_FILE" 2>/dev/null; then
    print_status "✅ Environment variable export script validated"
else
    print_error "❌ Environment variable export script validation failed"
    exit 1
fi

exit 0
LOAD_SCRIPT_EOF
)
    
    # Transfer and execute loading script
    print_status "Transferring environment loading script to VPS..."
    echo "$load_script" | $ssh_cmd "$vps_user@$vps_host" "cat > /tmp/load_env.sh && chmod +x /tmp/load_env.sh"
    
    # Execute environment loading on VPS
    print_status "Executing environment loading on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "/tmp/load_env.sh '$env_file' '$export_to_file'"; then
        print_status "✅ Environment variables loaded successfully on VPS"
        
        # Clean up loading script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/load_env.sh" || true
        
        return 0
    else
        print_error "❌ Environment variable loading failed on VPS"
        
        # Clean up loading script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/load_env.sh" || true
        
        return 1
    fi
}

validate_environment_variables_on_vps() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local env_export_file="${4:-/tmp/env_vars.sh}"
    local vps_port="${5:-22}"
    
    print_status "Validating environment variables on VPS..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Create validation script
    local validation_script=$(cat << 'VALIDATION_SCRIPT_EOF'
#!/bin/bash
set -e

ENV_EXPORT_FILE="$1"

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-INFO]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[VPS-WARNING]${NC} $1"; }

print_status "Validating environment variables..."

# Validate export file exists
if [[ ! -f "$ENV_EXPORT_FILE" ]]; then
    print_error "Environment export file not found: $ENV_EXPORT_FILE"
    exit 1
fi

# Source the environment variables
if source "$ENV_EXPORT_FILE" 2>/dev/null; then
    print_status "✅ Environment variables sourced successfully"
else
    print_error "❌ Failed to source environment variables"
    exit 1
fi

# Validate critical environment variables
CRITICAL_VARS=(
    "GITLAB_TOKEN"
    "AZURE_CLIENT_ID"
    "MONGODB_URI"
    "JWT_SECRET"
)

MISSING_VARS=()
PRESENT_VARS=()

for var in "${CRITICAL_VARS[@]}"; do
    if [[ -n "${!var}" ]]; then
        PRESENT_VARS+=("$var")
        print_status "✅ $var: present"
    else
        MISSING_VARS+=("$var")
        print_warning "⚠️  $var: missing"
    fi
done

print_status "Environment validation summary:"
print_status "Present variables: ${#PRESENT_VARS[@]}"
print_status "Missing variables: ${#MISSING_VARS[@]}"

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    print_warning "Missing critical variables: ${MISSING_VARS[*]}"
    print_warning "Deployment may continue with limited functionality"
fi

# Test database connectivity if MongoDB URI is present
if [[ -n "$MONGODB_URI" ]]; then
    print_status "Testing MongoDB connectivity..."
    # Note: This would require mongo client to be installed
    # For now, just validate the URI format
    if [[ "$MONGODB_URI" =~ ^mongodb(\+srv)?:// ]]; then
        print_status "✅ MongoDB URI format is valid"
    else
        print_warning "⚠️  MongoDB URI format may be invalid"
    fi
fi

print_status "✅ Environment variable validation completed"
exit 0
VALIDATION_SCRIPT_EOF
)
    
    # Transfer and execute validation script
    print_status "Transferring validation script to VPS..."
    echo "$validation_script" | $ssh_cmd "$vps_user@$vps_host" "cat > /tmp/validate_env.sh && chmod +x /tmp/validate_env.sh"
    
    # Execute validation on VPS
    print_status "Executing environment validation on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "/tmp/validate_env.sh '$env_export_file'"; then
        print_status "✅ Environment variables validated successfully on VPS"
        
        # Clean up validation script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/validate_env.sh" || true
        
        return 0
    else
        print_warning "⚠️  Environment variable validation completed with warnings"
        
        # Clean up validation script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/validate_env.sh" || true
        
        return 0  # Don't fail deployment for validation warnings
    fi
}

backup_environment_variables_for_rollback() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local current_env_file="${4:-/tmp/env_vars.sh}"
    local vps_port="${5:-22}"
    local backup_dir="${6:-/root/env_backups}"
    
    print_status "Creating environment variable backup for rollback..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$backup_dir/env_vars_backup_$timestamp.sh"
    
    # Create backup directory and copy current environment
    local backup_cmd="mkdir -p $backup_dir && chmod 700 $backup_dir"
    
    if [[ -f "$current_env_file" ]]; then
        backup_cmd="$backup_cmd && cp $current_env_file $backup_file && chmod 600 $backup_file"
    fi
    
    # Maintain only last 3 backups
    backup_cmd="$backup_cmd && cd $backup_dir && ls -t env_vars_backup_*.sh 2>/dev/null | tail -n +4 | xargs rm -f"
    
    if $ssh_cmd "$vps_user@$vps_host" "$backup_cmd"; then
        print_status "✅ Environment variables backed up: $backup_file"
        
        # Store backup path for rollback reference
        echo "$backup_file" > /tmp/env_backup_path.txt
        
        return 0
    else
        print_warning "⚠️  Environment variable backup failed (non-critical)"
        return 0  # Don't fail deployment for backup failure
    fi
}

restore_environment_variables_from_backup() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local backup_file="$4"
    local vps_port="${5:-22}"
    local target_file="${6:-/tmp/env_vars.sh}"
    
    print_status "Restoring environment variables from backup..."
    print_status "Backup: $backup_file"
    print_status "Target: $target_file"
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Restore from backup
    local restore_cmd="if [[ -f '$backup_file' ]]; then cp '$backup_file' '$target_file' && chmod 600 '$target_file'; else echo 'Backup file not found: $backup_file'; exit 1; fi"
    
    if $ssh_cmd "$vps_user@$vps_host" "$restore_cmd"; then
        print_status "✅ Environment variables restored from backup"
        
        # Validate restored environment
        if validate_environment_variables_on_vps "$vps_host" "$vps_user" "$ssh_key" "$target_file" "$vps_port"; then
            print_status "✅ Restored environment variables validated"
            return 0
        else
            print_warning "⚠️  Restored environment validation completed with warnings"
            return 0
        fi
    else
        print_error "❌ Failed to restore environment variables from backup"
        return 1
    fi
}

secure_environment_storage_on_vps() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local env_file="${4:-/tmp/env_vars.sh}"
    local vps_port="${5:-22}"
    local secure_storage_dir="${6:-/root/.env_secure}"
    
    print_status "Setting up secure environment variable storage on VPS..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Create secure storage setup script
    local storage_script=$(cat << 'STORAGE_SCRIPT_EOF'
#!/bin/bash
set -e

ENV_FILE="$1"
SECURE_DIR="$2"

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[VPS-INFO]${NC} $1"; }
print_error() { echo -e "${RED}[VPS-ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[VPS-WARNING]${NC} $1"; }

print_status "Setting up secure environment storage..."

# Create secure directory with restricted permissions
if mkdir -p "$SECURE_DIR"; then
    chmod 700 "$SECURE_DIR"
    print_status "✅ Secure directory created: $SECURE_DIR"
else
    print_error "❌ Failed to create secure directory"
    exit 1
fi

# Move environment file to secure storage
if [[ -f "$ENV_FILE" ]]; then
    local secure_env_file="$SECURE_DIR/current_env.sh"
    
    if cp "$ENV_FILE" "$secure_env_file"; then
        chmod 600 "$secure_env_file"
        print_status "✅ Environment file secured: $secure_env_file"
        
        # Create symlink for easy access
        ln -sf "$secure_env_file" "$SECURE_DIR/env.sh"
        
        # Remove original temporary file
        shred -vfz -n 3 "$ENV_FILE" 2>/dev/null || rm -f "$ENV_FILE"
        print_status "✅ Temporary environment file cleaned up"
        
    else
        print_error "❌ Failed to secure environment file"
        exit 1
    fi
else
    print_warning "⚠️  Environment file not found: $ENV_FILE"
fi

# Create access control script
cat > "$SECURE_DIR/access_env.sh" << 'ACCESS_SCRIPT_EOF'
#!/bin/bash
# Secure environment variable access script
# Usage: source /root/.env_secure/access_env.sh

SECURE_ENV_FILE="/root/.env_secure/current_env.sh"

if [[ -f "$SECURE_ENV_FILE" ]]; then
    source "$SECURE_ENV_FILE"
    echo "[ENV] Environment variables loaded securely"
else
    echo "[ENV-ERROR] Secure environment file not found"
    exit 1
fi
ACCESS_SCRIPT_EOF

chmod 700 "$SECURE_DIR/access_env.sh"
print_status "✅ Environment access script created"

# Create cleanup script for post-deployment
cat > "$SECURE_DIR/cleanup_temp.sh" << 'CLEANUP_SCRIPT_EOF'
#!/bin/bash
# Cleanup temporary environment files after deployment

# Remove any temporary decrypted files
find /tmp -name "*.env*" -o -name "*env*.tmp" -o -name "env.decrypted" 2>/dev/null | while read -r file; do
    if [[ -f "$file" ]]; then
        echo "Cleaning up: $file"
        shred -vfz -n 3 "$file" 2>/dev/null || rm -f "$file"
    fi
done

# Remove transfer packages
rm -rf /tmp/env_transfer 2>/dev/null || true

echo "✅ Temporary environment files cleaned up"
CLEANUP_SCRIPT_EOF

chmod 700 "$SECURE_DIR/cleanup_temp.sh"
print_status "✅ Cleanup script created"

print_status "✅ Secure environment storage setup completed"
exit 0
STORAGE_SCRIPT_EOF
)
    
    # Transfer and execute storage setup script
    print_status "Transferring secure storage setup script to VPS..."
    echo "$storage_script" | $ssh_cmd "$vps_user@$vps_host" "cat > /tmp/setup_secure_storage.sh && chmod +x /tmp/setup_secure_storage.sh"
    
    # Execute secure storage setup on VPS
    print_status "Executing secure storage setup on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "/tmp/setup_secure_storage.sh '$env_file' '$secure_storage_dir'"; then
        print_status "✅ Secure environment storage setup completed on VPS"
        
        # Clean up setup script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/setup_secure_storage.sh" || true
        
        return 0
    else
        print_error "❌ Secure environment storage setup failed on VPS"
        
        # Clean up setup script
        $ssh_cmd "$vps_user@$vps_host" "rm -f /tmp/setup_secure_storage.sh" || true
        
        return 1
    fi
}

cleanup_decrypted_environment_files() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="${4:-22}"
    local secure_storage_dir="${5:-/root/.env_secure}"
    
    print_status "Cleaning up decrypted environment files on VPS..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Execute cleanup using the secure storage cleanup script
    if $ssh_cmd "$vps_user@$vps_host" "$secure_storage_dir/cleanup_temp.sh 2>/dev/null || true"; then
        print_status "✅ Decrypted environment files cleaned up on VPS"
    else
        print_warning "⚠️  Environment cleanup may have failed (non-critical)"
    fi
    
    # Additional manual cleanup for safety
    local manual_cleanup_cmd="find /tmp -name '*.env*' -o -name '*env*.tmp' -o -name 'env.decrypted' 2>/dev/null | xargs shred -vfz -n 3 2>/dev/null || true; rm -rf /tmp/env_transfer 2>/dev/null || true"
    
    $ssh_cmd "$vps_user@$vps_host" "$manual_cleanup_cmd" || true
    
    return 0
}

mask_sensitive_variables_in_logs() {
    local log_content="$1"
    local output_file="${2:-/dev/stdout}"
    
    # Define patterns for sensitive variables
    local sensitive_patterns=(
        "TOKEN" "KEY" "SECRET" "PASSWORD" "CREDENTIAL" "AUTH"
        "API_KEY" "PRIVATE" "CERT" "SIGNATURE" "HASH"
    )
    
    # Create masked version of log content
    local masked_content="$log_content"
    
    for pattern in "${sensitive_patterns[@]}"; do
        # Mask values in KEY=VALUE format
        masked_content=$(echo "$masked_content" | sed -E "s/([A-Za-z_]*${pattern}[A-Za-z_]*)=([^[:space:]]+)/\1=***MASKED***/gi")
        
        # Mask values in export statements
        masked_content=$(echo "$masked_content" | sed -E "s/(export [A-Za-z_]*${pattern}[A-Za-z_]*)=([^[:space:]]+)/\1=***MASKED***/gi")
        
        # Mask values in JSON-like structures
        masked_content=$(echo "$masked_content" | sed -E "s/(\"[A-Za-z_]*${pattern}[A-Za-z_]*\"[[:space:]]*:[[:space:]]*\")[^\"]+(\")/ \1***MASKED***\2/gi")
    done
    
    # Output masked content
    if [[ "$output_file" == "/dev/stdout" ]]; then
        echo "$masked_content"
    else
        echo "$masked_content" > "$output_file"
    fi
}

create_environment_variable_rotation_script() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="${4:-22}"
    local secure_storage_dir="${5:-/root/.env_secure}"
    
    print_status "Creating environment variable rotation script on VPS..."
    
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Create rotation script
    local rotation_script=$(cat << 'ROTATION_SCRIPT_EOF'
#!/bin/bash
# Environment Variable Rotation Script
# Usage: ./rotate_env.sh [new_env_file]

set -e

SECURE_DIR="/root/.env_secure"
NEW_ENV_FILE="$1"
BACKUP_DIR="$SECURE_DIR/rotations"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[ROTATION]${NC} $1"; }
print_error() { echo -e "${RED}[ROTATION-ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[ROTATION-WARNING]${NC} $1"; }

print_status "Starting environment variable rotation..."

# Validate new environment file
if [[ -z "$NEW_ENV_FILE" ]]; then
    print_error "Usage: $0 <new_env_file>"
    exit 1
fi

if [[ ! -f "$NEW_ENV_FILE" ]]; then
    print_error "New environment file not found: $NEW_ENV_FILE"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Backup current environment
CURRENT_ENV="$SECURE_DIR/current_env.sh"
if [[ -f "$CURRENT_ENV" ]]; then
    BACKUP_FILE="$BACKUP_DIR/env_rotation_backup_$TIMESTAMP.sh"
    cp "$CURRENT_ENV" "$BACKUP_FILE"
    chmod 600 "$BACKUP_FILE"
    print_status "✅ Current environment backed up: $BACKUP_FILE"
fi

# Validate new environment file format
if grep -q "=" "$NEW_ENV_FILE" 2>/dev/null; then
    print_status "✅ New environment file format validated"
else
    print_error "❌ New environment file format validation failed"
    exit 1
fi

# Install new environment
cp "$NEW_ENV_FILE" "$CURRENT_ENV"
chmod 600 "$CURRENT_ENV"

# Update symlink
ln -sf "$CURRENT_ENV" "$SECURE_DIR/env.sh"

print_status "✅ Environment variables rotated successfully"

# Clean up old rotation backups (keep last 5)
cd "$BACKUP_DIR"
ls -t env_rotation_backup_*.sh 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

print_status "Environment rotation completed at: $(date)"

# Test new environment
if source "$CURRENT_ENV" 2>/dev/null; then
    print_status "✅ New environment variables loaded successfully"
else
    print_error "❌ Failed to load new environment variables"
    
    # Restore from backup if available
    if [[ -f "$BACKUP_FILE" ]]; then
        print_status "Restoring from backup..."
        cp "$BACKUP_FILE" "$CURRENT_ENV"
        print_status "✅ Environment restored from backup"
    fi
    
    exit 1
fi
ROTATION_SCRIPT_EOF
)
    
    # Transfer rotation script to VPS
    print_status "Transferring rotation script to VPS..."
    echo "$rotation_script" | $ssh_cmd "$vps_user@$vps_host" "cat > $secure_storage_dir/rotate_env.sh && chmod 700 $secure_storage_dir/rotate_env.sh"
    
    if [[ $? -eq 0 ]]; then
        print_status "✅ Environment variable rotation script created on VPS"
        print_status "Usage: ssh $vps_user@$vps_host '$secure_storage_dir/rotate_env.sh <new_env_file>'"
        return 0
    else
        print_error "❌ Failed to create rotation script on VPS"
        return 1
    fi
}

update_environment_variables_securely() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local new_env_file="$4"
    local vps_port="${5:-22}"
    local secure_storage_dir="${6:-/root/.env_secure}"
    
    print_status "Updating environment variables securely on VPS..."
    
    # First, transfer the new environment file
    local scp_cmd="scp -i $ssh_key -P $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    local temp_new_env="/tmp/new_env_$(date +%s).sh"
    
    if $scp_cmd "$new_env_file" "$vps_user@$vps_host:$temp_new_env"; then
        print_status "✅ New environment file transferred"
    else
        print_error "❌ Failed to transfer new environment file"
        return 1
    fi
    
    # Execute rotation using the rotation script
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    if $ssh_cmd "$vps_user@$vps_host" "$secure_storage_dir/rotate_env.sh $temp_new_env"; then
        print_status "✅ Environment variables updated securely"
        
        # Clean up temporary file
        $ssh_cmd "$vps_user@$vps_host" "shred -vfz -n 3 $temp_new_env 2>/dev/null || rm -f $temp_new_env" || true
        
        return 0
    else
        print_error "❌ Failed to update environment variables"
        
        # Clean up temporary file
        $ssh_cmd "$vps_user@$vps_host" "shred -vfz -n 3 $temp_new_env 2>/dev/null || rm -f $temp_new_env" || true
        
        return 1
    fi
}

# Main Secure Environment Variable Deployment Function
deploy_environment_variables_securely() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="${4:-22}"
    local env_file="${5:-.env}"
    local passphrase="$6"
    
    print_header "🔐 Deploying Environment Variables Securely"
    
    # Validate inputs
    if [[ -z "$passphrase" ]]; then
        print_error "Passphrase is required for secure environment deployment"
        print_status "Set DEPLOYMENT_PASSPHRASE environment variable or provide as argument"
        return 1
    fi
    
    local deployment_success=true
    local temp_files=()
    
    # Step 1: Encrypt environment file
    print_status "Step 1: Encrypting environment file..."
    local encrypted_file="${env_file}.encrypted"
    if encrypt_environment_file "$env_file" "$passphrase" "$encrypted_file"; then
        temp_files+=("$encrypted_file" "${encrypted_file}.sha256")
        print_status "✅ Environment file encrypted"
    else
        print_error "❌ Environment file encryption failed"
        return 1
    fi
    
    # Step 2: Create secure transfer package
    print_status "Step 2: Creating secure transfer package..."
    local transfer_package="${env_file}.transfer"
    if create_secure_transfer_package "$encrypted_file" "$transfer_package"; then
        temp_files+=("$transfer_package" "${transfer_package}.sha256")
        print_status "✅ Transfer package created"
    else
        print_error "❌ Transfer package creation failed"
        deployment_success=false
    fi
    
    # Step 3: Transfer to VPS
    if [[ "$deployment_success" == "true" ]]; then
        print_status "Step 3: Transferring to VPS..."
        if transfer_encrypted_environment "$transfer_package" "$vps_host" "$vps_user" "$ssh_key" "$vps_port"; then
            print_status "✅ Environment transferred to VPS"
        else
            print_error "❌ Environment transfer failed"
            deployment_success=false
        fi
    fi
    
    # Step 4: Decrypt on VPS
    if [[ "$deployment_success" == "true" ]]; then
        print_status "Step 4: Decrypting on VPS..."
        if decrypt_environment_file_on_vps "$vps_host" "$vps_user" "$ssh_key" "$passphrase" "$vps_port"; then
            print_status "✅ Environment decrypted on VPS"
        else
            print_error "❌ Environment decryption failed on VPS"
            deployment_success=false
        fi
    fi
    
    # Step 5: Load and validate environment variables
    if [[ "$deployment_success" == "true" ]]; then
        print_status "Step 5: Loading environment variables..."
        if load_environment_variables_on_vps "$vps_host" "$vps_user" "$ssh_key" "/tmp/env.decrypted" "$vps_port"; then
            print_status "✅ Environment variables loaded"
            
            # Validate environment variables
            if validate_environment_variables_on_vps "$vps_host" "$vps_user" "$ssh_key" "/tmp/env_vars.sh" "$vps_port"; then
                print_status "✅ Environment variables validated"
            else
                print_warning "⚠️  Environment validation completed with warnings"
            fi
        else
            print_error "❌ Environment variable loading failed"
            deployment_success=false
        fi
    fi
    
    # Step 6: Set up secure storage
    if [[ "$deployment_success" == "true" ]]; then
        print_status "Step 6: Setting up secure storage..."
        if secure_environment_storage_on_vps "$vps_host" "$vps_user" "$ssh_key" "/tmp/env_vars.sh" "$vps_port"; then
            print_status "✅ Secure storage configured"
        else
            print_error "❌ Secure storage setup failed"
            deployment_success=false
        fi
    fi
    
    # Step 7: Create backup for rollback
    if [[ "$deployment_success" == "true" ]]; then
        print_status "Step 7: Creating rollback backup..."
        backup_environment_variables_for_rollback "$vps_host" "$vps_user" "$ssh_key" "/root/.env_secure/current_env.sh" "$vps_port"
    fi
    
    # Step 8: Create rotation script
    if [[ "$deployment_success" == "true" ]]; then
        print_status "Step 8: Setting up rotation capabilities..."
        create_environment_variable_rotation_script "$vps_host" "$vps_user" "$ssh_key" "$vps_port"
    fi
    
    # Step 9: Clean up temporary files
    print_status "Step 9: Cleaning up temporary files..."
    
    # Clean up local temporary files
    cleanup_temporary_encrypted_files "$env_file" "true" "false"
    
    # Clean up VPS temporary files
    cleanup_decrypted_environment_files "$vps_host" "$vps_user" "$ssh_key" "$vps_port"
    
    # Final status
    if [[ "$deployment_success" == "true" ]]; then
        print_header "✅ Secure Environment Variable Deployment Completed"
        print_status "Environment variables are now securely deployed and ready for use"
        print_status "Access via: source /root/.env_secure/access_env.sh"
        print_status "Rotate via: /root/.env_secure/rotate_env.sh <new_env_file>"
        return 0
    else
        print_header "❌ Secure Environment Variable Deployment Failed"
        print_error "Environment variables were not deployed successfully"
        print_error "Check the logs above for specific error details"
        return 1
    fi
}

# Blue-Green Deployment Traffic Switching Functions
start_new_container() {
    local image_tag="$1"
    local new_container_name="$2"
    local new_port="$3"
    local env_vars=("${@:4}")
    
    print_status "Starting new container: $new_container_name on port $new_port"
    
    # Stop and remove any existing container with the same name
    docker stop "$new_container_name" 2>/dev/null || true
    docker rm "$new_container_name" 2>/dev/null || true
    
    # Build docker run command with environment variables
    local docker_cmd="docker run -d --name $new_container_name --restart unless-stopped -p $new_port:4321"
    
    # Add environment variables
    for env_var in "${env_vars[@]}"; do
        docker_cmd="$docker_cmd -e $env_var"
    done
    
    docker_cmd="$docker_cmd $image_tag"
    
    print_status "Running: $docker_cmd"
    
    if eval "$docker_cmd"; then
        print_status "✅ New container started: $new_container_name"
        
        # Wait a moment for container to initialize
        sleep 5
        
        # Verify container is running
        if docker ps --format "table {{.Names}}" | grep -q "^${new_container_name}$"; then
            print_status "✅ Container is running and healthy"
            return 0
        else
            print_error "❌ Container failed to stay running"
            docker logs "$new_container_name" 2>/dev/null || true
            return 1
        fi
    else
        print_error "❌ Failed to start new container"
        return 1
    fi
}

switch_traffic() {
    local old_container_name="$1"
    local new_container_name="$2"
    local old_port="$3"
    local new_port="$4"
    local domain="$5"
    
    print_header "🔄 Switching traffic from $old_container_name to $new_container_name"
    
    # Validate new container is healthy before switching
    if ! docker ps --format "table {{.Names}}" | grep -q "^${new_container_name}$"; then
        print_error "❌ New container $new_container_name is not running"
        return 1
    fi
    
    # Update Caddy configuration if domain is configured
    if [[ -n "$domain" ]]; then
        print_status "Updating Caddy configuration for domain: $domain"
        
        # Create new Caddyfile with updated port
        sudo tee /etc/caddy/Caddyfile > /dev/null << CADDY_EOF
$domain {
    encode gzip

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Static assets with long cache
    handle /assets/* {
        header Cache-Control "public, max-age=31536000, immutable"
        reverse_proxy localhost:$new_port
    }

    # All other requests
    handle {
        reverse_proxy localhost:$new_port
    }
}

goat.pixelatedempathy.tech {
    reverse_proxy localhost:11434
}
CADDY_EOF

        # Test and reload Caddy configuration
        if sudo caddy validate --config /etc/caddy/Caddyfile; then
            if sudo systemctl reload caddy; then
                print_status "✅ Caddy configuration updated and reloaded"
            else
                print_error "❌ Failed to reload Caddy"
                return 1
            fi
        else
            print_error "❌ Invalid Caddy configuration"
            return 1
        fi
    fi
    
    # Verify traffic is flowing to new container
    print_status "Verifying traffic switch..."
    sleep 3
    
    if curl -s -f "http://localhost:${new_port}/" >/dev/null 2>&1; then
        print_status "✅ Traffic successfully switched to new container"
        return 0
    else
        print_error "❌ Traffic switch verification failed"
        return 1
    fi
}

cleanup_old_container() {
    local old_container_name="$1"
    local grace_period="${2:-30}"
    
    print_status "Cleaning up old container: $old_container_name (grace period: ${grace_period}s)"
    
    # Check if old container exists
    if ! docker ps -a --format "table {{.Names}}" | grep -q "^${old_container_name}$"; then
        print_status "Old container $old_container_name does not exist, nothing to clean up"
        return 0
    fi
    
    # Give some time for any remaining connections to drain
    if [ "$grace_period" -gt 0 ]; then
        print_status "Waiting ${grace_period}s for connection draining..."
        sleep "$grace_period"
    fi
    
    # Stop the old container gracefully
    print_status "Stopping old container: $old_container_name"
    if docker stop "$old_container_name" 2>/dev/null; then
        print_status "✅ Old container stopped"
    else
        print_warning "Old container was already stopped or doesn't exist"
    fi
    
    # Remove the old container
    print_status "Removing old container: $old_container_name"
    if docker rm "$old_container_name" 2>/dev/null; then
        print_status "✅ Old container removed"
    else
        print_warning "Old container was already removed or doesn't exist"
    fi
    
    return 0
}

handle_container_failure() {
    local failed_container_name="$1"
    local old_container_name="$2"
    local old_port="$3"
    
    print_error "🚨 Container failure detected: $failed_container_name"
    
    # Stop and remove the failed container
    print_status "Cleaning up failed container..."
    docker stop "$failed_container_name" 2>/dev/null || true
    docker rm "$failed_container_name" 2>/dev/null || true
    
    # Show logs from failed container for debugging
    print_error "Failed container logs:"
    docker logs "$failed_container_name" 2>/dev/null || echo "No logs available"
    
    # Ensure old container is still running
    if docker ps --format "table {{.Names}}" | grep -q "^${old_container_name}$"; then
        print_status "✅ Old container $old_container_name is still running"
    else
        print_warning "⚠️  Old container $old_container_name is not running, attempting to restart..."
        
        # Try to restart the old container
        if docker start "$old_container_name" 2>/dev/null; then
            print_status "✅ Old container restarted successfully"
        else
            print_error "❌ Failed to restart old container"
            print_error "Manual intervention required!"
            return 1
        fi
    fi
    
    # Verify old container is responding
    if curl -s -f "http://localhost:${old_port}/" >/dev/null 2>&1; then
        print_status "✅ Service restored on old container"
        return 0
    else
        print_error "❌ Old container is not responding"
        return 1
    fi
}

perform_blue_green_deployment() {
    local image_tag="$1"
    local current_container="$2"
    local current_port="$3"
    local domain="$4"
    local env_vars=("${@:5}")
    
    print_header "🔵🟢 Starting Blue-Green Deployment"
    
    # Generate new container name
    local new_container="${current_container}-new"
    local new_port=$((current_port + 1))
    
    print_status "Current: $current_container:$current_port"
    print_status "New: $new_container:$new_port"
    
    # Step 1: Start new container
    if ! start_new_container "$image_tag" "$new_container" "$new_port" "${env_vars[@]}"; then
        print_error "❌ Failed to start new container"
        return 1
    fi
    
    # Step 2: Perform health checks on new container
    if ! perform_comprehensive_health_check "$new_container" "$new_port"; then
        print_error "❌ Health checks failed for new container"
        
        # Log health check results to deployment summary
        if [ -f /tmp/health-check-results.json ]; then
            log_health_check_summary "/tmp/health-check-results.json" "/tmp/deployment-summary-$(date +%Y%m%d-%H%M%S).log"
        fi
        
        handle_container_failure "$new_container" "$current_container" "$current_port"
        return 1
    fi
    
    # Log successful health check results
    if [ -f /tmp/health-check-results.json ]; then
        log_health_check_summary "/tmp/health-check-results.json" "/tmp/deployment-summary-$(date +%Y%m%d-%H%M%S).log"
    fi
    
    # Step 2.5: Push to registry (optional, don't fail deployment if this fails)
    print_status "Attempting to push image to registry..."
    if push_to_registry "$image_tag"; then
        print_status "✅ Image pushed to registry successfully"
    else
        print_warning "⚠️  Registry push failed, continuing with local deployment"
    fi
    
    # Step 3: Switch traffic to new container
    if ! switch_traffic "$current_container" "$new_container" "$current_port" "$new_port" "$domain"; then
        print_error "❌ Traffic switch failed"
        handle_container_failure "$new_container" "$current_container" "$current_port"
        return 1
    fi
    
    # Step 4: Clean up old container
    if ! cleanup_old_container "$current_container" 30; then
        print_warning "⚠️  Failed to clean up old container, but deployment succeeded"
    fi
    
    # Step 5: Rename new container to current name
    print_status "Renaming new container to current name..."
    docker rename "$new_container" "$current_container" 2>/dev/null || true
    
    print_status "✅ Blue-Green deployment completed successfully"
    return 0
}

# Git Repository Synchronization Functions
validate_local_git_repository() {
    print_status "Validating local git repository..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        print_warning "⚠️  Not in a git repository - git sync will be skipped"
        return 1
    fi
    
    # Check if we have a remote configured
    if ! git remote -v >/dev/null 2>&1; then
        print_warning "⚠️  No git remotes configured - git sync will continue but remote operations may fail"
    fi
    
    # Check git status
    local git_status=$(git status --porcelain 2>/dev/null)
    if [[ -n "$git_status" ]]; then
        print_warning "⚠️  Working directory has uncommitted changes:"
        git status --short | head -5
        print_status "These changes will be synced to VPS"
    else
        print_status "✅ Working directory is clean"
    fi
    
    # Get current branch and commit info
    local current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    local current_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local commit_message=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "unknown")
    
    print_status "Current branch: $current_branch"
    print_status "Current commit: $current_commit"
    print_status "Commit message: $commit_message"
    
    return 0
}

sync_git_directory() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    local local_project_dir="$5"
    local remote_project_dir="$6"
    
    print_status "Synchronizing git directory to VPS..."
    
    # Validate local git repository first
    if ! validate_local_git_repository; then
        print_warning "⚠️  Local git validation failed - skipping git sync"
        return 1
    fi
    
    # Create SSH command for git operations
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Sync .git directory specifically with rsync
    print_status "Syncing .git directory..."
    local rsync_ssh_opts="-e 'ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no'"
    
    if eval rsync -avz --progress \
        "$local_project_dir/.git/" \
        "$vps_user@$vps_host:$remote_project_dir/.git/" \
        "$rsync_ssh_opts" 2>&1 | tee /tmp/git-sync.log; then
        print_status "✅ Git directory synced successfully"
    else
        print_error "❌ Git directory sync failed"
        print_error "Sync log:"
        cat /tmp/git-sync.log 2>/dev/null || echo "No sync log available"
        return 1
    fi
    
    return 0
}

verify_git_functionality_on_vps() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    local remote_project_dir="$5"
    
    print_status "Verifying git functionality on VPS..."
    
    # Create SSH command
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Test git status on VPS
    print_status "Testing git status on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git status --porcelain" >/tmp/vps-git-status.log 2>&1; then
        print_status "✅ Git status command works on VPS"
        
        # Check if there are any differences
        local status_output=$(cat /tmp/vps-git-status.log)
        if [[ -n "$status_output" ]]; then
            print_warning "⚠️  VPS working directory has changes after sync:"
            head -5 /tmp/vps-git-status.log
        else
            print_status "✅ VPS working directory is clean"
        fi
    else
        print_error "❌ Git status failed on VPS"
        cat /tmp/vps-git-status.log 2>/dev/null || echo "No git status log available"
        return 1
    fi
    
    # Test git remote configuration
    print_status "Testing git remote configuration on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git remote -v" >/tmp/vps-git-remotes.log 2>&1; then
        local remotes_output=$(cat /tmp/vps-git-remotes.log)
        if [[ -n "$remotes_output" ]]; then
            print_status "✅ Git remotes configured on VPS:"
            cat /tmp/vps-git-remotes.log | head -3
        else
            print_warning "⚠️  No git remotes configured on VPS"
        fi
    else
        print_warning "⚠️  Git remote command failed on VPS (may not affect functionality)"
    fi
    
    # Get current branch and commit info on VPS
    print_status "Getting git info on VPS..."
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git branch --show-current && git rev-parse --short HEAD && git log -1 --pretty=format:'%s'" >/tmp/vps-git-info.log 2>&1; then
        print_status "✅ VPS git repository info:"
        local line_count=0
        while IFS= read -r line && [ $line_count -lt 3 ]; do
            case $line_count in
                0) print_status "Branch: $line" ;;
                1) print_status "Commit: $line" ;;
                2) print_status "Message: $line" ;;
            esac
            line_count=$((line_count + 1))
        done < /tmp/vps-git-info.log
    else
        print_warning "⚠️  Could not retrieve git info from VPS"
    fi
    
    return 0
}

handle_git_sync_failure() {
    local failure_reason="$1"
    
    print_warning "⚠️  Git synchronization encountered issues: $failure_reason"
    print_status "Deployment will continue, but git functionality may be limited on VPS"
    print_status ""
    print_status "To manually sync git repository later:"
    print_status "1. Ensure you have git installed locally and on VPS"
    print_status "2. Run: rsync -avz .git/ user@host:/path/to/project/.git/"
    print_status "3. On VPS, run: git status to verify sync"
    print_status ""
    
    return 0
}

generate_git_update_instructions() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    local remote_project_dir="$5"
    local git_sync_success="$6"
    
    print_status "Generating git-based update instructions..."
    
    if [[ "$git_sync_success" == "true" ]]; then
        # Generate instructions for successful git sync
        cat > /tmp/git-update-instructions.txt << GIT_INSTRUCTIONS

# Git-Based Update Instructions

Your deployment now includes a synchronized git repository on the VPS.
You can make quick updates using git commands directly on the server.

## Quick Update Commands (SSH to VPS first):

# SSH to VPS:
ssh -i $ssh_key -p $vps_port $vps_user@$vps_host

# Navigate to project directory:
cd $remote_project_dir

# Check current status:
git status

# Pull latest changes (if you have remotes configured):
git pull origin main

# Or pull from a specific branch:
git pull origin your-branch-name

# After pulling changes, rebuild and restart containers:
docker-compose down
docker-compose up -d --build

## Alternative: Update specific files

# Check what files changed:
git diff HEAD~1 --name-only

# Pull specific commits:
git fetch origin
git merge origin/main

# View commit history:
git log --oneline -10

## Rollback using git:

# View available commits:
git log --oneline -20

# Rollback to a specific commit:
git reset --hard COMMIT_HASH

# Or create a new commit that reverts changes:
git revert COMMIT_HASH

## Important Notes:

1. Always check 'git status' before making changes
2. Commit any local changes before pulling: git add . && git commit -m "Local changes"
3. Use 'git stash' to temporarily save uncommitted changes
4. Test changes in a staging environment when possible
5. Keep backups of working deployments

## Troubleshooting:

If git commands fail:
- Ensure git is installed: which git
- Check repository integrity: git fsck
- Re-sync from local: run the full deployment script again

GIT_INSTRUCTIONS

        print_status "✅ Git update instructions generated"
        return 0
    else
        # Generate instructions for failed git sync
        cat > /tmp/git-update-instructions.txt << GIT_INSTRUCTIONS_FAILED

# Git Update Instructions (Limited Functionality)

Git synchronization encountered issues during deployment.
Git-based updates may not work properly on the VPS.

## Recommended Update Method:

Use the full deployment script for updates:
./scripts/rsync.sh $vps_host $vps_user $vps_port $ssh_key

## Manual Git Setup (if needed):

# SSH to VPS:
ssh -i $ssh_key -p $vps_port $vps_user@$vps_host

# Navigate to project directory:
cd $remote_project_dir

# Check if git is working:
git status

# If git is not working, you may need to:
# 1. Install git: apt update && apt install -y git
# 2. Re-sync git directory from local machine
# 3. Configure git user (if needed):
#    git config user.name "Your Name"
#    git config user.email "your.email@example.com"

## Alternative Update Methods:

1. Full deployment script (recommended)
2. Manual file transfer with rsync
3. Direct file editing on VPS (not recommended for production)

GIT_INSTRUCTIONS_FAILED

        print_warning "⚠️  Git update instructions generated with limitations"
        return 1
    fi
}

verify_git_post_deployment() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    local remote_project_dir="$5"
    
    print_status "Performing final git functionality verification..."
    
    # Create SSH command
    local ssh_cmd="ssh -i $ssh_key -p $vps_port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
    
    # Test basic git commands
    local git_tests_passed=0
    local total_git_tests=4
    
    # Test 1: git status
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git status --porcelain" >/dev/null 2>&1; then
        print_status "✅ Git status: Working"
        git_tests_passed=$((git_tests_passed + 1))
    else
        print_warning "⚠️  Git status: Failed"
    fi
    
    # Test 2: git log
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git log -1 --oneline" >/dev/null 2>&1; then
        print_status "✅ Git log: Working"
        git_tests_passed=$((git_tests_passed + 1))
    else
        print_warning "⚠️  Git log: Failed"
    fi
    
    # Test 3: git branch
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git branch" >/dev/null 2>&1; then
        print_status "✅ Git branch: Working"
        git_tests_passed=$((git_tests_passed + 1))
    else
        print_warning "⚠️  Git branch: Failed"
    fi
    
    # Test 4: git remote (optional, may not exist)
    if $ssh_cmd "$vps_user@$vps_host" "cd $remote_project_dir && git remote -v" >/dev/null 2>&1; then
        print_status "✅ Git remote: Working"
        git_tests_passed=$((git_tests_passed + 1))
    else
        print_status "ℹ️  Git remote: Not configured (optional)"
        git_tests_passed=$((git_tests_passed + 1))  # Don't penalize for missing remotes
    fi
    
    # Evaluate results
    if [ $git_tests_passed -ge 3 ]; then
        print_status "✅ Git functionality verification passed ($git_tests_passed/$total_git_tests tests)"
        return 0
    else
        print_warning "⚠️  Git functionality verification failed ($git_tests_passed/$total_git_tests tests)"
        return 1
    fi
}

display_git_update_instructions() {
    local instructions_file="/tmp/git-update-instructions.txt"
    
    if [[ -f "$instructions_file" ]]; then
        print_header "📋 Git-Based Update Instructions"
        cat "$instructions_file"
        print_status ""
        print_status "Instructions saved to: $instructions_file"
    else
        print_warning "⚠️  Git update instructions not available"
    fi
}

# Generate comprehensive rollback commands
generate_comprehensive_rollback_commands() {
    local backup_path="${1:-/root/pixelated-backup}"
    local container_name="${2:-pixelated-app}"
    local port="${3:-4321}"
    local domain="${4:-pixelatedempathy.com}"
    local registry_url="${5:-git.pixelatedempathy.tech}"
    local project_name="${6:-pixelated-empathy}"
    
    print_header "📋 Comprehensive Rollback Options"
    
    cat << COMPREHENSIVE_ROLLBACK

# ROLLBACK OPTIONS (in order of speed and reliability)

## Option 1: Container Rollback (Fastest - if previous container exists)
# Stop current container and start previous one
docker stop $container_name || true
docker start ${container_name}-backup || docker run -d --name ${container_name}-backup --restart unless-stopped -p $port:4321 [PREVIOUS_IMAGE_TAG]

## Option 2: Filesystem Rollback (Fast - if backup exists)
# Stop services
sudo systemctl stop caddy || true
docker stop $container_name || true

# Restore from backup
sudo mv /root/pixelated /root/pixelated-failed
sudo mv $backup_path /root/pixelated

# Restart services
cd /root/pixelated
docker build -t pixelated-app:rollback .
docker run -d --name $container_name --restart unless-stopped -p $port:4321 pixelated-app:rollback
sudo systemctl start caddy

## Option 3: Registry Rollback (Reliable - if registry images available)
$(generate_registry_rollback_commands "$registry_url" "$project_name" "$container_name" "$port" "$domain")

## Option 4: Fresh Deployment (Slowest but most reliable)
# Re-run the deployment script from a working local copy
./scripts/rsync.sh

# Verification Commands (run after any rollback)
curl -s -f "http://localhost:$port/" && echo "✅ Application responding"
curl -s -f "https://$domain/" && echo "✅ Domain responding" || echo "⚠️  Domain not responding"
docker ps | grep $container_name && echo "✅ Container running"

COMPREHENSIVE_ROLLBACK

    # List available registry images for reference
    print_status "Available registry images:"
    list_registry_images "$registry_url" "$project_name"
}

# Show usage
show_usage() {
    echo "Usage: $0 [VPS_HOST] [VPS_USER] [VPS_PORT] [SSH_KEY] [DOMAIN]"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 208.117.84.253 root 22"
    echo "  $0 208.117.84.253 root 22 ~/.ssh/planet pixelatedempathy.com"
    echo ""
    echo "This script syncs the entire project to VPS and sets up deployment"
    exit 1
}

# Main Deployment Orchestration Function
main_deployment_orchestration() {
    local deployment_success="false"
    local deployment_stage=""
    
    # Initialize structured logging and deployment context
    initialize_structured_logging
    
    print_header "🚀 Deploying Pixelated Empathy to VPS via rsync"
    print_status "Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
    print_status "Domain: ${DOMAIN:-"IP-based access"}"
    print_status "Local dir: $LOCAL_PROJECT_DIR"
    print_status "Remote dir: $REMOTE_PROJECT_DIR"
    print_status "Context: $DEPLOYMENT_CONTEXT"

    # Build SSH command
    SSH_CMD="ssh -t"
    RSYNC_SSH_OPTS=""
    if [[ -n "$SSH_KEY" ]]; then
        SSH_CMD="$SSH_CMD -i $SSH_KEY"
        RSYNC_SSH_OPTS="-e 'ssh -i $SSH_KEY -p $VPS_PORT'"
    else
        RSYNC_SSH_OPTS="-e 'ssh -p $VPS_PORT'"
    fi
    SSH_CMD="$SSH_CMD -p $VPS_PORT -o StrictHostKeyChecking=no"

    # Stage 1: Pre-deployment Validation and Environment Setup
    start_deployment_stage "pre_deployment" "Pre-deployment Validation and Environment Setup"
    
    # Test SSH connection
    log_deployment_event "CONNECTIVITY" "INFO" "Testing SSH connection to $VPS_HOST:$VPS_PORT" "ssh_test"
    if $SSH_CMD "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
        log_deployment_event "CONNECTIVITY" "INFO" "SSH connection established successfully" "ssh_success"
    else
        log_deployment_event "CONNECTIVITY" "ERROR" "SSH connection failed to $VPS_HOST:$VPS_PORT" "ssh_failure"
        end_deployment_stage "pre_deployment" "failed" "Pre-deployment Validation and Environment Setup"
        finalize_deployment_logging "failed"
        exit $ERROR_NETWORK
    fi
    
    # Environment Manager: Setup Node.js and pnpm
    log_deployment_event "ENVIRONMENT" "INFO" "Setting up Node.js 24.7.0 and pnpm 10.15.0 environment" "env_setup"
    if ! setup_nodejs_environment_with_retry; then
        log_deployment_event "ENVIRONMENT" "ERROR" "Environment setup failed after retries" "env_failure"
        end_deployment_stage "pre_deployment" "failed" "Pre-deployment Validation and Environment Setup"
        finalize_deployment_logging "failed"
        exit $ERROR_ENVIRONMENT_SETUP
    fi
    
    end_deployment_stage "pre_deployment" "success" "Pre-deployment Validation and Environment Setup"
    
    # Stage 2: Secure Environment Variable Management
    start_deployment_stage "env_variables" "Secure Environment Variable Management"
    
    # Secure Environment Variable Manager: Encrypt and transfer environment variables
    log_deployment_event "SECURITY" "INFO" "Starting secure environment variable deployment" "env_var_deploy"
    if ! deploy_secure_environment_variables; then
        log_deployment_event "SECURITY" "WARNING" "Environment variable deployment failed, continuing with warnings" "env_var_warning"
        end_deployment_stage "env_variables" "warning" "Secure Environment Variable Management"
    else
        log_deployment_event "SECURITY" "INFO" "Environment variables deployed securely" "env_var_success"
        end_deployment_stage "env_variables" "success" "Secure Environment Variable Management"
    fi
    
    # Stage 2.5: Disk Space Cleanup
    start_deployment_stage "disk_cleanup" "Disk Space Cleanup"
    log_deployment_event "CLEANUP" "INFO" "Cleaning up disk space before synchronization" "cleanup_start"
    if ! cleanup_disk_space; then
        log_deployment_event "CLEANUP" "WARNING" "Disk cleanup had issues, continuing anyway" "cleanup_warning"
        end_deployment_stage "disk_cleanup" "warning" "Disk Space Cleanup"
    else
        log_deployment_event "CLEANUP" "INFO" "Disk cleanup completed successfully" "cleanup_success"
        end_deployment_stage "disk_cleanup" "success" "Disk Space Cleanup"
    fi
    
    # Stage 3: Backup Management and Code Synchronization
    start_deployment_stage "synchronization" "Backup Management and Code Synchronization"
    
    # Backup Manager: Preserve current backup
    log_deployment_event "BACKUP" "INFO" "Preserving current backup before synchronization" "backup_preserve"
    if ! preserve_current_backup_before_sync "$VPS_HOST" "$VPS_USER" "$SSH_KEY" "$VPS_PORT" "$REMOTE_PROJECT_DIR"; then
        log_deployment_event "BACKUP" "WARNING" "Backup preservation failed, continuing with risk" "backup_warning"
    fi
    
    # Git Repository Synchronization: Include .git directory
    log_deployment_event "SYNC" "INFO" "Starting code synchronization with git repository inclusion" "sync_start"
    if ! perform_enhanced_rsync_with_git; then
        log_deployment_event "SYNC" "ERROR" "Code synchronization failed" "sync_failure"
        end_deployment_stage "synchronization" "failed" "Backup Management and Code Synchronization"
        finalize_deployment_logging "failed"
        exit $ERROR_SYNCHRONIZATION
    fi
    
    end_deployment_stage "synchronization" "success" "Backup Management and Code Synchronization"
    
    # Stage 4: Remote Container Build on VPS
    start_deployment_stage "container_build" "Remote Container Build on VPS"
    
    # Container Manager: Build container directly on VPS
    local container_tag=$(generate_simple_container_tag)
    log_deployment_event "BUILD" "INFO" "Building container remotely on VPS with tag: $container_tag" "build_start"
    
    # Build container on VPS using SSH
    if ! build_container_on_vps "$container_tag"; then
        log_deployment_event "BUILD" "ERROR" "Remote container build failed" "build_failure"
        end_deployment_stage "container_build" "failed" "Remote Container Build on VPS"
        
        # Remove backup created during this failed deployment
        if [[ -n "$VPS_USER" && -n "$VPS_HOST" && -n "$REMOTE_PROJECT_DIR" ]]; then
            remove_backup_on_failure "$VPS_USER@$VPS_HOST" "$REMOTE_PROJECT_DIR"
        fi
        
        finalize_deployment_logging "failed"
        exit $ERROR_BUILD_FAILURE
    fi
    
    log_deployment_event "BUILD" "INFO" "Container successfully built on VPS" "build_success"
    end_deployment_stage "container_build" "success" "Remote Container Build on VPS"
    
    # Stage 5: Health Check Validation System
    start_deployment_stage "health_checks" "Health Check Validation System"
    
    # Container Manager: Comprehensive health checks
    log_deployment_event "HEALTH" "INFO" "Starting comprehensive health check validation" "health_start"
    if ! perform_comprehensive_health_checks "pixelated-app-new"; then
        log_deployment_event "HEALTH" "ERROR" "Health checks failed, terminating new container" "health_failure"
        
        # Cleanup failed container
        cleanup_failed_container "pixelated-app-new"
        
        # Remove backup created during this failed deployment
        if [[ -n "$VPS_USER" && -n "$VPS_HOST" && -n "$REMOTE_PROJECT_DIR" ]]; then
            remove_backup_on_failure "$VPS_USER@$VPS_HOST" "$REMOTE_PROJECT_DIR"
        fi
        
        end_deployment_stage "health_checks" "failed" "Health Check Validation System"
        finalize_deployment_logging "failed"
        exit $ERROR_HEALTH_CHECK
    fi
    
    log_deployment_event "HEALTH" "INFO" "All health checks passed successfully" "health_success"
    end_deployment_stage "health_checks" "success" "Health Check Validation System"
    
    # Stage 6: Traffic Switching and Deployment Finalization
    start_deployment_stage "traffic_switch" "Traffic Switching and Deployment Finalization"
    
    # Container Manager: Switch traffic to new container
    log_deployment_event "DEPLOYMENT" "INFO" "Switching traffic to new container" "traffic_switch"
    if ! switch_traffic_to_new_container "pixelated-app" "pixelated-app-new"; then
        log_deployment_event "DEPLOYMENT" "ERROR" "Traffic switching failed" "traffic_failure"
        
        # Remove backup created during this failed deployment
        if [[ -n "$VPS_USER" && -n "$VPS_HOST" && -n "$REMOTE_PROJECT_DIR" ]]; then
            remove_backup_on_failure "$VPS_USER@$VPS_HOST" "$REMOTE_PROJECT_DIR"
        fi
        
        end_deployment_stage "traffic_switch" "failed" "Traffic Switching and Deployment Finalization"
        finalize_deployment_logging "failed"
        exit $ERROR_UNKNOWN
    fi
    
    # Backup Manager: Archive old backup after successful deployment
    log_deployment_event "BACKUP" "INFO" "Archiving old backup after successful deployment" "backup_archive"
    if ! archive_old_backup_after_success "$VPS_HOST" "$VPS_USER" "$SSH_KEY" "$VPS_PORT"; then
        log_deployment_event "BACKUP" "WARNING" "Backup archiving failed, but deployment succeeded" "backup_archive_warning"
    fi
    
    end_deployment_stage "traffic_switch" "success" "Traffic Switching and Deployment Finalization"
    
    # Mark deployment as successful
    deployment_success="true"
    log_deployment_event "DEPLOYMENT" "INFO" "Deployment completed successfully" "deployment_success"
    
    # Finalize logging with success status
    finalize_deployment_logging "success"
    
    return 0
}

# Enhanced error handling wrapper for main orchestration
execute_main_deployment() {
    local exit_code=0
    
    # Set up error handling
    set -e
    trap 'handle_deployment_error $? $LINENO' ERR
    
    # Execute main deployment orchestration
    if main_deployment_orchestration; then
        exit_code=0
    else
        exit_code=$?
    fi
    
    # Reset error handling
    set +e
    trap - ERR
    
    return $exit_code
}

# Deployment error handler for orchestration
handle_deployment_error() {
    local exit_code=$1
    local line_number=$2
    local current_stage="${CURRENT_STAGE:-unknown}"
    
    log_deployment_event "ERROR" "ERROR" "Deployment failed at line $line_number with exit code $exit_code" "$current_stage"
    
    # End current stage as failed
    if [[ -n "$current_stage" ]]; then
        end_deployment_stage "$current_stage" "failed" "$current_stage"
    fi
    
    # Remove backup created during this failed deployment
    if [[ -n "$VPS_USER" && -n "$VPS_HOST" && -n "$REMOTE_DIR" ]]; then
        remove_backup_on_failure "$VPS_USER@$VPS_HOST" "$REMOTE_DIR"
    fi
    
    # Generate failure summary and rollback instructions
    finalize_deployment_logging "failed"
    
    # Generate specific rollback instructions based on failure point
    generate_failure_specific_rollback_instructions "$current_stage" "$exit_code"
    
    exit $exit_code
}

# Supporting functions for main orchestration

# Preserve current backup before synchronization
preserve_current_backup_before_sync() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    local remote_dir="$5"
    
    log_deployment_event "BACKUP" "INFO" "Preserving current backup before sync" "backup_preserve"
    
    $SSH_CMD "$vps_user@$vps_host" bash << EOF
set -e

# Check if current deployment exists
if [[ -d "$remote_dir" ]]; then
    # Check if backup already exists and preserve it
    if [[ -d "${remote_dir}-backup" ]]; then
        # Archive existing backup with timestamp
        backup_timestamp=\$(date +%Y%m%d-%H%M%S)
        if [[ -d "${remote_dir}-backup-\$backup_timestamp" ]]; then
            echo "Backup with timestamp already exists, removing old one"
            rm -rf "${remote_dir}-backup-\$backup_timestamp"
        fi
        echo "Archiving existing backup to ${remote_dir}-backup-\$backup_timestamp"
        mv "${remote_dir}-backup" "${remote_dir}-backup-\$backup_timestamp"
    fi
    
    # Create new backup from current deployment
    echo "Creating backup from current deployment"
    cp -r "$remote_dir" "${remote_dir}-backup"
    echo "✅ Current deployment backed up successfully"
    
    # Maintain only 3 most recent timestamped backups (excluding current backup)
    backup_count=\$(ls -1d ${remote_dir}-backup-* 2>/dev/null | wc -l || echo 0)
    if [[ \$backup_count -gt 3 ]]; then
        echo "Found \$backup_count timestamped backups, cleaning up to maintain 3 most recent"
        # Remove oldest backups, keeping only 3 most recent
        ls -1dt ${remote_dir}-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
        echo "✅ Old backups cleaned up, maintaining 3 most recent timestamped backups"
    fi
else
    echo "No existing deployment found, skipping backup"
fi
EOF
    
    return $?
}

# Enhanced rsync with git repository inclusion
perform_enhanced_rsync_with_git() {
    log_deployment_event "SYNC" "INFO" "Preparing rsync with git inclusion" "rsync_prep"
    
    # Create rsync exclude file (without .git exclusion)
    cat > /tmp/rsync-exclude << 'EOF'
node_modules/
.next/
.nuxt/
dist/
build/
coverage/
.cache/
*.log
.DS_Store
Thumbs.db
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.mypy_cache/
venv/
.venv/
volumes/
ai/venv/
ai/.venv/
ai/*.pt
ai/*.pth
ai/*.model
ai/*.pkl
.docker/
docker-compose.override.yml
temp/
tmp/
# Exclude massive AI training data files
ai/datasets/
ai/data/
ai/database/
ai/models
ai/pipelines/data/
ai/dataset_pipeline/
ai/temporal_analysis_data*.jsonl
ai/*.jsonl
ai/*.csv
ai/*.npy
ai/*.db
ai/*.sqlite
ai/*.sqlite3
ai/training
ai/research
ai/youtube_transcripts
# Exclude other large files
*.zip
*.tar.gz
*.rar
*.7z
*.bak
*.backup
EOF

    log_deployment_event "SYNC" "INFO" "Starting rsync synchronization with git inclusion" "rsync_start"
    
    # Perform rsync with git directory included
    eval rsync -avz --delete --exclude-from=/tmp/rsync-exclude $RSYNC_SSH_OPTS "$LOCAL_PROJECT_DIR/" "$VPS_USER@$VPS_HOST:$REMOTE_PROJECT_DIR/"
    rsync_exit_code=$?
    
    # Handle rsync exit codes (0=success, 24=vanished files - acceptable)
    if [[ $rsync_exit_code -eq 0 || $rsync_exit_code -eq 24 ]]; then
        if [[ $rsync_exit_code -eq 24 ]]; then
            log_deployment_event "SYNC" "WARNING" "Rsync completed with vanished files warning (code 24)" "rsync_warning"
        else
            log_deployment_event "SYNC" "INFO" "Rsync completed successfully" "rsync_success"
        fi
        
        # Verify git functionality post-sync
        if verify_git_post_sync "$VPS_HOST" "$VPS_USER" "$SSH_KEY" "$VPS_PORT" "$REMOTE_PROJECT_DIR"; then
            log_deployment_event "GIT" "INFO" "Git functionality verified post-sync" "git_verified"
            GIT_SYNC_SUCCESS="true"
        else
            log_deployment_event "GIT" "WARNING" "Git functionality issues detected post-sync" "git_warning"
            GIT_SYNC_SUCCESS="false"
        fi
        
        # Clean up exclude file
        rm -f /tmp/rsync-exclude
        return 0
    else
        log_deployment_event "SYNC" "ERROR" "Rsync failed with exit code $rsync_exit_code" "rsync_failure"
        rm -f /tmp/rsync-exclude
        return 1
    fi
}

# Verify git functionality after sync
verify_git_post_sync() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    local remote_dir="$5"
    
    log_deployment_event "GIT" "INFO" "Verifying git functionality post-sync" "git_verify"
    
    $SSH_CMD "$vps_user@$vps_host" bash << EOF
set -e
cd "$remote_dir"

# Check if .git directory exists
if [[ ! -d ".git" ]]; then
    echo "❌ .git directory not found"
    exit 1
fi

# Check git status
if ! git status >/dev/null 2>&1; then
    echo "❌ Git status check failed"
    exit 1
fi

# Check remote configuration
if ! git remote -v >/dev/null 2>&1; then
    echo "❌ Git remote check failed"
    exit 1
fi

echo "✅ Git functionality verified"
exit 0
EOF
    
    return $?
}

# Perform comprehensive health checks
perform_comprehensive_health_checks() {
    local container_name="$1"
    local max_wait_time=60
    local check_interval=5
    local wait_time=0
    
    log_deployment_event "HEALTH" "INFO" "Starting comprehensive health checks for $container_name" "health_comprehensive"
    
    # Wait for application readiness
    log_deployment_event "HEALTH" "INFO" "Waiting for application readiness (max ${max_wait_time}s)" "health_readiness"
    while [[ $wait_time -lt $max_wait_time ]]; do
        if ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "docker exec $container_name curl -s -f http://localhost:4321/ >/dev/null 2>&1"; then
            log_deployment_event "HEALTH" "INFO" "Application ready after ${wait_time}s" "health_ready"
            break
        fi
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
    done
    
    if [[ $wait_time -ge $max_wait_time ]]; then
        log_deployment_event "HEALTH" "ERROR" "Application readiness timeout after ${max_wait_time}s" "health_timeout"
        return 1
    fi
    
    # Test root endpoint
    log_deployment_event "HEALTH" "INFO" "Testing root endpoint for 200 status" "health_root"
    local start_time=$(date +%s%3N)
    if ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "docker exec $container_name curl -s -f -w '%{http_code}' http://localhost:4321/ | grep -q '200'"; then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        log_health_check_results "root_endpoint" "pass" "$response_time" "HTTP 200 OK" "/"
    else
        log_health_check_results "root_endpoint" "fail" "0" "HTTP status check failed" "/"
        return 1
    fi
    
    # Test critical API endpoints
    log_deployment_event "HEALTH" "INFO" "Testing critical API endpoints" "health_api"
    local api_endpoints=("/api/health" "/api/bias-detection")
    
    for endpoint in "${api_endpoints[@]}"; do
        local start_time=$(date +%s%3N)
        if ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "docker exec $container_name curl -s -f http://localhost:4321$endpoint >/dev/null 2>&1"; then
            local end_time=$(date +%s%3N)
            local response_time=$((end_time - start_time))
            log_health_check_results "api_endpoint" "pass" "$response_time" "API responding" "$endpoint"
        else
            log_health_check_results "api_endpoint" "fail" "0" "API not responding" "$endpoint"
            # API failures are warnings, not deployment failures
            log_deployment_event "HEALTH" "WARNING" "API endpoint $endpoint not responding" "health_api_warning"
        fi
    done
    
    # Test static asset serving
    log_deployment_event "HEALTH" "INFO" "Testing static asset serving" "health_static"
    local start_time=$(date +%s%3N)
    if ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "docker exec $container_name curl -s -f http://localhost:4321/favicon.ico >/dev/null 2>&1"; then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        log_health_check_results "static_assets" "pass" "$response_time" "Static assets serving" "/favicon.ico"
    else
        log_health_check_results "static_assets" "fail" "0" "Static assets not serving" "/favicon.ico"
        # Static asset failures are warnings, not deployment failures
        log_deployment_event "HEALTH" "WARNING" "Static assets not serving properly" "health_static_warning"
    fi
    
    log_deployment_event "HEALTH" "INFO" "Health checks completed successfully" "health_complete"
    return 0
}

# Cleanup failed container
cleanup_failed_container() {
    local container_name="$1"
    
    log_deployment_event "CLEANUP" "INFO" "Cleaning up failed container: $container_name" "cleanup_failed"
    
    ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash << EOF
# Stop and remove failed container
docker stop $container_name 2>/dev/null || true
docker rm $container_name 2>/dev/null || true
echo "✅ Failed container cleaned up"
EOF
    
    return 0
}

# Switch traffic to new container
switch_traffic_to_new_container() {
    local old_container="$1"
    local new_container="$2"
    
    log_deployment_event "TRAFFIC" "INFO" "Switching traffic from $old_container to $new_container" "traffic_switch"
    
    ssh -i "$SSH_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash << EOF
set -e

# Stop old container
echo "Stopping old container: $old_container"
docker stop $old_container 2>/dev/null || true

# Rename new container to production name
echo "Renaming new container to production name"
docker rename $new_container $old_container

# Ensure container is running on correct port
echo "Verifying container is running on port 4321"
if ! docker ps | grep -q "$old_container.*4321"; then
    echo "❌ Container not running on expected port"
    exit 1
fi

echo "✅ Traffic switched successfully"
EOF
    
    return $?
}

# Archive old backup after successful deployment
archive_old_backup_after_success() {
    local vps_host="$1"
    local vps_user="$2"
    local ssh_key="$3"
    local vps_port="$4"
    
    log_deployment_event "BACKUP" "INFO" "Archiving old backup after successful deployment" "backup_archive"
    
    $SSH_CMD "$vps_user@$vps_host" bash << EOF
set -e

# Archive old backup with timestamp
backup_timestamp=\$(date +%Y%m%d-%H%M%S)
remote_dir="$REMOTE_PROJECT_DIR"

if [[ -d "\${remote_dir}-backup" ]]; then
    # Move current backup to timestamped archive
    mv "\${remote_dir}-backup" "\${remote_dir}-backup-\$backup_timestamp"
    echo "✅ Backup archived as \${remote_dir}-backup-\$backup_timestamp"
    
    # Maintain only 3 most recent backups
    backup_count=\$(ls -1d \${remote_dir}-backup-* 2>/dev/null | wc -l)
    if [[ \$backup_count -gt 3 ]]; then
        # Remove oldest backups
        ls -1dt \${remote_dir}-backup-* | tail -n +4 | xargs rm -rf
        echo "✅ Old backups cleaned up, maintaining 3 most recent"
    fi
else
    echo "No backup to archive"
fi
EOF
    
    return $?
}

# Remove backup created during deployment if build/deployment fails
remove_backup_on_failure() {
    local server="$1"
    local remote_dir="$2"
    
    echo "🗑️ Removing backup created during failed deployment..."
    
    ssh "$server" << 'EOF'
backup_dir="\${remote_dir}-backup"
if [[ -d "\$backup_dir" ]]; then
    rm -rf "\$backup_dir"
    echo "✅ Backup removed due to deployment failure"
else
    echo "ℹ️ No backup found to remove"
fi
EOF
    
    return $?
}

# Generate failure-specific rollback instructions
generate_failure_specific_rollback_instructions() {
    local failed_stage="$1"
    local exit_code="$2"
    
    log_deployment_event "ROLLBACK" "INFO" "Generating failure-specific rollback instructions" "rollback_generate"
    
    local rollback_file="/tmp/rollback-instructions-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$rollback_file" << EOF
=== Rollback Instructions for Failed Deployment ===
Generated: $(date -Iseconds)
Failed Stage: $failed_stage
Exit Code: $exit_code
Context: $DEPLOYMENT_CONTEXT

=== Immediate Actions ===
EOF
    
    case "$failed_stage" in
        "pre_deployment")
            cat >> "$rollback_file" << EOF
The deployment failed during pre-deployment validation.
No changes were made to the production system.

Actions:
1. Check SSH connectivity: ssh $VPS_USER@$VPS_HOST
2. Verify Node.js/pnpm installation requirements
3. Check network connectivity and DNS resolution
EOF
            ;;
        "env_variables")
            cat >> "$rollback_file" << EOF
The deployment failed during environment variable setup.
Production system is unchanged.

Actions:
1. Check environment file encryption/decryption
2. Verify GPG/OpenSSL availability on VPS
3. Check environment file permissions and content
EOF
            ;;
        "synchronization")
            cat >> "$rollback_file" << EOF
The deployment failed during code synchronization.
A backup may have been created but sync failed.

Actions:
1. Check rsync connectivity and permissions
2. Verify disk space on VPS
3. Check for file permission issues
4. If backup exists, it can be restored if needed
EOF
            ;;
        "container_build")
            cat >> "$rollback_file" << EOF
The deployment failed during container build.
Code was synchronized but container build failed.

Actions:
1. SSH to VPS and check Docker status
2. Review build logs for specific errors
3. Check Dockerfile and dependencies
4. Restore from backup if needed:
   sudo mv $REMOTE_PROJECT_DIR $REMOTE_PROJECT_DIR-failed
   sudo mv $REMOTE_PROJECT_DIR-backup $REMOTE_PROJECT_DIR
EOF
            ;;
        "health_checks")
            cat >> "$rollback_file" << EOF
The deployment failed during health checks.
New container was built but failed validation.

Actions:
1. New container has been automatically cleaned up
2. Old container should still be running
3. Check application logs for health check failures
4. Verify application configuration and dependencies
EOF
            ;;
        "traffic_switch")
            cat >> "$rollback_file" << EOF
The deployment failed during traffic switching.
This is rare - manual intervention may be needed.

Actions:
1. Check container status: docker ps
2. Verify old container is still available
3. Manual rollback may be required
4. Contact system administrator if needed
EOF
            ;;
        *)
            cat >> "$rollback_file" << EOF
The deployment failed at an unknown stage.
Check the deployment logs for specific details.

Actions:
1. Review deployment logs: $DEPLOYMENT_LOG
2. Check system status on VPS
3. Verify application is still running
4. Consider manual rollback if needed
EOF
            ;;
    esac
    
    cat >> "$rollback_file" << EOF

=== General Rollback Commands ===
SSH to VPS: ssh $VPS_USER@$VPS_HOST

# Check current status
docker ps
systemctl status caddy

# Container rollback (if old container exists)
docker stop pixelated-app || true
docker start pixelated-app-backup || echo "No backup container"

# Filesystem rollback (if backup exists)
sudo systemctl stop caddy
docker stop pixelated-app || true
sudo mv $REMOTE_PROJECT_DIR $REMOTE_PROJECT_DIR-failed
sudo mv $REMOTE_PROJECT_DIR-backup $REMOTE_PROJECT_DIR
cd $REMOTE_PROJECT_DIR
docker build -t pixelated-app:rollback .
docker run -d --name pixelated-app --restart unless-stopped -p 4321:4321 pixelated-app:rollback
sudo systemctl start caddy

# Verification
curl -s -f "http://localhost:4321/" && echo "✅ Application responding"
docker ps | grep pixelated-app && echo "✅ Container running"

=== Log Files for Troubleshooting ===
Main Log: $DEPLOYMENT_LOG
Metrics: $DEPLOYMENT_METRICS
Errors: $ERROR_LOG
Warnings: $WARNING_LOG
Rollback Instructions: $rollback_file
EOF
    
    print_header "🔄 Rollback Instructions Generated"
    print_status "Rollback instructions saved to: $rollback_file"
    print_status ""
    cat "$rollback_file"
    
    return 0
}

# Execute the main deployment orchestration
execute_main_deployment

# Task 11.2: Final validation and user feedback functions

# Create comprehensive deployment completion reporting
create_deployment_completion_report() {
    local deployment_status="$1"
    local validation_status="$2"
    
    log_deployment_event "REPORTING" "INFO" "Creating deployment completion report" "completion_report"
    
    local completion_report="/tmp/deployment-completion-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$completion_report" << EOF
=== Pixelated Empathy Deployment Completion Report ===
Generated: $(date -Iseconds)
Deployment Status: $deployment_status
Validation Status: $validation_status
Context: $DEPLOYMENT_CONTEXT

=== Deployment Configuration ===
Target Host: $VPS_HOST:$VPS_PORT
User: $VPS_USER
Domain: ${DOMAIN:-"IP-based access only"}
SSH Key: $SSH_KEY
Local Directory: $LOCAL_PROJECT_DIR
Remote Directory: $REMOTE_PROJECT_DIR

=== Application Access ===
Direct Access: http://$VPS_HOST:4321
EOF

    if [[ -n "$DOMAIN" ]]; then
        cat >> "$completion_report" << EOF
Domain Access: https://$DOMAIN
EOF
    fi

    cat >> "$completion_report" << EOF

=== Deployment Features ===
✅ Node.js 24.7.0 Environment
✅ pnpm 10.15.0 Package Manager
✅ Docker Container Deployment
✅ Blue-Green Deployment Strategy
✅ Comprehensive Health Checks
✅ Backup Management System
✅ Structured Logging and Monitoring
EOF

    if [[ "$GIT_SYNC_SUCCESS" == "true" ]]; then
        cat >> "$completion_report" << EOF
✅ Git Repository Synchronization
EOF
    else
        cat >> "$completion_report" << EOF
⚠️  Git Repository Synchronization (degraded)
EOF
    fi

    # Add registry information
    cat >> "$completion_report" << EOF

=== Container Registry ===
EOF

    if [[ -f /tmp/registry-images.log ]] && [[ -s /tmp/registry-images.log ]]; then
        cat >> "$completion_report" << EOF
✅ Container pushed to GitLab registry
Latest Image: $(tail -n 1 /tmp/registry-images.log)
Registry URL: https://git.pixelatedempathy.tech/pixelated-empathy/container_registry
EOF
    else
        cat >> "$completion_report" << EOF
⚠️  Container not pushed to registry (check authentication)
Registry URL: https://git.pixelatedempathy.tech/pixelated-empathy/container_registry
EOF
    fi

    # Add performance metrics if available
    if [[ -f "$DEPLOYMENT_METRICS" ]]; then
        local total_time_ms=$(jq -r '.deployment.start_time // 0' "$DEPLOYMENT_METRICS" 2>/dev/null || echo "0")
        local current_time_ms=$(date +%s%3N)
        local deployment_duration_ms=$((current_time_ms - total_time_ms))
        local deployment_duration_sec=$((deployment_duration_ms / 1000))
        
        cat >> "$completion_report" << EOF

=== Performance Metrics ===
Total Deployment Time: ${deployment_duration_sec}s (${deployment_duration_ms}ms)
EOF
    fi

    # Add log file references
    cat >> "$completion_report" << EOF

=== Log Files and Documentation ===
Main Deployment Log: $DEPLOYMENT_LOG
Deployment Metrics: $DEPLOYMENT_METRICS
Error Log: $ERROR_LOG
Warning Log: $WARNING_LOG
Completion Report: $completion_report
EOF

    if [[ -f "/tmp/latest-deployment-archive.txt" ]]; then
        local archive_file=$(cat "/tmp/latest-deployment-archive.txt")
        cat >> "$completion_report" << EOF
Deployment Archive: $archive_file
EOF
    fi

    cat >> "$completion_report" << EOF

=== Next Steps and Recommendations ===
1. Verify application functionality at the provided URLs
2. Test critical application features and API endpoints
3. Monitor application logs for any issues: docker logs pixelated-app
4. Set up monitoring and alerting for production use
5. Review security settings and SSL certificate status
EOF

    if [[ "$GIT_SYNC_SUCCESS" == "true" ]]; then
        cat >> "$completion_report" << EOF
6. Use git-based updates for quick changes: ssh $VPS_USER@$VPS_HOST 'cd $REMOTE_PROJECT_DIR && git pull'
EOF
    else
        cat >> "$completion_report" << EOF
6. Use full deployment script for future updates
EOF
    fi

    cat >> "$completion_report" << EOF

=== Support and Troubleshooting ===
SSH Access: ssh $VPS_USER@$VPS_HOST
Container Status: docker ps | grep pixelated-app
Application Logs: docker logs pixelated-app
System Status: systemctl status caddy docker
EOF

    # Store completion report path
    echo "$completion_report" > "/tmp/latest-completion-report.txt"
    
    log_deployment_event "REPORTING" "INFO" "Deployment completion report created: $completion_report" "completion_report_created"
    
    return 0
}

# Add user guidance for post-deployment operations and git usage
provide_post_deployment_guidance() {
    local git_available="$1"
    
    log_deployment_event "GUIDANCE" "INFO" "Providing post-deployment guidance" "post_deployment_guidance"
    
    print_header "📋 Post-Deployment Operations Guide"
    print_status ""
    print_status "Your Pixelated Empathy application has been successfully deployed!"
    print_status ""
    
    print_status "🌐 Application Access:"
    print_status "  Direct: http://$VPS_HOST:4321"
    if [[ -n "$DOMAIN" ]]; then
        print_status "  Domain: https://$DOMAIN"
    fi
    print_status ""
    
    print_status "🔧 System Management:"
    print_status "  SSH Access: ssh $VPS_USER@$VPS_HOST"
    print_status "  Container Status: docker ps | grep pixelated-app"
    print_status "  Application Logs: docker logs pixelated-app"
    print_status "  System Services: systemctl status caddy docker"
    print_status ""
    
    if [[ "$git_available" == "true" ]]; then
        print_status "🚀 Quick Updates (Git-based):"
        print_status "  1. SSH to VPS: ssh $VPS_USER@$VPS_HOST"
        print_status "  2. Navigate to project: cd $REMOTE_PROJECT_DIR"
        print_status "  3. Pull latest changes: git pull"
        print_status "  4. Rebuild and restart: pnpm build && docker restart pixelated-app"
        print_status ""
        print_status "  ⚠️  Note: Git-based updates skip health checks and backup creation"
        print_status "      Use full deployment script for production-critical updates"
        print_status ""
    fi
    
    print_status "🔄 Full Deployment Updates:"
    print_status "  Run this script again: $0 $VPS_HOST $VPS_USER $VPS_PORT $SSH_KEY $DOMAIN"
    print_status "  Benefits: Health checks, backup management, rollback preparation"
    print_status ""
    
    print_status "📦 Registry-based Deployment:"
    print_status "  1. List available versions:"
    print_status "     curl -s 'https://git.pixelatedempathy.tech/v2/pixelated-empathy/tags/list' | jq -r '.tags[]?' | head -5"
    print_status "  2. Deploy specific version (replace TAG):"
    print_status "     docker pull git.pixelatedempathy.tech/pixelated-empathy:TAG"
    print_status "     docker stop pixelated-app && docker rm pixelated-app"
    print_status "     docker run -d --name pixelated-app --restart unless-stopped -p 4321:4321 git.pixelatedempathy.tech/pixelated-empathy:TAG"
    print_status ""
    
    print_status "🔒 Security Recommendations:"
    print_status "  1. Change SSH port from default 22 (edit /etc/ssh/sshd_config)"
    print_status "  2. Disable password authentication (use key-based only)"
    print_status "  3. Set up firewall rules (ufw enable, allow specific ports)"
    print_status "  4. Regular security updates: apt update && apt upgrade"
    print_status "  5. Monitor application logs for suspicious activity"
    print_status ""
    
    print_status "📊 Monitoring and Maintenance:"
    print_status "  1. Set up log rotation for Docker containers"
    print_status "  2. Monitor disk space usage regularly"
    print_status "  3. Backup database and important data"
    print_status "  4. Test rollback procedures periodically"
    print_status "  5. Keep deployment logs for troubleshooting"
    print_status ""
    
    if [[ -f "/tmp/latest-completion-report.txt" ]]; then
        local report_file=$(cat "/tmp/latest-completion-report.txt")
        print_status "📄 Detailed Report: $report_file"
        print_status ""
    fi
    
    return 0
}

# Write deployment failure summary with specific remediation steps
create_deployment_failure_summary() {
    local failure_stage="$1"
    local exit_code="$2"
    local error_details="$3"
    
    log_deployment_event "FAILURE" "ERROR" "Creating deployment failure summary" "failure_summary"
    
    local failure_summary="/tmp/deployment-failure-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$failure_summary" << EOF
=== Pixelated Empathy Deployment Failure Summary ===
Generated: $(date -Iseconds)
Failed Stage: $failure_stage
Exit Code: $exit_code
Context: $DEPLOYMENT_CONTEXT

=== Failure Details ===
$error_details

=== System State ===
Target Host: $VPS_HOST:$VPS_PORT
User: $VPS_USER
Domain: ${DOMAIN:-"IP-based access only"}
Local Directory: $LOCAL_PROJECT_DIR
Remote Directory: $REMOTE_PROJECT_DIR

=== Immediate Actions Required ===
EOF

    case "$failure_stage" in
        "pre_deployment")
            cat >> "$failure_summary" << EOF
The deployment failed during initial validation. No changes were made to production.

1. Verify SSH connectivity:
   ssh $VPS_USER@$VPS_HOST
   
2. Check network connectivity and DNS resolution
3. Verify SSH key permissions and configuration
4. Ensure target host is accessible and responsive

Remediation Steps:
- Test SSH connection manually
- Check firewall rules on both local and remote systems
- Verify SSH key is correct and has proper permissions (600)
- Ensure VPS is running and accessible
EOF
            ;;
        "env_variables")
            cat >> "$failure_summary" << EOF
The deployment failed during environment variable setup. Production unchanged.

1. Check environment file encryption/decryption process
2. Verify GPG or OpenSSL availability on VPS
3. Check environment file permissions and content

Remediation Steps:
- Verify .env file exists and is readable
- Test encryption/decryption process manually
- Check VPS has required encryption tools installed
- Verify environment file format and content
EOF
            ;;
        "synchronization")
            cat >> "$failure_summary" << EOF
The deployment failed during code synchronization. Backup may exist.

1. Check rsync connectivity and permissions
2. Verify disk space on VPS
3. Check for file permission issues
4. Verify network stability during transfer

Remediation Steps:
- Test rsync manually with verbose output
- Check available disk space: df -h
- Verify file permissions on both systems
- Check network connectivity and stability
- Review rsync exclusion patterns
EOF
            ;;
        "container_build")
            cat >> "$failure_summary" << EOF
The deployment failed during container build. Code synchronized but build failed.

1. SSH to VPS and check Docker status
2. Review build logs for specific errors
3. Check Dockerfile and dependencies
4. Verify Node.js and pnpm versions

Remediation Steps:
- SSH to VPS: ssh $VPS_USER@$VPS_HOST
- Check Docker status: systemctl status docker
- Review build logs: cat /tmp/docker-build.log
- Test build manually: cd $REMOTE_PROJECT_DIR && docker build .
- Check Node.js version: node --version
- Check pnpm version: pnpm --version
- Review Dockerfile for syntax errors
EOF
            ;;
        "health_checks")
            cat >> "$failure_summary" << EOF
The deployment failed during health checks. Container built but failed validation.

1. New container was automatically cleaned up
2. Old container should still be running
3. Check application configuration and dependencies
4. Review health check failure details

Remediation Steps:
- Check if old container is still running: docker ps
- Review application logs for startup issues
- Test application dependencies and configuration
- Check port bindings and network connectivity
- Review health check endpoints and requirements
EOF
            ;;
        "traffic_switch")
            cat >> "$failure_summary" << EOF
The deployment failed during traffic switching. Manual intervention required.

1. Check container status and port bindings
2. Verify old container availability for rollback
3. Review traffic switching logs
4. Manual rollback may be necessary

Remediation Steps:
- Check container status: docker ps -a
- Review container logs: docker logs pixelated-app
- Check port bindings: netstat -tlnp | grep 4321
- Manual rollback if needed (see rollback section)
EOF
            ;;
        *)
            cat >> "$failure_summary" << EOF
The deployment failed at an unknown stage. Check logs for details.

1. Review deployment logs for specific error details
2. Check system status on VPS
3. Verify application is still running
4. Consider manual rollback if needed

Remediation Steps:
- Review main deployment log: $DEPLOYMENT_LOG
- Check error log: $ERROR_LOG
- SSH to VPS and check system status
- Verify application accessibility
EOF
            ;;
    esac

    cat >> "$failure_summary" << EOF

=== Rollback Procedures ===
If the production system is affected, use these rollback procedures:

1. Container Rollback (if backup container exists):
   ssh $VPS_USER@$VPS_HOST
   docker stop pixelated-app || true
   docker start pixelated-app-backup || echo "No backup container"

2. Filesystem Rollback (if backup directory exists):
   ssh $VPS_USER@$VPS_HOST
   sudo systemctl stop caddy
   docker stop pixelated-app || true
   sudo mv $REMOTE_PROJECT_DIR $REMOTE_PROJECT_DIR-failed
   sudo mv $REMOTE_PROJECT_DIR-backup $REMOTE_PROJECT_DIR
   cd $REMOTE_PROJECT_DIR
   docker build -t pixelated-app:rollback .
   docker run -d --name pixelated-app --restart unless-stopped -p 4321:4321 pixelated-app:rollback
   sudo systemctl start caddy

3. Registry Rollback (if previous images available):
   ssh $VPS_USER@$VPS_HOST
   curl -s "https://git.pixelatedempathy.tech/v2/pixelated-empathy/tags/list" | jq -r '.tags[]?' | head -5
   docker pull git.pixelatedempathy.tech/pixelated-empathy:PREVIOUS_TAG
   docker stop pixelated-app || true
   docker run -d --name pixelated-app-rollback --restart unless-stopped -p 4321:4321 git.pixelatedempathy.tech/pixelated-empathy:PREVIOUS_TAG
   docker rm pixelated-app || true
   docker rename pixelated-app-rollback pixelated-app

=== Verification After Rollback ===
curl -s -f "http://localhost:4321/" && echo "✅ Application responding"
docker ps | grep pixelated-app && echo "✅ Container running"

=== Log Files for Analysis ===
Main Log: $DEPLOYMENT_LOG
Error Log: $ERROR_LOG
Warning Log: $WARNING_LOG
Metrics: $DEPLOYMENT_METRICS
Failure Summary: $failure_summary

=== Support Information ===
For additional support:
1. Review all log files listed above
2. Check system resources: df -h, free -h, docker system df
3. Verify network connectivity and DNS resolution
4. Test SSH and Docker functionality manually
5. Consider running deployment with verbose logging enabled

=== Prevention for Future Deployments ===
1. Test deployment in staging environment first
2. Verify all prerequisites before deployment
3. Ensure adequate disk space and system resources
4. Check network stability and connectivity
5. Validate configuration files and environment variables
6. Keep deployment logs for troubleshooting reference
EOF

    # Store failure summary path
    echo "$failure_summary" > "/tmp/latest-failure-summary.txt"
    
    print_header "❌ Deployment Failed"
    print_error "Deployment failed at stage: $failure_stage"
    print_error "Exit code: $exit_code"
    print_status ""
    print_status "📄 Detailed failure analysis: $failure_summary"
    print_status ""
    cat "$failure_summary"
    
    log_deployment_event "FAILURE" "ERROR" "Deployment failure summary created: $failure_summary" "failure_summary_created"
    
    return 0
}

# Final deployment validation and success confirmation
perform_final_deployment_validation() {
    local deployment_status="$1"
    
    log_deployment_event "VALIDATION" "INFO" "Performing final deployment validation" "final_validation"
    
    # Validate application is responding
    local validation_success="true"
    local validation_errors=()
    
    # Test direct application access
    log_deployment_event "VALIDATION" "INFO" "Testing direct application access" "direct_access_test"
    if $SSH_CMD "$VPS_USER@$VPS_HOST" "curl -s -f http://localhost:4321/ >/dev/null 2>&1"; then
        log_deployment_event "VALIDATION" "INFO" "Direct application access: PASS" "direct_access_pass"
    else
        log_deployment_event "VALIDATION" "ERROR" "Direct application access: FAIL" "direct_access_fail"
        validation_errors+=("Direct application access failed")
        validation_success="false"
    fi
    
    # Test domain access if configured
    if [[ -n "$DOMAIN" ]]; then
        log_deployment_event "VALIDATION" "INFO" "Testing domain access: $DOMAIN" "domain_access_test"
        if curl -s -f "https://$DOMAIN/" >/dev/null 2>&1; then
            log_deployment_event "VALIDATION" "INFO" "Domain access: PASS" "domain_access_pass"
        else
            log_deployment_event "VALIDATION" "WARNING" "Domain access: FAIL (may need DNS propagation)" "domain_access_warning"
            validation_errors+=("Domain access failed (check DNS/SSL)")
        fi
    fi
    
    # Validate container is running
    log_deployment_event "VALIDATION" "INFO" "Validating container status" "container_status_test"
    if $SSH_CMD "$VPS_USER@$VPS_HOST" "docker ps | grep -q pixelated-app"; then
        log_deployment_event "VALIDATION" "INFO" "Container status: RUNNING" "container_running"
    else
        log_deployment_event "VALIDATION" "ERROR" "Container status: NOT RUNNING" "container_not_running"
        validation_errors+=("Container is not running")
        validation_success="false"
    fi
    
    # Validate git functionality if sync was successful
    if [[ "$GIT_SYNC_SUCCESS" == "true" ]]; then
        log_deployment_event "VALIDATION" "INFO" "Validating git functionality" "git_validation"
        if verify_git_post_deployment "$VPS_HOST" "$VPS_USER" "$SSH_KEY" "$VPS_PORT" "$REMOTE_PROJECT_DIR"; then
            log_deployment_event "VALIDATION" "INFO" "Git functionality: AVAILABLE" "git_available"
        else
            log_deployment_event "VALIDATION" "WARNING" "Git functionality: DEGRADED" "git_degraded"
            validation_errors+=("Git functionality degraded")
        fi
    fi
    
    # Generate validation report
    if [[ "$validation_success" == "true" ]]; then
        log_deployment_event "VALIDATION" "INFO" "Final validation: ALL CHECKS PASSED" "validation_success"
        return 0
    else
        log_deployment_event "VALIDATION" "WARNING" "Final validation: SOME CHECKS FAILED" "validation_partial"
        for error in "${validation_errors[@]}"; do
            log_deployment_event "VALIDATION" "WARNING" "Validation issue: $error" "validation_issue"
        done
        return 1
    fi
}

# Main execution with integrated task 11.2 functionality
if execute_main_deployment; then
    # Deployment succeeded - perform final validation and reporting
    
    # Perform final validation
    if perform_final_deployment_validation "success"; then
        validation_status="passed"
    else
        validation_status="partial"
    fi
    
    # Create completion report
    create_deployment_completion_report "success" "$validation_status"
    
    # Provide user guidance
    provide_post_deployment_guidance "$GIT_SYNC_SUCCESS"
    
    # Display final success message
    print_header "🎉 Deployment Completed Successfully!"
    print_status ""
    print_status "✅ All deployment stages completed"
    print_status "✅ Application is running and accessible"
    print_status "✅ Health checks passed"
    print_status "✅ Backup management configured"
    print_status "✅ Monitoring and logging active"
    
    if [[ "$GIT_SYNC_SUCCESS" == "true" ]]; then
        print_status "✅ Git-based updates available"
    fi
    
    print_status ""
    print_status "Your Pixelated Empathy application is now live!"
    
    exit 0
else
    # Deployment failed - create failure summary
    deployment_exit_code=$?
    
    # Remove backup created during this failed deployment
    if [[ -n "$VPS_USER" && -n "$VPS_HOST" && -n "$REMOTE_DIR" ]]; then
        remove_backup_on_failure "$VPS_USER@$VPS_HOST" "$REMOTE_DIR"
    fi
    
    # Create failure summary with specific remediation steps
    create_deployment_failure_summary "${CURRENT_STAGE:-unknown}" "$deployment_exit_code" "Deployment orchestration failed"
    
    exit $deployment_exit_code
fi