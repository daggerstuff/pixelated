#!/bin/bash
# get-changed-frontend-files.sh
# Returns list of changed frontend files (Vercel-relevant) since a base ref.
# Used by Vercel workflow path filtering and other frontend-specific gates.
#
# Usage: ./scripts/ci/get-changed-frontend-files.sh <base_ref> <output_file>
set -euo pipefail

BASE_REF="${1:?Usage: $0 <base_ref> <output_file>}"
OUTPUT_FILE="${2:?Usage: $0 <base_ref> <output_file>}"
# staging is the main branch — use it as the default base ref if not provided
BASE_REF="${BASE_REF:-staging}"

FRONTEND_PATTERNS=(
  "apps/web/src/**"
  "apps/web/public/**"
  "apps/web/astro.config.*"
  "apps/web/tailwind.config.*"
  "packages/ui/**"
  "packages/components/**"
  "vercel.json"
  ".vercelignore"
)

# Build the --paths argument for git diff
PATHS=""
for pattern in "${FRONTEND_PATTERNS[@]}"; do
  if [ -n "$PATHS" ]; then
    PATHS="$PATHS --"
  fi
  PATHS="$PATHS $pattern"
done

# Get changed files between base ref and HEAD
git diff --name-only "$BASE_REF" HEAD -- ${FRONTEND_PATTERNS[@]} > "$OUTPUT_FILE" 2>/dev/null || echo "" > "$OUTPUT_FILE"

if [ ! -s "$OUTPUT_FILE" ]; then
  echo "No frontend files changed since $BASE_REF"
  exit 1
fi

echo "Changed frontend files:"
cat "$OUTPUT_FILE"
