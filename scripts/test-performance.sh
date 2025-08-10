#!/bin/bash

# Quick Lighthouse Performance Test
# Tests the current site performance and compares to budgets

set -e

URL="${1:-http://localhost:4321}"
OUTPUT_DIR="./performance-reports"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Quick Performance Test${NC}"
echo "========================="
echo "URL: $URL"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -f -s "$URL" > /dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${YELLOW}⚠️ Server not responding. Starting dev server...${NC}"
    echo "Run: pnpm dev"
    echo "Then run this script again with the server URL"
    exit 1
fi

# Run Lighthouse
echo ""
echo "🔬 Running Lighthouse performance test..."
echo "This may take 30-60 seconds..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/lighthouse_$TIMESTAMP.html"
JSON_FILE="$OUTPUT_DIR/lighthouse_$TIMESTAMP.json"

lighthouse "$URL" \
    --output=html \
    --output=json \
    --output-path="$OUTPUT_DIR/lighthouse_$TIMESTAMP" \
    --chrome-flags="--headless --no-sandbox" \
    --quiet \
    --form-factor=mobile \
    --throttling-method=simulate \
    --only-categories=performance

echo ""
echo -e "${GREEN}✅ Lighthouse test complete!${NC}"
echo ""

# Parse JSON results
if [ -f "$JSON_FILE" ]; then
    echo "📊 Performance Metrics:"
    echo "======================"
    
    # Extract key metrics using node (if available) or basic parsing
    if command -v node > /dev/null; then
        node -e "
            const report = require('./$JSON_FILE');
            const audits = report.audits;
            const lhr = report.lhr || report;
            
            console.log('Performance Score:', Math.round((lhr.categories?.performance?.score || 0) * 100) + '%');
            console.log('');
            
            const metrics = [
                ['First Contentful Paint', 'first-contentful-paint'],
                ['Largest Contentful Paint', 'largest-contentful-paint'],
                ['Time to Interactive', 'interactive'],
                ['Total Blocking Time', 'total-blocking-time'],
                ['Cumulative Layout Shift', 'cumulative-layout-shift']
            ];
            
            metrics.forEach(([name, key]) => {
                const audit = audits[key];
                if (audit) {
                    const value = audit.displayValue || audit.numericValue;
                    const score = audit.score ? Math.round(audit.score * 100) + '%' : 'N/A';
                    console.log(name + ':', value, '(Score: ' + score + ')');
                }
            });
        " 2>/dev/null || echo "Node.js not available for detailed parsing"
    else
        echo "Basic metrics extracted from HTML report"
    fi
    
    echo ""
    echo "📁 Reports saved:"
    echo "   HTML: $REPORT_FILE"
    echo "   JSON: $JSON_FILE"
    echo ""
    
    # Open HTML report if on desktop
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🌐 Opening report in browser..."
        open "$REPORT_FILE"
    elif [[ "$OSTYPE" == "linux-gnu"* ]] && command -v xdg-open > /dev/null; then
        echo "🌐 Opening report in browser..."
        xdg-open "$REPORT_FILE"
    else
        echo "🌐 Open this file in your browser to view the report:"
        echo "   file://$(pwd)/$REPORT_FILE"
    fi
    
    echo ""
    echo -e "${BLUE}💡 Performance Tips:${NC}"
    echo "   • Images > 600KB: Consider optimization"
    echo "   • JavaScript > 500KB: Consider code splitting"
    echo "   • FCP > 2s: Optimize critical resources"
    echo "   • TTI > 3.5s: Reduce JavaScript execution time"
    echo ""
    echo "🔧 Run optimization: ./scripts/performance-quickstart.sh"
    
else
    echo -e "${RED}❌ Could not find JSON report file${NC}"
fi

echo ""
echo -e "${GREEN}✨ Performance test complete!${NC}"
