#!/usr/bin/env bash
# Local regression suite for assistant skills, routing definitions, and
# system configuration integrity.
#
# Usage:
#   bash scripts/regression-suite.sh          # run directly
#   make regression-suite                     # via Makefile
#   copy/symlink to .git/hooks/pre-push       # as a push gate
set -eo pipefail

cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"

echo "==> Running Local Linters..."
"$PY" -m json.tool settings.json > /dev/null
"$PY" -c "import tomllib; tomllib.load(open('config.toml', 'rb'))"

echo "==> Executing Regression Suite..."
"$PY" -m pytest \
  tests/test_config_lint.py \
  tests/test_skill_routing.py \
  tests/test_system_prompt_regression.py \
  -v --tb=short

echo "==> All regression suites passed."
