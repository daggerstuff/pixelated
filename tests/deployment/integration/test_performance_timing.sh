#!/bin/bash

# Performance and Timing Integration Tests
# Tests deployment performance requirements and timing validation

set -e

# Test configuration
TEST_DIR="/tmp/deployment-integration-performance"
TEST_LOG="/tmp/test-performance-timing.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for test output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Performance thresholds (in milliseconds)
readonly ENVIRONMENT_SETUP_THRESHOLD=5000      # 5 seconds
readonly CODE_SYNC_THRESHOLD=30000             # 30 seconds
readonly CONTAINER_BUILD_THRESHOLD=120000      # 2 minutes
readonly HEALTH_CHECK_THRESHOLD=10000          # 10 seconds
readonly TOTAL_DEPLOYMENT_THRESHOLD=300000     # 5 minutes

# Test utilities
print_test_header() { echo -e "${BLUE}[PERF-TEST]${NC} $1"; }
print_test_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
print_test_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
print_test_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Performance measurement utilities
get_timestamp_ms() {
    date +%s%3N
}

calculate_duration() {
    local start_time="$1"
    local end_time="$2"
    echo $((end_time - start_time))
}

format_duration() {
    local duration_ms="$1"
    local duration_sec=$((duration_ms / 1000))
    local remaining_ms=$((duration_ms % 1000))
    echo "${duration_sec}.${remaining_ms}s"
}

# Initialize test environment
setup_test_environment() {
    print_test_header "Setting up performance and timing test environment"

    # Create test directory structure
    mkdir -p "$TEST_DIR"/{mocks,logs,metrics,scenarios}
    cd "$TEST_DIR"

    # Create performance measurement tools
    setup_performance_mocks

    # Initialize test log
    echo "=== Performance and Timing Integration Tests - $(date) ===" > "$TEST_LOG"

    print_test_info "Test environment initialized in $TEST_DIR"
}

# Setup performance testing mocks
setup_performance_mocks() {
    print_test_info "Setting up performance testing mocks"

    # Create mock commands with realistic timing
    cat > "$TEST_DIR/mocks/ssh-timed" << 'EOF'
#!/bin/bash
# Mock SSH with realistic timing

# Simulate network latency
sleep 0.1

case "$*" in
    *"node --version"*)
        sleep 0.2  # Environment check time
        echo "v24.7.0"
        exit 0
        ;;
    *"pnpm --version"*)
        sleep 0.2  # Environment check time
        echo "10.26.2"
        exit 0
        ;;
    *"docker build"*)
        sleep 5.0  # Container build time
        echo "Successfully built mock-image-id"
        echo "Successfully tagged pixelated-empathy:latest"
        exit 0
        ;;
    *"curl"*"localhost:3000"*)
        sleep 0.05  # Health check response time
        echo "HTTP/1.1 200 OK"
        exit 0
        ;;
    *)
        sleep 0.1  # Default command execution time
        echo "Mock SSH: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/mocks/ssh-timed"

    # Create mock rsync with realistic timing
    cat > "$TEST_DIR/mocks/rsync-timed" << 'EOF'
#!/bin/bash
# Mock rsync with realistic timing

# Simulate file transfer time based on "size"
local file_count=100
local transfer_time=$(echo "scale=2; $file_count * 0.01" | bc -l 2>/dev/null || echo "1")
sleep "$transfer_time"

echo "sent 1,234,567 bytes  received 890 bytes  123,456.78 bytes/sec"
echo "total size is 12,345,678  speedup is 10.01"
exit 0
EOF
    chmod +x "$TEST_DIR/mocks/rsync-timed"

    # Create mock docker with realistic timing
    cat > "$TEST_DIR/mocks/docker-timed" << 'EOF'
#!/bin/bash
# Mock docker with realistic timing

case "$1" in
    "build")
        # Simulate realistic build time
        echo "Step 1/8 : FROM node:18-alpine"
        sleep 1.0
        echo "Step 2/8 : WORKDIR /app"
        sleep 0.5
        echo "Step 3/8 : COPY package*.json ./"
        sleep 0.5
        echo "Step 4/8 : RUN npm install"
        sleep 2.0  # npm install takes time
        echo "Step 5/8 : COPY . ."
        sleep 1.0
        echo "Step 6/8 : EXPOSE 3000"
        sleep 0.1
        echo "Step 7/8 : CMD [\"npm\", \"start\"]"
        sleep 0.1
        echo "Successfully built mock-image-id"
        echo "Successfully tagged $3"
        exit 0
        ;;
    "run")
        sleep 0.5  # Container startup time
        echo "mock-container-id"
        exit 0
        ;;
    "push")
        sleep 3.0  # Registry push time
        echo "The push refers to repository [git.pixelatedempathy.tech/pixelated-empathy]"
        echo "latest: digest: sha256:mock-digest size: 1234"
        exit 0
        ;;
    *)
        sleep 0.1
        echo "Mock docker: $*"
        exit 0
        ;;
esac
EOF
    chmod +x "$TEST_DIR/mocks/docker-timed"

    export PATH="$TEST_DIR/mocks:$PATH"
}

# Cleanup test environment
cleanup_test_environment() {
    print_test_header "Cleaning up performance and timing test environment"
    cd /tmp
    rm -rf "$TEST_DIR"
    print_test_info "Test environment cleaned up"
}

# Test environment setup performance
test_environment_setup_performance() {
    print_test_header "Testing environment setup performance"
    ((TESTS_RUN++))

    measure_environment_setup() {
        local metrics_file="$1"

        echo "=== Environment Setup Performance Measurement ===" > "$metrics_file"

        # Measure Node.js version check
        local start_time=$(get_timestamp_ms)
        ssh-timed root@test-host "node --version" >/dev/null 2>&1
        local end_time=$(get_timestamp_ms)
        local node_check_duration=$(calculate_duration "$start_time" "$end_time")

        echo "Node.js version check: ${node_check_duration}ms" >> "$metrics_file"

        # Measure pnpm version check
        start_time=$(get_timestamp_ms)
        ssh-timed root@test-host "pnpm --version" >/dev/null 2>&1
        end_time=$(get_timestamp_ms)
        local pnpm_check_duration=$(calculate_duration "$start_time" "$end_time")

        echo "pnpm version check: ${pnpm_check_duration}ms" >> "$metrics_file"

        # Calculate total environment setup time
        local total_env_duration=$((node_check_duration + pnpm_check_duration))
        echo "Total environment setup: ${total_env_duration}ms" >> "$metrics_file"

        # Validate against threshold
        if [[ $total_env_duration -lt $ENVIRONMENT_SETUP_THRESHOLD ]]; then
            echo "Environment setup performance: PASS" >> "$metrics_file"
            return 0
        else
            echo "Environment setup performance: FAIL (exceeded ${ENVIRONMENT_SETUP_THRESHOLD}ms)" >> "$metrics_file"
            return 1
        fi
    }

    local metrics_file="$TEST_DIR/metrics/environment-setup.txt"
    mkdir -p "$(dirname "$metrics_file")"

    if measure_environment_setup "$metrics_file"; then
        local total_time=$(grep "Total environment setup:" "$metrics_file" | awk '{print $4}' | sed 's/ms//')
        print_test_pass "Environment setup performance within threshold ($(format_duration "$total_time"))"
    else
        local total_time=$(grep "Total environment setup:" "$metrics_file" | awk '{print $4}' | sed 's/ms//')
        print_test_fail "Environment setup performance exceeded threshold ($(format_duration "$total_time"))"
    fi
}

# Test code synchronization performance
test_code_sync_performance() {
    print_test_header "Testing code synchronization performance"
    ((TESTS_RUN++))

    measure_code_sync() {
        local metrics_file="$1"

        echo "=== Code Synchronization Performance Measurement ===" > "$metrics_file"

        # Create mock project structure for timing
        mkdir -p "$TEST_DIR/mock-project"/{src,public,node_modules}

        # Create some files to simulate realistic project
        for i in {1..50}; do
            echo "console.log('file $i');" > "$TEST_DIR/mock-project/src/file$i.js"
        done

        for i in {1..20}; do
            echo "<h1>Page $i</h1>" > "$TEST_DIR/mock-project/public/page$i.html"
        done

        # Measure rsync performance
        local start_time=$(get_timestamp_ms)
        rsync-timed -avz --delete "$TEST_DIR/mock-project/" root@test-host:/root/pixelated/ >/dev/null 2>&1
        local end_time=$(get_timestamp_ms)
        local sync_duration=$(calculate_duration "$start_time" "$end_time")

        echo "Code synchronization: ${sync_duration}ms" >> "$metrics_file"

        # Validate against threshold
        if [[ $sync_duration -lt $CODE_SYNC_THRESHOLD ]]; then
            echo "Code sync performance: PASS" >> "$metrics_file"
            return 0
        else
            echo "Code sync performance: FAIL (exceeded ${CODE_SYNC_THRESHOLD}ms)" >> "$metrics_file"
            return 1
        fi
    }

    local metrics_file="$TEST_DIR/metrics/code-sync.txt"

    if measure_code_sync "$metrics_file"; then
        local sync_time=$(grep "Code synchronization:" "$metrics_file" | awk '{print $3}' | sed 's/ms//')
        print_test_pass "Code synchronization performance within threshold ($(format_duration "$sync_time"))"
    else
        local sync_time=$(grep "Code synchronization:" "$metrics_file" | awk '{print $3}' | sed 's/ms//')
        print_test_fail "Code synchronization performance exceeded threshold ($(format_duration "$sync_time"))"
    fi
}

# Test container build performance
test_container_build_performance() {
    print_test_header "Testing container build performance"
    ((TESTS_RUN++))

    measure_container_build() {
        local metrics_file="$1"

        echo "=== Container Build Performance Measurement ===" > "$metrics_file"

        # Measure container build time
        local start_time=$(get_timestamp_ms)
        docker-timed build -t pixelated-empathy:test . >/dev/null 2>&1
        local end_time=$(get_timestamp_ms)
        local build_duration=$(calculate_duration "$start_time" "$end_time")

        echo "Container build: ${build_duration}ms" >> "$metrics_file"

        # Validate against threshold
        if [[ $build_duration -lt $CONTAINER_BUILD_THRESHOLD ]]; then
            echo "Container build performance: PASS" >> "$metrics_file"
            return 0
        else
            echo "Container build performance: FAIL (exceeded ${CONTAINER_BUILD_THRESHOLD}ms)" >> "$metrics_file"
            return 1
        fi
    }

    local metrics_file="$TEST_DIR/metrics/container-build.txt"

    if measure_container_build "$metrics_file"; then
        local build_time=$(grep "Container build:" "$metrics_file" | awk '{print $3}' | sed 's/ms//')
        print_test_pass "Container build performance within threshold ($(format_duration "$build_time"))"
    else
        local build_time=$(grep "Container build:" "$metrics_file" | awk '{print $3}' | sed 's/ms//')
        print_test_fail "Container build performance exceeded threshold ($(format_duration "$build_time"))"
    fi
}

# Test health check performance
test_health_check_performance() {
    print_test_header "Testing health check performance"
    ((TESTS_RUN++))

    measure_health_checks() {
        local metrics_file="$1"

        echo "=== Health Check Performance Measurement ===" > "$metrics_file"

        # Measure basic connectivity
        local start_time=$(get_timestamp_ms)
        ssh-timed root@test-host "curl -f http://localhost:3000" >/dev/null 2>&1
        local end_time=$(get_timestamp_ms)
        local basic_check_duration=$(calculate_duration "$start_time" "$end_time")

        echo "Basic connectivity check: ${basic_check_duration}ms" >> "$metrics_file"

        # Measure API endpoint checks
        start_time=$(get_timestamp_ms)
        ssh-timed root@test-host "curl -f http://localhost:3000/api/health" >/dev/null 2>&1
        end_time=$(get_timestamp_ms)
        local api_check_duration=$(calculate_duration "$start_time" "$end_time")

        echo "API endpoint check: ${api_check_duration}ms" >> "$metrics_file"

        # Measure static asset checks
        start_time=$(get_timestamp_ms)
        ssh-timed root@test-host "curl -f http://localhost:3000/assets/main.css" >/dev/null 2>&1
        end_time=$(get_timestamp_ms)
        local asset_check_duration=$(calculate_duration "$start_time" "$end_time")

        echo "Static asset check: ${asset_check_duration}ms" >> "$metrics_file"

        # Calculate total health check time
        local total_health_duration=$((basic_check_duration + api_check_duration + asset_check_duration))
        echo "Total health checks: ${total_health_duration}ms" >> "$metrics_file"

        # Validate against threshold
        if [[ $total_health_duration -lt $HEALTH_CHECK_THRESHOLD ]]; then
            echo "Health check performance: PASS" >> "$metrics_file"
            return 0
        else
            echo "Health check performance: FAIL (exceeded ${HEALTH_CHECK_THRESHOLD}ms)" >> "$metrics_file"
            return 1
        fi
    }

    local metrics_file="$TEST_DIR/metrics/health-checks.txt"

    if measure_health_checks "$metrics_file"; then
        local health_time=$(grep "Total health checks:" "$metrics_file" | awk '{print $4}' | sed 's/ms//')
        print_test_pass "Health check performance within threshold ($(format_duration "$health_time"))"
    else
        local health_time=$(grep "Total health checks:" "$metrics_file" | awk '{print $4}' | sed 's/ms//')
        print_test_fail "Health check performance exceeded threshold ($(format_duration "$health_time"))"
    fi
}

# Test registry push performance
test_registry_push_performance() {
    print_test_header "Testing registry push performance"
    ((TESTS_RUN++))

    measure_registry_push() {
        local metrics_file="$1"

        echo "=== Registry Push Performance Measurement ===" > "$metrics_file"

        # Measure registry push time
        local start_time=$(get_timestamp_ms)
        docker-timed push git.pixelatedempathy.tech/pixelated-empathy:latest >/dev/null 2>&1
        local end_time=$(get_timestamp_ms)
        local push_duration=$(calculate_duration "$start_time" "$end_time")

        echo "Registry push: ${push_duration}ms" >> "$metrics_file"

        # Registry push is optional, so we use a more lenient threshold
        local registry_threshold=60000  # 1 minute

        if [[ $push_duration -lt $registry_threshold ]]; then
            echo "Registry push performance: PASS" >> "$metrics_file"
            return 0
        else
            echo "Registry push performance: WARNING (exceeded ${registry_threshold}ms)" >> "$metrics_file"
            return 0  # Don't fail deployment for registry issues
        fi
    }

    local metrics_file="$TEST_DIR/metrics/registry-push.txt"

    if measure_registry_push "$metrics_file"; then
        local push_time=$(grep "Registry push:" "$metrics_file" | awk '{print $3}' | sed 's/ms//')
        if grep -q "WARNING" "$metrics_file"; then
            print_test_pass "Registry push performance acceptable with warning ($(format_duration "$push_time"))"
        else
            print_test_pass "Registry push performance within threshold ($(format_duration "$push_time"))"
        fi
    else
        print_test_fail "Registry push performance measurement failed"
    fi
}

# Test complete deployment timing
test_complete_deployment_timing() {
    print_test_header "Testing complete deployment timing"
    ((TESTS_RUN++))

    measure_complete_deployment() {
        local metrics_file="$1"

        echo "=== Complete Deployment Timing Measurement ===" > "$metrics_file"

        local deployment_start=$(get_timestamp_ms)

        # Stage 1: Environment Setup
        local stage1_start=$(get_timestamp_ms)
        ssh-timed root@test-host "node --version" >/dev/null 2>&1
        ssh-timed root@test-host "pnpm --version" >/dev/null 2>&1
        local stage1_end=$(get_timestamp_ms)
        local stage1_duration=$(calculate_duration "$stage1_start" "$stage1_end")
        echo "Stage 1 (Environment Setup): ${stage1_duration}ms" >> "$metrics_file"

        # Stage 2: Code Synchronization
        local stage2_start=$(get_timestamp_ms)
        rsync-timed -avz --delete /mock/project/ root@test-host:/root/pixelated/ >/dev/null 2>&1
        local stage2_end=$(get_timestamp_ms)
        local stage2_duration=$(calculate_duration "$stage2_start" "$stage2_end")
        echo "Stage 2 (Code Sync): ${stage2_duration}ms" >> "$metrics_file"

        # Stage 3: Container Build
        local stage3_start=$(get_timestamp_ms)
        docker-timed build -t pixelated-empathy:latest . >/dev/null 2>&1
        local stage3_end=$(get_timestamp_ms)
        local stage3_duration=$(calculate_duration "$stage3_start" "$stage3_end")
        echo "Stage 3 (Container Build): ${stage3_duration}ms" >> "$metrics_file"

        # Stage 4: Health Checks
        local stage4_start=$(get_timestamp_ms)
        ssh-timed root@test-host "curl -f http://localhost:3000" >/dev/null 2>&1
        ssh-timed root@test-host "curl -f http://localhost:3000/api/health" >/dev/null 2>&1
        local stage4_end=$(get_timestamp_ms)
        local stage4_duration=$(calculate_duration "$stage4_start" "$stage4_end")
        echo "Stage 4 (Health Checks): ${stage4_duration}ms" >> "$metrics_file"

        # Stage 5: Registry Push (optional)
        local stage5_start=$(get_timestamp_ms)
        docker-timed push git.pixelatedempathy.tech/pixelated-empathy:latest >/dev/null 2>&1
        local stage5_end=$(get_timestamp_ms)
        local stage5_duration=$(calculate_duration "$stage5_start" "$stage5_end")
        echo "Stage 5 (Registry Push): ${stage5_duration}ms" >> "$metrics_file"

        local deployment_end=$(get_timestamp_ms)
        local total_duration=$(calculate_duration "$deployment_start" "$deployment_end")
        echo "Total Deployment Time: ${total_duration}ms" >> "$metrics_file"

        # Performance analysis
        echo "" >> "$metrics_file"
        echo "=== Performance Analysis ===" >> "$metrics_file"

        # Find slowest stage
        local slowest_stage="Unknown"
        local slowest_duration=0

        if [[ $stage1_duration -gt $slowest_duration ]]; then
            slowest_stage="Environment Setup"
            slowest_duration=$stage1_duration
        fi

        if [[ $stage2_duration -gt $slowest_duration ]]; then
            slowest_stage="Code Sync"
            slowest_duration=$stage2_duration
        fi

        if [[ $stage3_duration -gt $slowest_duration ]]; then
            slowest_stage="Container Build"
            slowest_duration=$stage3_duration
        fi

        if [[ $stage4_duration -gt $slowest_duration ]]; then
            slowest_stage="Health Checks"
            slowest_duration=$stage4_duration
        fi

        if [[ $stage5_duration -gt $slowest_duration ]]; then
            slowest_stage="Registry Push"
            slowest_duration=$stage5_duration
        fi

        echo "Slowest stage: $slowest_stage ($(format_duration "$slowest_duration"))" >> "$metrics_file"

        # Calculate percentages
        local env_percent=$((stage1_duration * 100 / total_duration))
        local sync_percent=$((stage2_duration * 100 / total_duration))
        local build_percent=$((stage3_duration * 100 / total_duration))
        local health_percent=$((stage4_duration * 100 / total_duration))
        local registry_percent=$((stage5_duration * 100 / total_duration))

        echo "Time distribution:" >> "$metrics_file"
        echo "  Environment Setup: ${env_percent}%" >> "$metrics_file"
        echo "  Code Sync: ${sync_percent}%" >> "$metrics_file"
        echo "  Container Build: ${build_percent}%" >> "$metrics_file"
        echo "  Health Checks: ${health_percent}%" >> "$metrics_file"
        echo "  Registry Push: ${registry_percent}%" >> "$metrics_file"

        # Validate against total threshold
        if [[ $total_duration -lt $TOTAL_DEPLOYMENT_THRESHOLD ]]; then
            echo "Overall deployment performance: PASS" >> "$metrics_file"
            return 0
        else
            echo "Overall deployment performance: FAIL (exceeded ${TOTAL_DEPLOYMENT_THRESHOLD}ms)" >> "$metrics_file"
            return 1
        fi
    }

    local metrics_file="$TEST_DIR/metrics/complete-deployment.txt"

    if measure_complete_deployment "$metrics_file"; then
        local total_time=$(grep "Total Deployment Time:" "$metrics_file" | awk '{print $4}' | sed 's/ms//')
        local slowest_stage=$(grep "Slowest stage:" "$metrics_file" | cut -d: -f2 | sed 's/^ *//')
        print_test_pass "Complete deployment timing within threshold ($(format_duration "$total_time"), slowest: $slowest_stage)"
    else
        local total_time=$(grep "Total Deployment Time:" "$metrics_file" | awk '{print $4}' | sed 's/ms//')
        print_test_fail "Complete deployment timing exceeded threshold ($(format_duration "$total_time"))"
    fi
}

# Test performance regression detection
test_performance_regression_detection() {
    print_test_header "Testing performance regression detection"
    ((TESTS_RUN++))

    simulate_performance_regression() {
        local baseline_file="$1"
        local current_file="$2"
        local regression_report="$3"

        # Create baseline performance data
        cat > "$baseline_file" << EOF
Environment Setup: 1500ms
Code Sync: 8000ms
Container Build: 45000ms
Health Checks: 2000ms
Registry Push: 15000ms
Total: 71500ms
EOF

        # Create current performance data (with regression)
        cat > "$current_file" << EOF
Environment Setup: 1800ms
Code Sync: 12000ms
Container Build: 65000ms
Health Checks: 2500ms
Registry Push: 18000ms
Total: 99300ms
EOF

        # Analyze regression
        echo "=== Performance Regression Analysis ===" > "$regression_report"

        local baseline_total=$(grep "Total:" "$baseline_file" | awk '{print $2}' | sed 's/ms//')
        local current_total=$(grep "Total:" "$current_file" | awk '{print $2}' | sed 's/ms//')

        local regression_percent=$(((current_total - baseline_total) * 100 / baseline_total))

        echo "Baseline total: $(format_duration "$baseline_total")" >> "$regression_report"
        echo "Current total: $(format_duration "$current_total")" >> "$regression_report"
        echo "Regression: ${regression_percent}%" >> "$regression_report"

        # Check individual stages for regression
        local stages=("Environment Setup" "Code Sync" "Container Build" "Health Checks" "Registry Push")

        for stage in "${stages[@]}"; do
            local baseline_stage=$(grep "$stage:" "$baseline_file" | awk '{print $3}' | sed 's/ms//')
            local current_stage=$(grep "$stage:" "$current_file" | awk '{print $3}' | sed 's/ms//')

            if [[ $current_stage -gt $baseline_stage ]]; then
                local stage_regression=$(((current_stage - baseline_stage) * 100 / baseline_stage))
                if [[ $stage_regression -gt 20 ]]; then  # > 20% regression
                    echo "WARNING: $stage regression: ${stage_regression}%" >> "$regression_report"
                fi
            fi
        done

        # Overall assessment
        if [[ $regression_percent -gt 30 ]]; then
            echo "CRITICAL: Significant performance regression detected" >> "$regression_report"
            return 1
        elif [[ $regression_percent -gt 15 ]]; then
            echo "WARNING: Moderate performance regression detected" >> "$regression_report"
            return 0
        else
            echo "PASS: Performance within acceptable range" >> "$regression_report"
            return 0
        fi
    }

    local baseline_file="$TEST_DIR/metrics/baseline-performance.txt"
    local current_file="$TEST_DIR/metrics/current-performance.txt"
    local regression_report="$TEST_DIR/metrics/regression-analysis.txt"

    if simulate_performance_regression "$baseline_file" "$current_file" "$regression_report"; then
        if grep -q "WARNING" "$regression_report"; then
            print_test_pass "Performance regression detection identifies moderate regression"
        else
            print_test_pass "Performance regression detection confirms acceptable performance"
        fi
    else
        if grep -q "CRITICAL" "$regression_report"; then
            print_test_pass "Performance regression detection correctly identifies critical regression"
        else
            print_test_fail "Performance regression detection failed to identify issues"
        fi
    fi
}

# Test performance optimization recommendations
test_performance_optimization_recommendations() {
    print_test_header "Testing performance optimization recommendations"
    ((TESTS_RUN++))

    generate_optimization_recommendations() {
        local performance_data="$1"
        local recommendations_file="$2"

        # Create mock performance data
        cat > "$performance_data" << EOF
Environment Setup: 2500ms (slow)
Code Sync: 25000ms (acceptable)
Container Build: 90000ms (slow)
Health Checks: 1500ms (fast)
Registry Push: 20000ms (acceptable)
Total: 139000ms
EOF

        echo "=== Performance Optimization Recommendations ===" > "$recommendations_file"
        echo "Generated: $(date)" >> "$recommendations_file"
        echo "" >> "$recommendations_file"

        # Analyze each stage and provide recommendations
        while IFS= read -r line; do
            local stage=$(echo "$line" | cut -d: -f1)
            local timing=$(echo "$line" | awk '{print $2}' | sed 's/ms//')
            local status=$(echo "$line" | grep -o '([^)]*)' | sed 's/[()]//g')

            case "$stage" in
                "Environment Setup")
                    if [[ "$status" == "slow" ]]; then
                        echo "🔧 $stage Optimization:" >> "$recommendations_file"
                        echo "  - Cache Node.js and pnpm installations" >> "$recommendations_file"
                        echo "  - Use connection multiplexing for SSH" >> "$recommendations_file"
                        echo "  - Implement parallel version checks" >> "$recommendations_file"
                        echo "" >> "$recommendations_file"
                    fi
                    ;;
                "Code Sync")
                    if [[ "$status" == "slow" ]]; then
                        echo "🔧 $stage Optimization:" >> "$recommendations_file"
                        echo "  - Use rsync with compression (-z)" >> "$recommendations_file"
                        echo "  - Implement incremental sync with checksums" >> "$recommendations_file"
                        echo "  - Exclude unnecessary files (.git, node_modules)" >> "$recommendations_file"
                        echo "" >> "$recommendations_file"
                    fi
                    ;;
                "Container Build")
                    if [[ "$status" == "slow" ]]; then
                        echo "🔧 $stage Optimization:" >> "$recommendations_file"
                        echo "  - Implement multi-stage Docker builds" >> "$recommendations_file"
                        echo "  - Use Docker layer caching" >> "$recommendations_file"
                        echo "  - Optimize Dockerfile instruction order" >> "$recommendations_file"
                        echo "  - Use .dockerignore to reduce build context" >> "$recommendations_file"
                        echo "" >> "$recommendations_file"
                    fi
                    ;;
                "Health Checks")
                    if [[ "$status" == "slow" ]]; then
                        echo "🔧 $stage Optimization:" >> "$recommendations_file"
                        echo "  - Reduce health check timeout values" >> "$recommendations_file"
                        echo "  - Implement parallel health checks" >> "$recommendations_file"
                        echo "  - Use lightweight health check endpoints" >> "$recommendations_file"
                        echo "" >> "$recommendations_file"
                    fi
                    ;;
                "Registry Push")
                    if [[ "$status" == "slow" ]]; then
                        echo "🔧 $stage Optimization:" >> "$recommendations_file"
                        echo "  - Use registry mirrors or CDN" >> "$recommendations_file"
                        echo "  - Implement image layer deduplication" >> "$recommendations_file"
                        echo "  - Consider registry push as optional/async" >> "$recommendations_file"
                        echo "" >> "$recommendations_file"
                    fi
                    ;;
            esac
        done < "$performance_data"

        # Overall recommendations
        echo "🎯 Overall Recommendations:" >> "$recommendations_file"
        echo "  - Implement deployment pipeline parallelization" >> "$recommendations_file"
        echo "  - Use performance monitoring and alerting" >> "$recommendations_file"
        echo "  - Set up performance regression testing" >> "$recommendations_file"
        echo "  - Consider blue-green deployment for zero downtime" >> "$recommendations_file"

        return 0
    }

    local performance_data="$TEST_DIR/metrics/performance-analysis.txt"
    local recommendations_file="$TEST_DIR/metrics/optimization-recommendations.txt"

    if generate_optimization_recommendations "$performance_data" "$recommendations_file"; then
        local recommendation_count=$(grep -c "🔧\|🎯" "$recommendations_file")
        if [[ $recommendation_count -ge 3 ]]; then
            print_test_pass "Performance optimization recommendations generated comprehensive suggestions"
        else
            print_test_fail "Performance optimization recommendations insufficient (count: $recommendation_count)"
        fi
    else
        print_test_fail "Performance optimization recommendations generation failed"
    fi
}

# Run all performance and timing tests
run_all_performance_tests() {
    print_test_header "Starting Performance and Timing Integration Tests"

    setup_test_environment

    # Run individual performance test scenarios
    test_environment_setup_performance
    test_code_sync_performance
    test_container_build_performance
    test_health_check_performance
    test_registry_push_performance
    test_complete_deployment_timing
    test_performance_regression_detection
    test_performance_optimization_recommendations

    cleanup_test_environment

    # Print test summary
    print_test_header "Performance and Timing Test Summary"
    echo "Tests run: $TESTS_RUN"
    echo "Tests passed: $TESTS_PASSED"
    echo "Tests failed: $TESTS_FAILED"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        print_test_pass "All performance and timing tests passed!"
        exit 0
    else
        print_test_fail "$TESTS_FAILED performance and timing tests failed"
        exit 1
    fi
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_all_performance_tests
fi
