#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up test environment...${NC}"

# Check if Redis is running
redis-cli ping >/dev/null 2>&1
if [ $? -eq 0 ]; then
	echo -e "${GREEN}✓ Redis is running${NC}"
	export REDIS_AVAILABLE=true
else
	echo -e "${YELLOW}⚠ Redis is not running. Redis tests will be skipped${NC}"
	export SKIP_REDIS_TESTS=true
fi

# Set required environment variables
export REDIS_URL="redis://localhost:6379"
export REDIS_KEY_PREFIX="test:"
export VITEST_TIMEOUT=30000
export NODE_ENV=test

# Create necessary directories
mkdir -p src/lib/utils/__mocks__
mkdir -p src/lib/services/redis/__mocks__

# Create basic mocks
echo -e "${YELLOW}Creating test mocks...${NC}"

# Ensure Redis mock exists
if [ ! -f src/lib/services/redis/__mocks__/redis.mock.ts ]; then
	echo "Creating Redis mock file"
	cp -f vitest.setup.ts src/lib/services/redis/__mocks__/redis.mock.ts
fi

echo -e "${GREEN}Running tests...${NC}"
# Run tests with parallel execution (but limited to avoid race conditions)
pnpm test --pool=threads --poolOptions.threads.minThreads=0 --poolOptions.threads.maxThreads=3

# Check test result
TEST_RESULT=$?
if ((TEST_RESULT == 0)); then
	echo -e "${GREEN}✓ All tests passed successfully!${NC}"
else
	echo -e "${RED}✗ Tests failed with exit code ${TEST_RESULT}${NC}"
fi

exit "${TEST_RESULT}"
