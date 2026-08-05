#!/bin/sh
# pre-commit hook — triggers content-agent audit_clinical_corpus
# Called by git via core.hooksPath. All errors fail-open (stderr warning, exit 0).
# Actual logic lives in `px hook pre-commit` — this script is a thin passthrough.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/../dist/index.js" hook pre-commit
