#!/bin/sh
# pr-open hook — triggers advisor-agent review for new pull requests
# Called by CI/CD or manual workflow. All errors fail-open (stderr warning, exit 0).
# Passes PR URL via --pr flag from GITHUB_PR_URL env or first argument.
# Actual logic lives in `px hook pr-open` — this script is a thin passthrough.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/../dist/index.mjs" hook pr-open "$@"
