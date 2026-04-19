#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm &>/dev/null; then
  echo "pnpm is not installed."
  exit 1
fi

AUDIT_RESULTS_FILE="audit-results.json"
if pnpm audit --help 2>/dev/null | grep -q -- "--prod"; then
  pnpm audit --json --prod --audit-level moderate > "$AUDIT_RESULTS_FILE" || true
else
  pnpm audit --json --audit-level moderate > "$AUDIT_RESULTS_FILE" || true
fi
node scripts/utils/check-pnpm-audit.js "$AUDIT_RESULTS_FILE"
