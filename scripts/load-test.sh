#!/bin/bash
set -e

# Load Testing Script
echo "🚀 Starting Load Testing..."

# Configuration
TARGET_URL="${TARGET_URL:-https://pixelated-empathy.com}"
CONCURRENT_USERS="${CONCURRENT_USERS:-100}"
DURATION="${DURATION:-300}"
RAMP_UP="${RAMP_UP:-60}"

# Install k6 if not present
if ! command -v k6 &> /dev/null; then
    echo "Installing k6..."
    sudo apt-get update
    sudo apt-get install -y k6
fi

# Create k6 test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '${RAMP_UP}s', target: ${CONCURRENT_USERS} },
    { duration: '${DURATION}s', target: ${CONCURRENT_USERS} },
    { duration: '60s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

export default function() {
  // Test main page
  let response = http.get('${TARGET_URL}');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  // Test API endpoint
  response = http.get('${TARGET_URL}/api/health');
  check(response, {
    'API status is 200': (r) => r.status === 200,
    'API response time < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  sleep(1);
}
EOF

# Run load test
echo "Running load test with $CONCURRENT_USERS concurrent users for $DURATION seconds..."
k6 run load-test.js

# Cleanup
rm -f load-test.js

echo "✅ Load testing completed"
