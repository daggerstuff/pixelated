#!/bin/bash
set -euo pipefail

# Fix TypeScript Errors - Shell Script Wrapper
# This script provides a convenient way to run the TypeScript error fixer

# Colors for better output
# shellcheck disable=SC2034
# shellcheck disable=SC2034
# shellcheck disable=SC2034
# shellcheck disable=SC2034
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right environment
if [[ -z ${CONDA_DEFAULT_ENV} ]] || [[ ${CONDA_DEFAULT_ENV} != "pixelated" ]]; then
	echo -e "${YELLOW}Warning: Not in the pixelated conda environment.${NC}"
	echo -e "${YELLOW}It's recommended to run: conda activate pixelated${NC}"
	read -p "Continue anyway? (y/n) " -n 1 -r
	echo
	if [[ ! ${REPLY} =~ ^[Yy]$ ]]; then
		exit 1
	fi
fi
# Change to the project root directory
if [[ -z ${PROJECT_ROOT} ]]; then
	PROJECT_ROOT="$(cd "$(dirname "${0}")/../.." && pwd)"
fi
if [[ -z ${PROJECT_ROOT} ]]; then
	echo -e "${RED}Error: Could not find project root directory.${NC}"
	exit 1
fi
cd "${PROJECT_ROOT}" || {
	echo -e "${RED}Error: Could not change to project root directory.${NC}"
}

echo -e "${BLUE}=== TypeScript Error Fixer ===${NC}"
echo -e "${BLUE}Project root: ${PROJECT_ROOT}${NC}"

# Check if the TypeScript fixer script exists
TS_FIXER="src/scripts/fix-ts-errors.ts"
if [[ ! -f ${TS_FIXER} ]]; then
	echo -e "${RED}Error: TypeScript fixer script not found at ${TS_FIXER}${NC}"
	exit 1
fi

# Check if arguments are provided
if [[ ${1} == "--help" ]]; then
	echo "Usage: ./fix-ts-errors.sh [options]"
	echo ""
	echo "Options:"
	echo "  --dry-run     Preview changes without applying them"
	echo "  --verbose     Show detailed logging"
	echo "  --list        List files with TypeScript errors"
	echo "  --fix-file    Fix a specific file (e.g. --fix-file src/components/Chat.tsx)"
	echo "  --help        Show this help message"
	exit 0
fi

# Run the TypeScript fixer script
echo -e "${GREEN}Running TypeScript error fixer...${NC}"
npx tsx "${TS_FIXER}" "$@"

# Check the result
if [[ ${?} -eq 0 ]]; then
	echo -e "${GREEN}TypeScript error fixer completed successfully.${NC}"

	# Provide helpful next steps
	echo -e "${BLUE}Next steps:${NC}"
	echo -e "1. Run ${YELLOW}npx tsc --noEmit${NC} to check for remaining errors"
	echo -e "2. To fix specific files, use ${YELLOW}./fix-ts-errors.sh --fix-file path/to/file.ts${NC}"
	echo -e "3. To run in dry-run mode (preview only), use ${YELLOW}./fix-ts-errors.sh --dry-run${NC}"
else
	echo -e "${RED}TypeScript error fixer encountered problems.${NC}"
	echo -e "Try running with ${YELLOW}--verbose${NC} for more details."
fi
