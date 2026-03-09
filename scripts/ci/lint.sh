#!/bin/bash
set -e

# oxlint: prefer type-aware if supported by your installed version
HELP="$(pnpm exec oxlint --help 2>/dev/null || true)"
CONFIG_FILE=".oxlintrc.json"

if printf '%s' "$HELP" | grep -q -- '--type-aware'; then
  echo "Running type-aware oxlint..."
  pnpm exec oxlint --type-aware --tsconfig config/tsconfig.json -c "$CONFIG_FILE" "$@"
else
  echo "Running standard oxlint..."
  pnpm exec oxlint -c "$CONFIG_FILE" "$@"
fi
