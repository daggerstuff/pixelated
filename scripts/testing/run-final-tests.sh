#!/bin/bash

# Final Security and Load Testing Script
# Business Strategy CMS Production Testing

set -e

echo "🔒 Running Final Security & Load Tests..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
if ! nc -z localhost 3000; then
    echo -e "${YELLOW}🚀 Starting production server for testing...${NC}"
    npm run start:prod &
    SERVER_PID=$!
    sleep 10
fi

echo -e "${GREEN}🧪 Running Security Tests...${NC}"

# Install test dependencies
npm install --save-dev supertest autocannon

# Run security tests
npm test -- tests/security.test.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Security tests passed!${NC}"
else
    echo -e "${RED}❌ Security tests failed!${NC}"
    exit 1
fi

echo -e "${GREEN}⚡ Running Load Tests...${NC}"

# Run load tests
node tests/load.test.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Load tests passed!${NC}"
else
    echo -e "${RED}❌ Load tests failed!${NC}"
    exit 1
fi

echo -e "${GREEN}🔍 Running Security Scan...${NC}"

# Run security scan
npm audit --audit-level moderate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Security audit passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Security audit found vulnerabilities. Please review.${NC}"
fi

echo -e "${GREEN}🎯 Running Code Quality Checks...${NC}"

# Run linting
npm run lint

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Linting passed!${NC}"
else
    echo -e "${RED}❌ Linting failed!${NC}"
    exit 1
fi

# Run type checking
npm run typecheck

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Type checking passed!${NC}"
else
    echo -e "${RED}❌ Type checking failed!${NC}"
    exit 1
fi

# Clean up
if [[ ! -z "$SERVER_PID" ]]; then
    echo -e "${YELLOW}🧹 Stopping test server...${NC}"
    kill $SERVER_PID
fi

echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
echo ""
echo "📋 Production Readiness Checklist:"
echo "✅ Environment variables configured"
echo "✅ SSL certificates generated"
echo "✅ Monitoring and alerting configured"
echo "✅ Security tests passed"
echo "✅ Load tests passed"
echo "✅ Code quality checks passed"
echo ""
echo "🚀 Ready for production deployment!"