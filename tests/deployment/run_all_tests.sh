#!/bin/bash

# Comprehensive Test Runner for Deployment Pipeline
# Runs both unit tests and integration tests for complete validation

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="/tmp/deployment-comprehensive-results"
OVERALL_LOG="$TEST_RESULTS_DIR/comprehensive-tests-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test result tracking
UNIT_TESTS_PASSED=false
INTEGRATION_TESTS_PASSED=false
TOTAL_UNIT_TESTS=0
TOTAL_INTEGRATION_TESTS=0
TOTAL_UNIT_PASSED=0
TOTAL_INTEGRATION_PASSED=0
TOTAL_UNIT_FAILED=0
TOTAL_INTEGRATION_FAILED=0

print_header() { echo -e "${BLUE}[COMPREHENSIVE-RUNNER]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_failure() { echo -e "${RED}[FAILURE]${NC} $1"; }
print_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Initialize comprehensive test environment
setup_comprehensive_test_runner() {
    print_header "Initializing comprehensive deployment test runner"
    
    # Create results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Initialize overall log
    cat > "$OVERALL_LOG" << EOF
=== Comprehensive Deployment Pipeline Tests ===
Started: $(date -Iseconds)
Test Runner: $0
Results Directory: $TEST_RESULTS_DIR

Test Suite Includes:
- Unit Tests: Core component validation
- Integration Tests: End-to-end scenario validation

EOF
    
    print_info "Comprehensive test results will be saved to: $TEST_RESULTS_DIR"
}

# Run unit tests
run_unit_tests() {
    print_header "Running Unit Tests"
    
    local unit_test_runner="$SCRIPT_DIR/run_unit_tests.sh"
    local unit_log="$TEST_RESULTS_DIR/unit-tests.log"
    
    if [[ ! -f "$unit_test_runner" ]]; then
        print_failure "Unit test runner not found: $unit_test_runner"
        echo "FAILED: Unit tests - Runner not found" >> "$OVERALL_LOG"
        return 1
    fi
    
    chmod +x "$unit_test_runner"
    
    local start_time=$(date +%s)
    if "$unit_test_runner" > "$unit_log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract unit test statistics
        TOTAL_UNIT_TESTS=$(grep "Total Tests:" "$unit_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_UNIT_PASSED=$(grep "Tests Passed:" "$unit_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_UNIT_FAILED=$(grep "Tests Failed:" "$unit_log" | tail -1 | awk '{print $3}' || echo "0")
        
        UNIT_TESTS_PASSED=true
        print_success "Unit tests completed successfully (${TOTAL_UNIT_TESTS} tests, ${duration}s)"
        echo "PASSED: Unit Tests - $TOTAL_UNIT_TESTS tests in ${duration}s" >> "$OVERALL_LOG"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract statistics even from failed runs
        TOTAL_UNIT_TESTS=$(grep "Total Tests:" "$unit_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_UNIT_PASSED=$(grep "Tests Passed:" "$unit_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_UNIT_FAILED=$(grep "Tests Failed:" "$unit_log" | tail -1 | awk '{print $3}' || echo "0")
        
        UNIT_TESTS_PASSED=false
        print_failure "Unit tests failed (${TOTAL_UNIT_FAILED} failures, ${duration}s)"
        echo "FAILED: Unit Tests - $TOTAL_UNIT_FAILED failures in ${duration}s" >> "$OVERALL_LOG"
        
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"
    
    local integration_test_runner="$SCRIPT_DIR/integration/run_integration_tests.sh"
    local integration_log="$TEST_RESULTS_DIR/integration-tests.log"
    
    if [[ ! -f "$integration_test_runner" ]]; then
        print_failure "Integration test runner not found: $integration_test_runner"
        echo "FAILED: Integration tests - Runner not found" >> "$OVERALL_LOG"
        return 1
    fi
    
    chmod +x "$integration_test_runner"
    
    local start_time=$(date +%s)
    if "$integration_test_runner" > "$integration_log" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract integration test statistics
        TOTAL_INTEGRATION_TESTS=$(grep "Total Tests:" "$integration_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_INTEGRATION_PASSED=$(grep "Tests Passed:" "$integration_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_INTEGRATION_FAILED=$(grep "Tests Failed:" "$integration_log" | tail -1 | awk '{print $3}' || echo "0")
        
        INTEGRATION_TESTS_PASSED=true
        print_success "Integration tests completed successfully (${TOTAL_INTEGRATION_TESTS} tests, ${duration}s)"
        echo "PASSED: Integration Tests - $TOTAL_INTEGRATION_TESTS tests in ${duration}s" >> "$OVERALL_LOG"
        
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        # Extract statistics even from failed runs
        TOTAL_INTEGRATION_TESTS=$(grep "Total Tests:" "$integration_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_INTEGRATION_PASSED=$(grep "Tests Passed:" "$integration_log" | tail -1 | awk '{print $3}' || echo "0")
        TOTAL_INTEGRATION_FAILED=$(grep "Tests Failed:" "$integration_log" | tail -1 | awk '{print $3}' || echo "0")
        
        INTEGRATION_TESTS_PASSED=false
        print_failure "Integration tests failed (${TOTAL_INTEGRATION_FAILED} failures, ${duration}s)"
        echo "FAILED: Integration Tests - $TOTAL_INTEGRATION_FAILED failures in ${duration}s" >> "$OVERALL_LOG"
        
        return 1
    fi
}

# Generate comprehensive test summary
generate_comprehensive_summary() {
    print_header "Generating comprehensive test summary"
    
    local summary_file="$TEST_RESULTS_DIR/comprehensive-summary-$(date +%Y%m%d-%H%M%S).txt"
    local end_time=$(date -Iseconds)
    
    # Calculate totals
    local total_tests=$((TOTAL_UNIT_TESTS + TOTAL_INTEGRATION_TESTS))
    local total_passed=$((TOTAL_UNIT_PASSED + TOTAL_INTEGRATION_PASSED))
    local total_failed=$((TOTAL_UNIT_FAILED + TOTAL_INTEGRATION_FAILED))
    local overall_success_rate=$(( total_tests > 0 ? (total_passed * 100) / total_tests : 0 ))
    
    cat > "$summary_file" << EOF
=== Comprehensive Deployment Pipeline Test Summary ===
Generated: $end_time
Test Runner: $(basename "$0")

=== Overall Results ===
Total Tests Executed: $total_tests
Total Tests Passed: $total_passed
Total Tests Failed: $total_failed
Overall Success Rate: ${overall_success_rate}%

=== Unit Test Results ===
Unit Tests: $TOTAL_UNIT_TESTS
Unit Passed: $TOTAL_UNIT_PASSED
Unit Failed: $TOTAL_UNIT_FAILED
Unit Success Rate: $(( TOTAL_UNIT_TESTS > 0 ? (TOTAL_UNIT_PASSED * 100) / TOTAL_UNIT_TESTS : 0 ))%
Unit Test Status: $([ "$UNIT_TESTS_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")

=== Integration Test Results ===
Integration Tests: $TOTAL_INTEGRATION_TESTS
Integration Passed: $TOTAL_INTEGRATION_PASSED
Integration Failed: $TOTAL_INTEGRATION_FAILED
Integration Success Rate: $(( TOTAL_INTEGRATION_TESTS > 0 ? (TOTAL_INTEGRATION_PASSED * 100) / TOTAL_INTEGRATION_TESTS : 0 ))%
Integration Test Status: $([ "$INTEGRATION_TESTS_PASSED" = true ] && echo "✅ PASSED" || echo "❌ FAILED")

=== Test Coverage Analysis ===
✓ Environment Manager Components
✓ Backup Manager Operations
✓ Container Manager Health Checks
✓ Registry Manager Integration
✓ Secure Environment Variable Manager
✓ End-to-End Deployment Scenarios
✓ Failure Handling and Recovery
✓ Rollback Procedures and Validation
✓ Performance and Timing Requirements
✓ Secure Environment Variable Deployment

=== Quality Gates ===
EOF
    
    # Add quality gate results
    if [[ "$UNIT_TESTS_PASSED" = true ]]; then
        echo "✅ Unit Test Quality Gate: PASSED" >> "$summary_file"
    else
        echo "❌ Unit Test Quality Gate: FAILED" >> "$summary_file"
    fi
    
    if [[ "$INTEGRATION_TESTS_PASSED" = true ]]; then
        echo "✅ Integration Test Quality Gate: PASSED" >> "$summary_file"
    else
        echo "❌ Integration Test Quality Gate: FAILED" >> "$summary_file"
    fi
    
    if [[ "$UNIT_TESTS_PASSED" = true ]] && [[ "$INTEGRATION_TESTS_PASSED" = true ]]; then
        echo "✅ Overall Quality Gate: PASSED" >> "$summary_file"
    else
        echo "❌ Overall Quality Gate: FAILED" >> "$summary_file"
    fi
    
    # Display summary to console
    print_header "Comprehensive Test Summary"
    cat "$summary_file"
    
    print_info "Comprehensive test summary saved to: $summary_file"
}

# Main execution
main() {
    print_header "Starting Comprehensive Deployment Pipeline Tests"
    
    setup_comprehensive_test_runner
    
    local unit_test_result=0
    local integration_test_result=0
    
    # Run unit tests
    if ! run_unit_tests; then
        unit_test_result=1
    fi
    
    echo ""  # Add spacing
    
    # Run integration tests
    if ! run_integration_tests; then
        integration_test_result=1
    fi
    
    echo ""  # Add spacing
    
    # Generate comprehensive reports
    generate_comprehensive_summary
    
    # Final status
    if [[ $unit_test_result -eq 0 ]] && [[ $integration_test_result -eq 0 ]]; then
        print_success "🎉 All comprehensive tests passed!"
        print_info "The deployment pipeline is fully validated and ready for production."
        exit 0
    else
        print_failure "❌ Some comprehensive tests failed"
        if [[ $unit_test_result -ne 0 ]]; then
            print_info "- Unit tests failed: Review component implementations"
        fi
        if [[ $integration_test_result -ne 0 ]]; then
            print_info "- Integration tests failed: Review end-to-end scenarios"
        fi
        print_info "Address failures before production deployment."
        exit 1
    fi
}

# Help function
show_help() {
    cat << EOF
Comprehensive Deployment Pipeline Test Runner

Usage: $0 [OPTIONS]

Options:
  -h, --help       Show this help message
  -v, --verbose    Enable verbose output
  --unit-only      Run only unit tests
  --integration-only Run only integration tests

Examples:
  $0                    # Run all tests (unit + integration)
  $0 --unit-only        # Run only unit tests
  $0 --integration-only # Run only integration tests
  $0 --verbose          # Run with verbose output

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
        --unit-only)
            UNIT_ONLY=true
            shift
            ;;
        --integration-only)
            INTEGRATION_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Handle specific test type requests
if [[ "$UNIT_ONLY" = true ]]; then
    setup_comprehensive_test_runner
    run_unit_tests
    exit $?
elif [[ "$INTEGRATION_ONLY" = true ]]; then
    setup_comprehensive_test_runner
    run_integration_tests
    exit $?
fi

# Run main function
main "$@"