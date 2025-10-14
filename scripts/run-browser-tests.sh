#!/bin/bash

# Browser Test Runner Script
# Runs browser compatibility tests with proper error handling

set -e

echo "🧪 Starting Browser Compatibility Tests"
echo "======================================="

# Ensure test results directory exists
mkdir -p test-results/mobile test-results/cross-browser

# Set environment variables for testing
export NODE_ENV=test
export DISABLE_AUTH=true
export DISABLE_WEB_FONTS=true
export SKIP_MSW=true

echo "📦 Building project..."
pnpm run build

echo "🚀 Starting preview server..."
pnpm run preview &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to be ready..."
sleep 10

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
}

# Set trap to cleanup on script exit
trap cleanup EXIT

echo "🔍 Running browser tests..."

# Run tests with CI config
pnpm exec playwright test tests/browser/** tests/cross-browser/** \
    --config=playwright.config.ci.ts \
    --max-failures=10 \
    --reporter=html,list

echo "✅ Browser tests completed successfully!"