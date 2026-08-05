#!/bin/sh
# pre-push hook — triggers advisor-agent review
# Called by git via core.hooksPath. All errors fail-open (stderr warning, exit 0).
# Actual logic lives in `px hook pre-push` — this script is a thin passthrough.

exec px hook pre-push
