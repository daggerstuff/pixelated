#!/bin/bash

# Browser Compatibility Test Script with HTML Report Timeout
# This script runs browser compatibility tests and automatically stops the HTML report server after a timeout

set -e

# Configuration
TIMEOUT_SECONDS=60
REPORT_FILE="playwright-report-browser-compat/index.html"
CI_MODE=${CI:-false}
CONFIG_FILE="playwright-browser-compat.config.ts"

echo "🚀 Starting browser compatibility tests..."

# Function to handle cleanup
cleanup() {
    echo "🧹 Cleaning up background processes..."
    
    # Kill any Playwright HTML server processes
    pkill -f "playwright.*html.*report" 2>/dev/null || true
    
    # Kill any Node.js processes serving the report
    lsof -ti :9323 | xargs -r kill -9 2>/dev/null || true
    
    # Kill any background processes spawned by this script
    jobs -p | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
    echo "✅ Cleanup completed"
}

# Set up trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Run the tests
echo "🧪 Running Playwright browser compatibility tests..."
cd "$(dirname "$0")/.."

if [ "$CI_MODE" = "true" ]; then
    # In CI mode, just run tests and generate report without serving
    echo "📊 Running in CI mode - generating HTML report only"
    pnpm exec playwright test tests/browser-compatibility.spec.ts --config=$CONFIG_FILE
    
    # Check if report was generated
    if [ -f "$REPORT_FILE" ]; then
        echo "✅ HTML report generated successfully: $REPORT_FILE"
        echo "📄 Report available at: $(realpath $REPORT_FILE)"
    else
        echo "⚠️  HTML report not found at expected location: $REPORT_FILE"
    fi
else
    # In local development mode, generate report without serving by default
    echo "🔄 Running tests and generating HTML report..."
    
    # Run tests with the dedicated configuration
    pnpm exec playwright test tests/browser-compatibility.spec.ts --config=$CONFIG_FILE
    TEST_EXIT_CODE=$?
    
    echo "🏁 Tests completed with exit code: $TEST_EXIT_CODE"
    
    # Check if HTML report was generated
    if [ -f "$REPORT_FILE" ]; then
        echo "📊 HTML report generated successfully: $REPORT_FILE"
        echo "📄 Report file available at: $(realpath $REPORT_FILE)"
        
        # Offer to serve the report with timeout
        echo "🌐 Do you want to serve the HTML report locally? (y/N)"
        read -t 5 -n 1 serve_choice || serve_choice="n"
        echo
        
        if [[ "$serve_choice" =~ ^[Yy]$ ]]; then
            echo "� Starting local HTML report server..."
            echo "🌐 Report will be available at: http://localhost:8080"
            echo "⏰ Server will auto-stop in ${TIMEOUT_SECONDS} seconds..."
            echo "💡 Press Ctrl+C to stop immediately"
            
            # Start a simple HTTP server in the background
            (
                cd playwright-report-browser-compat
                python3 -m http.server 8080 2>/dev/null || \
                python -m http.server 8080 2>/dev/null || \
                npx http-server -p 8080 2>/dev/null
            ) &
            SERVER_PID=$!
            
            # Wait for the specified timeout
            sleep $TIMEOUT_SECONDS
            
            echo "⏱️  Timeout reached, stopping HTML report server..."
            kill $SERVER_PID 2>/dev/null || true
            wait $SERVER_PID 2>/dev/null || true
        else
            echo "📁 You can view the report by opening: $REPORT_FILE"
            echo "🌐 Or serve it manually with: python3 -m http.server 8080 -d playwright-report-browser-compat"
        fi
    else
        echo "⚠️  HTML report not found at expected location: $REPORT_FILE"
    fi
fi

echo "🎉 Browser compatibility test script completed!"
exit ${TEST_EXIT_CODE:-0}
