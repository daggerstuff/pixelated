#!/bin/sh
# pr-merge hook — triggers qa-agent score_session for merged PRs
# Called by CI/CD or manual workflow. All errors fail-open (stderr warning, exit 0).
# Passes PR URL via --pr flag from GITHUB_PR_URL env or first argument.
# Actual logic lives in `px hook pr-merge` — this script is a thin passthrough.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/../dist/index.mjs" hook pr-merge "$@"
