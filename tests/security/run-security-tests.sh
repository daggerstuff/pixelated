#!/bin/bash

# Define colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Define log function
log() {
	local message="$1"
	local color="${2:-${NC}}"
	echo -e "${color}${message}${NC}"
}

# Initialize counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Run endpoint security tests
log "\nRunning API endpoint security tests..." "${YELLOW}"
if pnpm dlx ts-node tests/security/ai-endpoint-scanner.ts; then
	log "Endpoint security tests passed ✅" "${GREEN}"
	TESTS_PASSED=$((TESTS_PASSED + 1))
else
	log "Endpoint security tests failed ❌" "${RED}"
	TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Run authentication bypass tests
log "\nRunning authentication bypass tests..." "${YELLOW}"
if pnpm dlx ts-node tests/security/ai-auth-bypass-tester.ts; then
	log "Authentication bypass tests passed ✅" "${GREEN}"
	TESTS_PASSED=$((TESTS_PASSED + 1))
else
	log "Authentication bypass tests failed ❌" "${RED}"
	TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Run web vulnerability tests
log "\nRunning web vulnerability tests..." "${YELLOW}"
if pnpm dlx ts-node tests/security/ai-web-vulnerability-scanner.ts; then
	log "Web vulnerability tests passed ✅" "${GREEN}"
	TESTS_PASSED=$((TESTS_PASSED + 1))
else
	log "Web vulnerability tests failed ❌" "${RED}"
	TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Run AI vulnerability scanner
log "\nRunning AI vulnerability scanner..." "${YELLOW}"
if pnpm dlx ts-node tests/security/ai-vulnerability-scanner.ts; then
	log "AI vulnerability scanner passed ✅" "${GREEN}"
	TESTS_PASSED=$((TESTS_PASSED + 1))
else
	log "AI vulnerability scanner failed ❌" "${RED}"
	TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Output summary
log "\n--- Security Test Summary ---"
log "Total tests: ${TESTS_TOTAL}"
log "Passed: ${TESTS_PASSED}" "${GREEN}"
log "Failed: ${TESTS_FAILED}" "${RED}"

# Return exit code based on results
if [[ ${TESTS_FAILED} -gt 0 ]]; then
	log "\nSome security tests failed! ❌" "${RED}"
	exit 1
else
	log "\nAll security tests passed! ✅" "${GREEN}"
	exit 0
fi
