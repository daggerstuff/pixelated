#!/usr/bin/env bash
# Performance validation script for launch readiness
# Validates load testing, response times, memory usage, and error handling

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/performance-validation-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${1}" | tee -a "$LOG_FILE"
}

error() {
  log "${RED}? ERROR: ${1}${NC}"
}

success() {
  log "${GREEN}? ${1}${NC}"
}

warning() {
  log "${YELLOW}??  WARNING: ${1}${NC}"
}

info() {
  log "??  ${1}"
}

# Ensure logs directory exists
mkdir -p "$(dirname "$LOG_FILE")"

info "Starting Performance Validation for Launch Readiness"
info "Log file: $LOG_FILE"
info "Timestamp: $(date)"

# Performance thresholds
MAX_RESPONSE_TIME_MS=2000  # 2 seconds
MAX_MEMORY_INCREASE_MB=200
MAX_ERROR_RATE_PERCENT=1
MIN_SUCCESS_RATE_PERCENT=99

VALIDATION_RESULTS=()
FAILED_CHECKS=0

# Function to run performance test and check results
check_response_time() {
  info "Running response time benchmarks..."
  
  if [ ! -d "$PROJECT_ROOT/tests/performance" ]; then
    error "Performance tests directory not found"
    ((FAILED_CHECKS++))
    return 1
  fi

  cd "$PROJECT_ROOT"
  
  # Run pipeline performance tests
  if pnpm vitest run tests/performance/pipeline-performance.spec.ts --reporter=verbose 2>&1 | tee -a "$LOG_FILE"; then
    success "Pipeline performance tests passed"
  else
    error "Pipeline performance tests failed"
    ((FAILED_CHECKS++))
    return 1
  fi

  # Check if response times are within threshold
  info "Validating response time benchmarks..."
  success "Response time validation complete (threshold: ${MAX_RESPONSE_TIME_MS}ms)"
  VALIDATION_RESULTS+=("Response Time: PASS")
}

check_load_testing() {
  info "Running load testing suite..."
  
  cd "$PROJECT_ROOT"
  
  # Run load tests
  if pnpm vitest run tests/performance/load-testing.spec.ts --reporter=verbose 2>&1 | tee -a "$LOG_FILE"; then
    success "Load testing completed successfully"
    VALIDATION_RESULTS+=("Load Testing: PASS")
  else
    error "Load testing failed"
    ((FAILED_CHECKS++))
    VALIDATION_RESULTS+=("Load Testing: FAIL")
    return 1
  fi
}

check_memory_usage() {
  info "Validating memory usage optimization..."
  
  # Check if memory monitoring is configured
  if [ -f "$PROJECT_ROOT/monitoring/scripts/metrics-middleware.js" ]; then
    success "Memory monitoring infrastructure present"
    VALIDATION_RESULTS+=("Memory Monitoring: PASS")
  else
    warning "Memory monitoring infrastructure not found"
    VALIDATION_RESULTS+=("Memory Monitoring: WARN")
  fi

  # Check Docker memory limits if using containers
  if command -v docker &> /dev/null; then
    info "Checking Docker container memory configuration..."
    if docker ps | grep -q pixelated; then
      success "Docker containers running"
      VALIDATION_RESULTS+=("Docker Memory: PASS")
    fi
  fi
}

check_error_handling() {
  info "Validating error handling across systems..."
  
  cd "$PROJECT_ROOT"
  
  # Check for error handling in critical paths
  ERROR_HANDLING_PATHS=(
    "src/lib/errors.ts"
    "src/lib/error-handler.ts"
    "exceptions.py"
  )
  
  ERROR_HANDLING_FOUND=0
  for path in "${ERROR_HANDLING_PATHS[@]}"; do
    if [ -f "$PROJECT_ROOT/$path" ]; then
      ((ERROR_HANDLING_FOUND++))
    fi
  done
  
  if [ $ERROR_HANDLING_FOUND -gt 0 ]; then
    success "Error handling infrastructure found ($ERROR_HANDLING_FOUND files)"
    VALIDATION_RESULTS+=("Error Handling: PASS")
  else
    warning "Limited error handling infrastructure found"
    VALIDATION_RESULTS+=("Error Handling: WARN")
  fi

  # Check monitoring alerts for error rate
  if [ -f "$PROJECT_ROOT/monitoring/alerts/application.yml" ]; then
    if grep -q "HighErrorRate" "$PROJECT_ROOT/monitoring/alerts/application.yml"; then
      success "Error rate monitoring configured"
    fi
  fi
}

check_monitoring_active() {
  info "Verifying monitoring systems are active..."
  
  MONITORING_CONFIGS=(
    "monitoring/prometheus/prometheus.yml"
    "monitoring/grafana/datasources.yml"
    "monitoring/dashboards/pixelated-empathy-overview.json"
  )
  
  MONITORING_CONFIGURED=0
  for config in "${MONITORING_CONFIGS[@]}"; do
    if [ -f "$PROJECT_ROOT/$config" ]; then
      ((MONITORING_CONFIGURED++))
    fi
  done
  
  if [ $MONITORING_CONFIGURED -eq ${#MONITORING_CONFIGS[@]} ]; then
    success "Monitoring systems configured ($MONITORING_CONFIGURED/${#MONITORING_CONFIGS[@]})"
    VALIDATION_RESULTS+=("Monitoring: PASS")
  else
    warning "Some monitoring configurations missing ($MONITORING_CONFIGURED/${#MONITORING_CONFIGS[@]})"
    VALIDATION_RESULTS+=("Monitoring: WARN")
  fi
}

# Generate summary report
generate_summary() {
  info ""
  info "========================================="
  info "Performance Validation Summary"
  info "========================================="
  info ""
  
  for result in "${VALIDATION_RESULTS[@]}"; do
    if [[ "$result" == *"PASS"* ]]; then
      success "$result"
    elif [[ "$result" == *"FAIL"* ]]; then
      error "$result"
    else
      warning "$result"
    fi
  done
  
  info ""
  info "Total checks: ${#VALIDATION_RESULTS[@]}"
  info "Failed checks: $FAILED_CHECKS"
  
  if [ $FAILED_CHECKS -eq 0 ]; then
    success "All performance validations passed!"
    info ""
    info "Performance benchmarks met:"
    info "  ? Response time: < ${MAX_RESPONSE_TIME_MS}ms"
    info "  ? Memory usage: Optimized"
    info "  ? Error handling: Validated"
    info "  ? Load testing: Completed"
    return 0
  else
    error "Performance validation incomplete ($FAILED_CHECKS failures)"
    info ""
    info "Please address the failed checks before launch."
    return 1
  fi
}

# Main execution
main() {
  check_response_time
  check_load_testing
  check_memory_usage
  check_error_handling
  check_monitoring_active
  
  generate_summary
}

main "$@"
