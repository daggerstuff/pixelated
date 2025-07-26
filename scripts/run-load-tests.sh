#!/bin/bash

# Bias Detection Engine - Load Testing Automation Script
# This script automates the execution of load tests and generates comprehensive reports

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOAD_TESTS_DIR="$PROJECT_ROOT/src/load-tests"
REPORTS_DIR="$PROJECT_ROOT/reports/load-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_BASE_URL="http://localhost:3000"
DEFAULT_AUTH_TOKEN="test-token-123"
DEFAULT_SCENARIOS="smoke_test,load_test"
DEFAULT_OUTPUT_FORMAT="json,html"
DEFAULT_DURATION_OVERRIDE=""

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Load Testing Automation for Bias Detection Engine

OPTIONS:
    -u, --base-url URL          Base URL for the application (default: $DEFAULT_BASE_URL)
    -t, --auth-token TOKEN      Authentication token (default: $DEFAULT_AUTH_TOKEN)
    -s, --scenarios LIST        Comma-separated list of scenarios to run (default: $DEFAULT_SCENARIOS)
                               Available: smoke_test, load_test, stress_test, spike_test, volume_test, endurance_test
    -f, --format LIST          Output formats: json,html,prometheus (default: $DEFAULT_OUTPUT_FORMAT)
    -d, --duration DURATION    Override duration for all scenarios (e.g., 30s, 5m, 1h)
    -o, --output-dir DIR       Output directory for reports (default: $REPORTS_DIR)
    -v, --verbose              Enable verbose output
    -h, --help                 Show this help message

EXAMPLES:
    # Run basic smoke and load tests
    $0

    # Run stress test against staging environment
    $0 -u https://staging.example.com -s stress_test -t real-auth-token

    # Run all scenarios with custom duration
    $0 -s smoke_test,load_test,stress_test -d 2m

    # Generate only HTML reports
    $0 -f html -o ./my-reports

EOF
}

# Logging functions
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${timestamp} ${BLUE}[INFO]${NC} $message"
            ;;
        WARN)
            echo -e "${timestamp} ${YELLOW}[WARN]${NC} $message"
            ;;
        ERROR)
            echo -e "${timestamp} ${RED}[ERROR]${NC} $message"
            ;;
        SUCCESS)
            echo -e "${timestamp} ${GREEN}[SUCCESS]${NC} $message"
            ;;
    esac
}

# Check dependencies
check_dependencies() {
    log INFO "Checking dependencies..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log ERROR "k6 is not installed. Please install k6 from https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    # Check if jq is installed (for JSON processing)
    if ! command -v jq &> /dev/null; then
        log WARN "jq is not installed. Some report processing features may be limited."
    fi
    
    # Check if curl is available (for health checks)
    if ! command -v curl &> /dev/null; then
        log ERROR "curl is required for health checks"
        exit 1
    fi
    
    log SUCCESS "All dependencies are available"
}

# Health check function
health_check() {
    local base_url=$1
    local auth_token=$2
    
    log INFO "Performing health check on $base_url"
    
    local health_url="$base_url/api/bias-detection/health"
    local response
    
    if response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
                      -H "Authorization: Bearer $auth_token" \
                      -H "Content-Type: application/json" \
                      "$health_url" 2>/dev/null); then
        
        local body=$(echo "$response" | sed -E 's/HTTP_STATUS:[0-9]{3}$//')
        local status=$(echo "$response" | grep -o '[0-9]*$')
        
        if [ "$status" -eq 200 ]; then
            log SUCCESS "Health check passed - service is available"
            return 0
        else
            log ERROR "Health check failed - HTTP status: $status"
            return 1
        fi
    else
        log ERROR "Health check failed - unable to connect to $health_url"
        return 1
    fi
}

# Prepare test environment
prepare_environment() {
    local reports_dir=$1
    
    log INFO "Preparing test environment..."
    
    # Create reports directory
    mkdir -p "$reports_dir"
    
    # Create subdirectories for different report types
    mkdir -p "$reports_dir/json"
    mkdir -p "$reports_dir/html"
    mkdir -p "$reports_dir/prometheus"
    
    # Create a test summary file
    cat > "$reports_dir/test-summary.json" << EOF
{
  "testRun": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "baseUrl": "$BASE_URL",
    "scenarios": "$SCENARIOS",
    "outputFormats": "$OUTPUT_FORMATS",
    "status": "running"
  },
  "results": {}
}
EOF
    
    log SUCCESS "Test environment prepared in $reports_dir"
}

# Run a specific test scenario
run_scenario() {
    local scenario=$1
    local base_url=$2
    local auth_token=$3
    local reports_dir=$4
    local output_formats=$5
    local duration_override=$6
    
    log INFO "Running scenario: $scenario"
    
    local scenario_report_dir="$reports_dir/$scenario"
    mkdir -p "$scenario_report_dir"
    
    # Prepare k6 command
    local k6_cmd="k6 run"
    
    # Add output formats
    IFS=',' read -ra FORMATS <<< "$output_formats"
    for format in "${FORMATS[@]}"; do
        case $format in
            json)
                k6_cmd="$k6_cmd --out json=$scenario_report_dir/results.json"
                ;;
            html)
                k6_cmd="$k6_cmd --out web-dashboard=$scenario_report_dir/report.html"
                ;;
            prometheus)
                k6_cmd="$k6_cmd --out experimental-prometheus-rw"
                ;;
        esac
    done
    
    # Add scenario selection
    k6_cmd="$k6_cmd --scenario $scenario"
    
    # Add duration override if specified
    if [ -n "$duration_override" ]; then
        k6_cmd="$k6_cmd --duration $duration_override"
    fi
    
    # Set environment variables
    export BASE_URL="$base_url"
    export AUTH_TOKEN="$auth_token"
    
    # Add the test script
    k6_cmd="$k6_cmd $LOAD_TESTS_DIR/bias-detection-benchmark.js"
    
    log INFO "Executing: $k6_cmd"
    
    # Run the test
    local start_time=$(date +%s)
    if eval "$k6_cmd"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log SUCCESS "Scenario $scenario completed successfully in ${duration}s"
        
        # Update test summary
        if command -v jq &> /dev/null; then
            local summary_file="$reports_dir/test-summary.json"
            jq --arg scenario "$scenario" \
               --arg status "completed" \
               --arg duration "${duration}" \
               '.results[$scenario] = {status: $status, duration: $duration}' \
               "$summary_file" > "${summary_file}.tmp" && \
            mv "${summary_file}.tmp" "$summary_file"
        fi
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log ERROR "Scenario $scenario failed after ${duration}s"
        
        # Update test summary with failure
        if command -v jq &> /dev/null; then
            local summary_file="$reports_dir/test-summary.json"
            jq --arg scenario "$scenario" \
               --arg status "failed" \
               --arg duration "${duration}" \
               '.results[$scenario] = {status: $status, duration: $duration}' \
               "$summary_file" > "${summary_file}.tmp" && \
            mv "${summary_file}.tmp" "$summary_file"
        fi
        
        return 1
    fi
}

# Generate comprehensive report
generate_report() {
    local reports_dir=$1
    
    log INFO "Generating comprehensive test report..."
    
    local report_file="$reports_dir/load-test-report-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# Bias Detection Engine - Load Test Report

**Generated:** $(date)
**Test Run ID:** $TIMESTAMP

## Test Configuration

- **Base URL:** $BASE_URL
- **Scenarios:** $SCENARIOS
- **Output Formats:** $OUTPUT_FORMATS
- **Duration Override:** ${DURATION_OVERRIDE:-"None"}

## Test Results Summary

EOF
    
    # Add scenario results if jq is available
    if command -v jq &> /dev/null && [ -f "$reports_dir/test-summary.json" ]; then
        echo "### Scenario Results" >> "$report_file"
        echo "" >> "$report_file"
        
        jq -r '.results | to_entries[] | "- **\(.key):** \(.value.status) (Duration: \(.value.duration)s)"' \
           "$reports_dir/test-summary.json" >> "$report_file"
        
        echo "" >> "$report_file"
    fi
    
    # Add file listings
    echo "## Generated Files" >> "$report_file"
    echo "" >> "$report_file"
    
    find "$reports_dir" -type f -name "*.json" -o -name "*.html" | while read -r file; do
        local relative_path=${file#$reports_dir/}
        echo "- \`$relative_path\`" >> "$report_file"
    done
    
    echo "" >> "$report_file"
    echo "## Next Steps" >> "$report_file"
    echo "" >> "$report_file"
    echo "1. Review the JSON results for detailed metrics" >> "$report_file"
    echo "2. Open HTML reports in a web browser for visual analysis" >> "$report_file"
    echo "3. Compare results against performance baselines" >> "$report_file"
    echo "4. Address any performance issues identified" >> "$report_file"
    
    log SUCCESS "Comprehensive report generated: $report_file"
}

# Cleanup function
cleanup() {
    log INFO "Cleaning up temporary files..."
    # Add any cleanup logic here
    log SUCCESS "Cleanup completed"
}

# Main execution function
main() {
    # Parse command line arguments
    local base_url="$DEFAULT_BASE_URL"
    local auth_token="$DEFAULT_AUTH_TOKEN"
    local scenarios="$DEFAULT_SCENARIOS"
    local output_formats="$DEFAULT_OUTPUT_FORMAT"
    local reports_dir="$REPORTS_DIR"
    local duration_override="$DEFAULT_DURATION_OVERRIDE"
    local verbose=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--base-url)
                base_url="$2"
                shift 2
                ;;
            -t|--auth-token)
                auth_token="$2"
                shift 2
                ;;
            -s|--scenarios)
                scenarios="$2"
                shift 2
                ;;
            -f|--format)
                output_formats="$2"
                shift 2
                ;;
            -d|--duration)
                duration_override="$2"
                shift 2
                ;;
            -o|--output-dir)
                reports_dir="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log ERROR "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Export variables for global access
    export BASE_URL="$base_url"
    export AUTH_TOKEN="$auth_token"
    export SCENARIOS="$scenarios"
    export OUTPUT_FORMATS="$output_formats"
    export DURATION_OVERRIDE="$duration_override"
    
    # Enable verbose mode if requested
    if [ "$verbose" = true ]; then
        set -x
    fi
    
    log INFO "Starting load test execution"
    log INFO "Configuration: URL=$base_url, Scenarios=$scenarios, Formats=$output_formats"
    
    # Create timestamped reports directory
    reports_dir="$reports_dir/$TIMESTAMP"
    
    # Check dependencies
    check_dependencies
    
    # Perform health check
    if ! health_check "$base_url" "$auth_token"; then
        log ERROR "Health check failed. Aborting load tests."
        exit 1
    fi
    
    # Prepare test environment
    prepare_environment "$reports_dir"
    
    # Run scenarios
    local failed_scenarios=()
    IFS=',' read -ra SCENARIO_LIST <<< "$scenarios"
    
    for scenario in "${SCENARIO_LIST[@]}"; do
        if ! run_scenario "$scenario" "$base_url" "$auth_token" "$reports_dir" "$output_formats" "$duration_override"; then
            failed_scenarios+=("$scenario")
        fi
    done
    
    # Generate report
    generate_report "$reports_dir"
    
    # Report results
    if [ ${#failed_scenarios[@]} -eq 0 ]; then
        log SUCCESS "All load test scenarios completed successfully!"
        log INFO "Reports available in: $reports_dir"
        exit 0
    else
        log ERROR "The following scenarios failed: ${failed_scenarios[*]}"
        log INFO "Partial reports available in: $reports_dir"
        exit 1
    fi
}

# Set up signal handlers for cleanup
trap cleanup EXIT

# Execute main function with all arguments
main "$@" 