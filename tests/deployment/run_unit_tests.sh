#!/bin/bash

# Unit Test Runner for Deployment Pipeline Components
# Runs all unit tests for the deployment pipeline improvement

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="/tmp/deployment-test-results"
OVERALL_LOG="$TEST_RESULTS_DIR/unit-tests-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test result tracking
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_COMPONENTS=()

print_header() { echo -e "${BLUE}[RUNNER]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_failure() { echo -e "${RED}[FAILURE]${NC} $1"; }
print_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Initialize test environment
setup_test_runner() {
    print_header "Initializing deployment unit test runner"
    
    # Create results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Initialize overall log
    cat > "$OVERALL_LOG" << EOF
=== Deployment Pipeline Unit Tests ===
Started: $(date -Iseconds)
Test Runner: $0
Results Directory: $TEST_RESULTS_DIR

EOF
    
    print_info "Test results will be saved to: $TEST_RESULTS_DIR"
}

# Run individual test component
run_component_test() {
    local component_name="$1"
    local test_script="$2"
    local component_log="$TEST_RESULTS_DIR/${component_name}-$(date +%Y%m%d-%H%M%S).log"
    
    print_header "Running $component_name tests"
    
    if [[ ! -f "$test_script" ]]; then
        print_failure "$component_name test script not found: $test_script"
        FAILED_COMPONENTS+=("$component_name")
        echo "FAILED: $component_name - Script not found" >> "$OVERALL_LOG"
        return 1
    fi
    
    # Make test script executable
    chmod +x "$test_script"
    
    # Run the test and capture output
    local start_time=$(date +%s)
    if "$test_script" > "$component_log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract test statistics from log
        local tests_run=$(grep "Tests run:" "$component_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_passed=$(grep "Tests passed:" "$component_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_failed=$(grep "Tests failed:" "$component_log" | tail -1 | awk '{print $3}' || echo "0")
        
        TOTAL_TESTS=$((TOTAL_TESTS + tests_run))
        TOTAL_PASSED=$((TOTAL_PASSED + tests_passed))
        TOTAL_FAILED=$((TOTAL_FAILED + tests_failed))
        
        print_success "$component_name tests passed (${tests_run} tests, ${duration}s)"
        echo "PASSED: $component_name - $tests_run tests in ${duration}s" >> "$OVERALL_LOG"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract test statistics even from failed runs
        local tests_run=$(grep "Tests run:" "$component_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_passed=$(grep "Tests passed:" "$component_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_failed=$(grep "Tests failed:" "$component_log" | tail -1 | awk '{print $3}' || echo "0")
        
        TOTAL_TESTS=$((TOTAL_TESTS + tests_run))
        TOTAL_PASSED=$((TOTAL_PASSED + tests_passed))
        TOTAL_FAILED=$((TOTAL_FAILED + tests_failed))
        
        FAILED_COMPONENTS+=("$component_name")
        print_failure "$component_name tests failed (${tests_failed} failures, ${duration}s)"
        echo "FAILED: $component_name - $tests_failed failures in ${duration}s" >> "$OVERALL_LOG"
        
        # Show last few lines of failure log
        print_info "Last 5 lines of $component_name test output:"
        tail -5 "$component_log" | sed 's/^/  /'
        
        return 1
    fi
}

# Run all component tests
run_all_tests() {
    print_header "Running all deployment component unit tests"
    
    local test_components=(
        "Environment Manager:$SCRIPT_DIR/test_environment_manager.sh"
        "Backup Manager:$SCRIPT_DIR/test_backup_manager.sh"
        "Container Manager:$SCRIPT_DIR/test_container_manager.sh"
        "Registry Manager:$SCRIPT_DIR/test_registry_manager.sh"
        "Secure Environment Manager:$SCRIPT_DIR/test_secure_environment_manager.sh"
    )
    
    local component_count=${#test_components[@]}
    local current_component=1
    
    for component_info in "${test_components[@]}"; do
        local component_name="${component_info%%:*}"
        local test_script="${component_info##*:}"
        
        print_info "[$current_component/$component_count] Testing $component_name"
        
        if run_component_test "$component_name" "$test_script"; then
            echo "✅ $component_name"
        else
            echo "❌ $component_name"
        fi
        
        echo ""  # Add spacing between components
        ((current_component++))
    done
}

# Generate test summary report
generate_test_summary() {
    print_header "Generating test summary report"
    
    local summary_file="$TEST_RESULTS_DIR/test-summary-$(date +%Y%m%d-%H%M%S).txt"
    local end_time=$(date -Iseconds)
    
    cat > "$summary_file" << EOF
=== Deployment Pipeline Unit Test Summary ===
Generated: $end_time
Test Runner: $(basename "$0")

=== Overall Results ===
Total Tests: $TOTAL_TESTS
Tests Passed: $TOTAL_PASSED
Tests Failed: $TOTAL_FAILED
Success Rate: $(( TOTAL_TESTS > 0 ? (TOTAL_PASSED * 100) / TOTAL_TESTS : 0 ))%

=== Component Results ===
EOF
    
    # Add component results
    if [[ ${#FAILED_COMPONENTS[@]} -eq 0 ]]; then
        echo "✅ All components passed their tests" >> "$summary_file"
    else
        echo "❌ Failed Components:" >> "$summary_file"
        for component in "${FAILED_COMPONENTS[@]}"; do
            echo "  - $component" >> "$summary_file"
        done
    fi
    
    echo "" >> "$summary_file"
    echo "=== Test Logs ===" >> "$summary_file"
    echo "Overall Log: $OVERALL_LOG" >> "$summary_file"
    echo "Individual Logs: $TEST_RESULTS_DIR/" >> "$summary_file"
    echo "Summary Report: $summary_file" >> "$summary_file"
    
    # Display summary to console
    print_header "Test Summary"
    cat "$summary_file"
    
    # Append summary to overall log
    echo "" >> "$OVERALL_LOG"
    echo "=== FINAL SUMMARY ===" >> "$OVERALL_LOG"
    cat "$summary_file" >> "$OVERALL_LOG"
    
    print_info "Detailed summary saved to: $summary_file"
}

# Cleanup test artifacts
cleanup_test_artifacts() {
    print_header "Cleaning up test artifacts"
    
    # Remove any temporary test files that might be left behind
    find /tmp -name "deployment-test-*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true
    find /tmp -name "test-*.log" -mmin +60 -delete 2>/dev/null || true
    
    print_info "Test artifacts cleaned up"
}

# Main execution
main() {
    print_header "Starting Deployment Pipeline Unit Tests"
    
    setup_test_runner
    
    # Run all tests
    run_all_tests
    
    # Generate summary
    generate_test_summary
    
    # Cleanup
    cleanup_test_artifacts
    
    # Exit with appropriate code
    if [[ ${#FAILED_COMPONENTS[@]} -eq 0 ]]; then
        print_success "All unit tests passed! 🎉"
        exit 0
    else
        print_failure "${#FAILED_COMPONENTS[@]} component(s) failed tests"
        exit 1
    fi
}

# Help function
show_help() {
    cat << EOF
Deployment Pipeline Unit Test Runner

Usage: $0 [OPTIONS]

Options:
  -h, --help     Show this help message
  -v, --verbose  Enable verbose output
  --component    Run tests for specific component only
                 Options: environment, backup, container, registry, secure-env

Examples:
  $0                           # Run all tests
  $0 --component environment   # Run only environment manager tests
  $0 --verbose                 # Run with verbose output

Test results are saved to: $TEST_RESULTS_DIR
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        --component)
            SPECIFIC_COMPONENT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run specific component if requested
if [[ -n "$SPECIFIC_COMPONENT" ]]; then
    setup_test_runner
    
    case "$SPECIFIC_COMPONENT" in
        environment)
            run_component_test "Environment Manager" "$SCRIPT_DIR/test_environment_manager.sh"
            ;;
        backup)
            run_component_test "Backup Manager" "$SCRIPT_DIR/test_backup_manager.sh"
            ;;
        container)
            run_component_test "Container Manager" "$SCRIPT_DIR/test_container_manager.sh"
            ;;
        registry)
            run_component_test "Registry Manager" "$SCRIPT_DIR/test_registry_manager.sh"
            ;;
        secure-env)
            run_component_test "Secure Environment Manager" "$SCRIPT_DIR/test_secure_environment_manager.sh"
            ;;
        *)
            print_failure "Unknown component: $SPECIFIC_COMPONENT"
            show_help
            exit 1
            ;;
    esac
    
    generate_test_summary
    exit $?
fi

# Run main function
main "$@"