#!/bin/bash

# Integration Test Runner for Deployment Pipeline
# Runs all integration tests for the deployment pipeline improvement

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="/tmp/deployment-integration-results"
OVERALL_LOG="$TEST_RESULTS_DIR/integration-tests-$(date +%Y%m%d-%H%M%S).log"

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
FAILED_SCENARIOS=()

print_header() { echo -e "${BLUE}[INTEGRATION-RUNNER]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_failure() { echo -e "${RED}[FAILURE]${NC} $1"; }
print_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Initialize test environment
setup_integration_test_runner() {
    print_header "Initializing deployment integration test runner"
    
    # Create results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Initialize overall log
    cat > "$OVERALL_LOG" << EOF
=== Deployment Pipeline Integration Tests ===
Started: $(date -Iseconds)
Test Runner: $0
Results Directory: $TEST_RESULTS_DIR

EOF
    
    print_info "Integration test results will be saved to: $TEST_RESULTS_DIR"
}

# Run individual integration test scenario
run_integration_test() {
    local scenario_name="$1"
    local test_script="$2"
    local scenario_log="$TEST_RESULTS_DIR/${scenario_name}-$(date +%Y%m%d-%H%M%S).log"
    
    print_header "Running $scenario_name integration tests"
    
    if [[ ! -f "$test_script" ]]; then
        print_failure "$scenario_name test script not found: $test_script"
        FAILED_SCENARIOS+=("$scenario_name")
        echo "FAILED: $scenario_name - Script not found" >> "$OVERALL_LOG"
        return 1
    fi
    
    # Make test script executable
    chmod +x "$test_script"
    
    # Run the test and capture output
    local start_time=$(date +%s)
    if "$test_script" > "$scenario_log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract test statistics from log
        local tests_run=$(grep "Tests run:" "$scenario_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_passed=$(grep "Tests passed:" "$scenario_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_failed=$(grep "Tests failed:" "$scenario_log" | tail -1 | awk '{print $3}' || echo "0")
        
        TOTAL_TESTS=$((TOTAL_TESTS + tests_run))
        TOTAL_PASSED=$((TOTAL_PASSED + tests_passed))
        TOTAL_FAILED=$((TOTAL_FAILED + tests_failed))
        
        print_success "$scenario_name integration tests passed (${tests_run} tests, ${duration}s)"
        echo "PASSED: $scenario_name - $tests_run tests in ${duration}s" >> "$OVERALL_LOG"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract test statistics even from failed runs
        local tests_run=$(grep "Tests run:" "$scenario_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_passed=$(grep "Tests passed:" "$scenario_log" | tail -1 | awk '{print $3}' || echo "0")
        local tests_failed=$(grep "Tests failed:" "$scenario_log" | tail -1 | awk '{print $3}' || echo "0")
        
        TOTAL_TESTS=$((TOTAL_TESTS + tests_run))
        TOTAL_PASSED=$((TOTAL_PASSED + tests_passed))
        TOTAL_FAILED=$((TOTAL_FAILED + tests_failed))
        
        FAILED_SCENARIOS+=("$scenario_name")
        print_failure "$scenario_name integration tests failed (${tests_failed} failures, ${duration}s)"
        echo "FAILED: $scenario_name - $tests_failed failures in ${duration}s" >> "$OVERALL_LOG"
        
        # Show last few lines of failure log
        print_info "Last 5 lines of $scenario_name test output:"
        tail -5 "$scenario_log" | sed 's/^/  /'
        
        return 1
    fi
}

# Run all integration test scenarios
run_all_integration_tests() {
    print_header "Running all deployment integration test scenarios"
    
    local test_scenarios=(
        "End-to-End Deployment:$SCRIPT_DIR/test_end_to_end_deployment.sh"
        "Failure Scenarios:$SCRIPT_DIR/test_failure_scenarios.sh"
        "Rollback Procedures:$SCRIPT_DIR/test_rollback_procedures.sh"
        "Performance Timing:$SCRIPT_DIR/test_performance_timing.sh"
        "Secure Environment Deployment:$SCRIPT_DIR/test_secure_environment_deployment.sh"
    )
    
    local scenario_count=${#test_scenarios[@]}
    local current_scenario=1
    
    for scenario_info in "${test_scenarios[@]}"; do
        local scenario_name="${scenario_info%%:*}"
        local test_script="${scenario_info##*:}"
        
        print_info "[$current_scenario/$scenario_count] Testing $scenario_name"
        
        if run_integration_test "$scenario_name" "$test_script"; then
            echo "✅ $scenario_name"
        else
            echo "❌ $scenario_name"
        fi
        
        echo ""  # Add spacing between scenarios
        ((current_scenario++))
    done
}

# Generate integration test summary report
generate_integration_test_summary() {
    print_header "Generating integration test summary report"
    
    local summary_file="$TEST_RESULTS_DIR/integration-summary-$(date +%Y%m%d-%H%M%S).txt"
    local end_time=$(date -Iseconds)
    
    cat > "$summary_file" << EOF
=== Deployment Pipeline Integration Test Summary ===
Generated: $end_time
Test Runner: $(basename "$0")

=== Overall Results ===
Total Tests: $TOTAL_TESTS
Tests Passed: $TOTAL_PASSED
Tests Failed: $TOTAL_FAILED
Success Rate: $(( TOTAL_TESTS > 0 ? (TOTAL_PASSED * 100) / TOTAL_TESTS : 0 ))%

=== Scenario Results ===
EOF
    
    # Add scenario results
    if [[ ${#FAILED_SCENARIOS[@]} -eq 0 ]]; then
        echo "✅ All integration test scenarios passed" >> "$summary_file"
    else
        echo "❌ Failed Scenarios:" >> "$summary_file"
        for scenario in "${FAILED_SCENARIOS[@]}"; do
            echo "  - $scenario" >> "$summary_file"
        done
    fi
    
    echo "" >> "$summary_file"
    echo "=== Test Categories Covered ===" >> "$summary_file"
    echo "✓ End-to-End Deployment Scenarios" >> "$summary_file"
    echo "✓ Failure Handling and Recovery" >> "$summary_file"
    echo "✓ Rollback Procedures and Validation" >> "$summary_file"
    echo "✓ Performance and Timing Requirements" >> "$summary_file"
    echo "✓ Secure Environment Variable Deployment" >> "$summary_file"
    
    echo "" >> "$summary_file"
    echo "=== Integration Test Logs ===" >> "$summary_file"
    echo "Overall Log: $OVERALL_LOG" >> "$summary_file"
    echo "Individual Logs: $TEST_RESULTS_DIR/" >> "$summary_file"
    echo "Summary Report: $summary_file" >> "$summary_file"
    
    # Display summary to console
    print_header "Integration Test Summary"
    cat "$summary_file"
    
    # Append summary to overall log
    echo "" >> "$OVERALL_LOG"
    echo "=== FINAL INTEGRATION SUMMARY ===" >> "$OVERALL_LOG"
    cat "$summary_file" >> "$OVERALL_LOG"
    
    print_info "Detailed integration summary saved to: $summary_file"
}

# Generate comprehensive test report
generate_comprehensive_report() {
    print_header "Generating comprehensive test report"
    
    local report_file="$TEST_RESULTS_DIR/comprehensive-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Deployment Pipeline Integration Test Report

**Generated:** $(date -Iseconds)  
**Test Runner:** $(basename "$0")  
**Results Directory:** $TEST_RESULTS_DIR

## Executive Summary

- **Total Tests Executed:** $TOTAL_TESTS
- **Tests Passed:** $TOTAL_PASSED
- **Tests Failed:** $TOTAL_FAILED
- **Overall Success Rate:** $(( TOTAL_TESTS > 0 ? (TOTAL_PASSED * 100) / TOTAL_TESTS : 0 ))%

## Test Scenarios

### 1. End-to-End Deployment
Tests complete deployment workflows from start to finish, including:
- Successful deployment scenarios
- Health check validation
- Traffic switching
- Container lifecycle management

### 2. Failure Scenarios
Tests various failure conditions and recovery mechanisms:
- Network connectivity failures
- Build failures
- Health check failures
- Registry push failures
- Cascading failure scenarios

### 3. Rollback Procedures
Tests rollback and recovery mechanisms:
- Immediate rollback after health check failure
- Filesystem rollback procedures
- Registry-based rollback
- Rollback validation and verification

### 4. Performance and Timing
Tests deployment performance requirements:
- Environment setup performance
- Code synchronization timing
- Container build performance
- Health check response times
- Complete deployment timing validation

### 5. Secure Environment Deployment
Tests secure handling of environment variables:
- End-to-end encryption and deployment
- Encryption method comparison
- Sensitive variable masking
- Secure cleanup procedures
- Environment rollback scenarios

## Results by Category

EOF
    
    # Add results for each scenario
    local scenarios=("End-to-End Deployment" "Failure Scenarios" "Rollback Procedures" "Performance Timing" "Secure Environment Deployment")
    
    for scenario in "${scenarios[@]}"; do
        if [[ " ${FAILED_SCENARIOS[*]} " =~ " ${scenario} " ]]; then
            echo "- **$scenario:** ❌ FAILED" >> "$report_file"
        else
            echo "- **$scenario:** ✅ PASSED" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Recommendations

### If All Tests Passed
- Integration tests validate the deployment pipeline meets all requirements
- The system is ready for production deployment
- Consider setting up continuous integration to run these tests regularly

### If Tests Failed
- Review failed test logs in the results directory
- Address specific failure scenarios before production deployment
- Re-run tests after fixes to ensure resolution

## Test Artifacts

- **Overall Log:** $OVERALL_LOG
- **Individual Test Logs:** Available in $TEST_RESULTS_DIR/
- **Summary Report:** Available in $TEST_RESULTS_DIR/

## Next Steps

1. Review any failed test scenarios
2. Implement fixes for identified issues
3. Re-run integration tests to validate fixes
4. Proceed with deployment pipeline implementation

---

*This report was automatically generated by the deployment pipeline integration test suite.*
EOF
    
    print_info "Comprehensive test report generated: $report_file"
}

# Cleanup integration test artifacts
cleanup_integration_artifacts() {
    print_header "Cleaning up integration test artifacts"
    
    # Remove any temporary test files that might be left behind
    find /tmp -name "deployment-integration-*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true
    find /tmp -name "test-*.log" -mmin +60 -delete 2>/dev/null || true
    
    print_info "Integration test artifacts cleaned up"
}

# Main execution
main() {
    print_header "Starting Deployment Pipeline Integration Tests"
    
    setup_integration_test_runner
    
    # Run all integration tests
    run_all_integration_tests
    
    # Generate reports
    generate_integration_test_summary
    generate_comprehensive_report
    
    # Cleanup
    cleanup_integration_artifacts
    
    # Exit with appropriate code
    if [[ ${#FAILED_SCENARIOS[@]} -eq 0 ]]; then
        print_success "All integration tests passed! 🎉"
        print_info "The deployment pipeline is ready for production use."
        exit 0
    else
        print_failure "${#FAILED_SCENARIOS[@]} scenario(s) failed integration tests"
        print_info "Review the test logs and address failures before production deployment."
        exit 1
    fi
}

# Help function
show_help() {
    cat << EOF
Deployment Pipeline Integration Test Runner

Usage: $0 [OPTIONS]

Options:
  -h, --help       Show this help message
  -v, --verbose    Enable verbose output
  --scenario       Run tests for specific scenario only
                   Options: e2e, failures, rollback, performance, secure-env

Examples:
  $0                         # Run all integration tests
  $0 --scenario e2e          # Run only end-to-end tests
  $0 --verbose               # Run with verbose output

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
        --scenario)
            SPECIFIC_SCENARIO="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run specific scenario if requested
if [[ -n "$SPECIFIC_SCENARIO" ]]; then
    setup_integration_test_runner
    
    case "$SPECIFIC_SCENARIO" in
        e2e)
            run_integration_test "End-to-End Deployment" "$SCRIPT_DIR/test_end_to_end_deployment.sh"
            ;;
        failures)
            run_integration_test "Failure Scenarios" "$SCRIPT_DIR/test_failure_scenarios.sh"
            ;;
        rollback)
            run_integration_test "Rollback Procedures" "$SCRIPT_DIR/test_rollback_procedures.sh"
            ;;
        performance)
            run_integration_test "Performance Timing" "$SCRIPT_DIR/test_performance_timing.sh"
            ;;
        secure-env)
            run_integration_test "Secure Environment Deployment" "$SCRIPT_DIR/test_secure_environment_deployment.sh"
            ;;
        *)
            print_failure "Unknown scenario: $SPECIFIC_SCENARIO"
            show_help
            exit 1
            ;;
    esac
    
    generate_integration_test_summary
    exit $?
fi

# Run main function
main "$@"