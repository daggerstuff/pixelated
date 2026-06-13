#!/bin/bash
# Wrapper for oxlint in lint-staged context.
#
# oxlint exits 1 for both "lint errors found" and "no files to lint" (when
# all passed files match --ignore-pattern).  In a pre-commit hook we only want
# to reject the commit on real errors, not when all staged files happen to be
# in an intentionally-ignored directory (e.g. tests/pending-implementation/).
#
# Strategy: capture output + exit code; if code is 1 but the word "error"
# never appears in the output, treat it as success (exit 0).

output=$(pnpm exec oxlint "$@" 2>&1)
exit_code=$?

if [ $exit_code -eq 1 ]; then
  # "No files found to lint" / all-ignored cases produce no "error" lines.
  if echo "$output" | grep -q "error "; then
    # Real lint errors — report them and fail.
    echo "$output"
    exit 1
  else
    # No real errors (all ignored or zero diagnostics) — pass.
    echo "$output"
    exit 0
  fi
fi

echo "$output"
exit $exit_code
