#!/bin/bash
set -e

# Performance Testing Automation
# ==============================

echo "🚀 Starting performance testing..."

# Configuration
TARGET_URL="${TARGET_URL:-https://pixelated-empathy.com}"
PERFORMANCE_BUDGET_FILE="${PERFORMANCE_BUDGET_FILE:-/home/vivi/pixelated/performance/performance-budget.json}"
RESULTS_DIR="/tmp/performance-results-$(date +%Y%m%d_%H%M%S)"

mkdir -p "$RESULTS_DIR"

# Lighthouse performance testing
run_lighthouse_tests() {
    echo "Running Lighthouse performance tests..."
    
    # Desktop performance test
    lighthouse "$TARGET_URL"         --output=json         --output-path="$RESULTS_DIR/lighthouse-desktop.json"         --preset=desktop         --chrome-flags="--headless --no-sandbox"
    
    # Mobile performance test
    lighthouse "$TARGET_URL"         --output=json         --output-path="$RESULTS_DIR/lighthouse-mobile.json"         --preset=mobile         --chrome-flags="--headless --no-sandbox"
    
    echo "✅ Lighthouse tests completed"
}

# WebPageTest performance testing
run_webpagetest() {
    echo "Running WebPageTest performance tests..."
    
    # API key required for WebPageTest
    if [ -n "$WEBPAGETEST_API_KEY" ]; then
        webpagetest test "$TARGET_URL"             --key "$WEBPAGETEST_API_KEY"             --location "Dulles:Chrome"             --runs 3             --output "$RESULTS_DIR/webpagetest.json"
    else
        echo "⚠️ WebPageTest API key not provided, skipping..."
    fi
}

# Load testing with Artillery
run_load_tests() {
    echo "Running load tests with Artillery..."
    
    cat > "$RESULTS_DIR/artillery-config.yml" << 'EOF'
config:
  target: '${TARGET_URL}'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  processor: "./processor.js"

scenarios:
  - name: "Homepage load test"
    weight: 40
    flow:
      - get:
          url: "/"
      - think: 2
      - get:
          url: "/api/health"
  
  - name: "API load test"
    weight: 60
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "testpassword"
      - think: 1
      - get:
          url: "/api/user/profile"
EOF
    
    artillery run "$RESULTS_DIR/artillery-config.yml"         --output "$RESULTS_DIR/artillery-results.json"
    
    echo "✅ Load tests completed"
}

# Database performance testing
run_database_performance_tests() {
    echo "Running database performance tests..."
    
    # Connection pool testing
    pgbench -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME"         -c 10 -j 2 -t 1000         -f /home/vivi/pixelated/performance/db-test-queries.sql         > "$RESULTS_DIR/pgbench-results.txt"
    
    # Query performance analysis
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME"         -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"         > "$RESULTS_DIR/slow-queries.txt"
    
    echo "✅ Database performance tests completed"
}

# Memory and CPU profiling
run_application_profiling() {
    echo "Running application profiling..."
    
    # Node.js memory profiling
    if command -v clinic &> /dev/null; then
        clinic doctor -- node app.js &
        APP_PID=$!
        
        # Let it run for 2 minutes
        sleep 120
        
        kill $APP_PID
        
        # Move clinic results
        mv .clinic "$RESULTS_DIR/clinic-results"
    fi
    
    echo "✅ Application profiling completed"
}

# Performance budget validation
validate_performance_budget() {
    echo "Validating performance budget..."
    
    # Extract metrics from Lighthouse results
    local desktop_fcp=$(jq -r '.audits["first-contentful-paint"].numericValue' "$RESULTS_DIR/lighthouse-desktop.json")
    local mobile_fcp=$(jq -r '.audits["first-contentful-paint"].numericValue' "$RESULTS_DIR/lighthouse-mobile.json")
    local desktop_lcp=$(jq -r '.audits["largest-contentful-paint"].numericValue' "$RESULTS_DIR/lighthouse-desktop.json")
    local mobile_lcp=$(jq -r '.audits["largest-contentful-paint"].numericValue' "$RESULTS_DIR/lighthouse-mobile.json")
    
    # Load performance budget
    local fcp_budget=$(jq -r '.performance_budgets.first_contentful_paint.budget' "$PERFORMANCE_BUDGET_FILE")
    local lcp_budget=$(jq -r '.performance_budgets.largest_contentful_paint.budget' "$PERFORMANCE_BUDGET_FILE")
    
    # Validate against budget
    local budget_violations=0
    
    if (( $(echo "$desktop_fcp > $fcp_budget" | bc -l) )); then
        echo "❌ Desktop FCP budget violation: ${desktop_fcp}ms > ${fcp_budget}ms"
        ((budget_violations++))
    fi
    
    if (( $(echo "$mobile_fcp > $fcp_budget" | bc -l) )); then
        echo "❌ Mobile FCP budget violation: ${mobile_fcp}ms > ${fcp_budget}ms"
        ((budget_violations++))
    fi
    
    if [ $budget_violations -eq 0 ]; then
        echo "✅ All performance budgets met"
        return 0
    else
        echo "❌ $budget_violations performance budget violations found"
        return 1
    fi
}

# Generate performance report
generate_performance_report() {
    echo "Generating performance report..."
    
    cat > "$RESULTS_DIR/performance-report.json" << EOF
{
  "performance_test_report": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "target_url": "$TARGET_URL",
    "test_duration": "$(date +%s)",
    "results_directory": "$RESULTS_DIR",
    "tests_executed": [
      "lighthouse_desktop",
      "lighthouse_mobile",
      "load_testing",
      "database_performance",
      "application_profiling"
    ],
    "performance_budget_status": "$(validate_performance_budget && echo 'passed' || echo 'failed')",
    "recommendations": [
      "Review slow database queries",
      "Optimize image loading",
      "Implement code splitting",
      "Enable compression"
    ]
  }
}
EOF
    
    echo "📊 Performance report generated: $RESULTS_DIR/performance-report.json"
}

# Main execution
run_lighthouse_tests
run_webpagetest
run_load_tests
run_database_performance_tests
run_application_profiling
validate_performance_budget
generate_performance_report

echo "✅ Performance testing automation completed"
echo "📁 Results available in: $RESULTS_DIR"
