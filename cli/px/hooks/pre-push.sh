#!/bin/sh
# pre-push hook — triggers advisor-agent review
# Called by git via core.hooksPath. All errors fail-open (stderr warning, exit 0).
# Actual logic lives in `px hook pre-push` — this script is a thin passthrough.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/../dist/index.js" hook pre-push
