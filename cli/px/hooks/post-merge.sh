#!/bin/sh
# post-merge hook — triggers pipeline-agent check_pipeline_health
# Called by git via core.hooksPath. All errors fail-open (stderr warning, exit 0).
# Actual logic lives in `px hook post-merge` — this script is a thin passthrough.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/../dist/index.mjs" hook post-merge
