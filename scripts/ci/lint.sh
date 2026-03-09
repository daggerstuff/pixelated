#!/bin/bash

# oxlint: prefer type-aware if supported by your installed version
HELP="$(pnpm exec oxlint --help 2>/dev/null || true)"
if printf '%s' "$HELP" | grep -q -- '--type-aware'; then
  pnpm exec oxlint --type-aware --tsconfig config/tsconfig.json -c .oxlintrc.json "$@"
else
  pnpm exec oxlint -c .oxlintrc.json "$@"
fi
