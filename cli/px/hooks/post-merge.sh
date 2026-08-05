#!/bin/sh
# post-merge hook — triggers pipeline-agent check_pipeline_health
# Called by git via core.hooksPath. All errors fail-open (stderr warning, exit 0).
# Actual logic lives in `px hook post-merge` — this script is a thin passthrough.

exec px hook post-merge
