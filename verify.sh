#!/bin/bash
# verify.sh — Pixelated Empathy verification gate
#
# This is the lynchpin of the multi-agent pipeline.
# Every implementer invocation must end with this script.
#
# Rules:
#   - Do NOT modify this file to make failing checks pass.
#   - Do NOT remove any check from this script.
#   - If a check hangs, fix the test — do not remove the check.
#
# Known gotcha (see AGENTS.md):
#   The full vitest suite hangs due to at least one test consuming 100% CPU.
#   Use VITEST_TARGET_TESTS to run a targeted subset relevant to the changed files.
#   Set VITEST_TARGET_TESTS="" to skip tests entirely (only for typecheck/lint-only runs).

set -euo pipefail

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

echo ""
echo "🔍 Pixelated Empathy — Verification Gate"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FAIL=0

# ─── 1. TypeScript type check ───────────────────────────────────────────────
echo ""
echo "▸ TypeScript (pnpm typecheck)..."
if pnpm typecheck 2>&1; then
  pass "typecheck passed"
else
  fail "typecheck FAILED"
  FAIL=1
fi

# ─── 2. Lint ─────────────────────────────────────────────────────────────────
echo ""
echo "▸ Lint (pnpm lint)..."
if pnpm lint 2>&1; then
  pass "lint passed"
else
  fail "lint FAILED"
  FAIL=1
fi

# ─── 3. Python checks (if Python files were changed) ─────────────────────────
# Only runs if PYTHON_CHANGED=1 is set, or if any .py file was git-staged.
PYTHON_CHANGED="${PYTHON_CHANGED:-}"
if [ -z "$PYTHON_CHANGED" ]; then
  if git diff --cached --name-only 2>/dev/null | grep -q '\.py$'; then
    PYTHON_CHANGED=1
  elif git diff HEAD --name-only 2>/dev/null | grep -q '\.py$'; then
    PYTHON_CHANGED=1
  fi
fi

if [ "${PYTHON_CHANGED:-0}" = "1" ]; then
  echo ""
  echo "▸ Python type check (uv run pyright)..."
  if uv run pyright 2>&1; then
    pass "pyright passed"
  else
    fail "pyright FAILED"
    FAIL=1
  fi

  echo ""
  echo "▸ Python lint (uv run ruff check)..."
  if uv run ruff check src/ ai-services/ tests/ 2>&1; then
    pass "ruff passed"
  else
    fail "ruff FAILED"
    FAIL=1
  fi
fi

# ─── 4. Targeted tests ───────────────────────────────────────────────────────
# VITEST_TARGET_TESTS: space-separated list of test file patterns to run.
# Set by the implementer based on what files were changed.
# Example: VITEST_TARGET_TESTS="memory auth" bash verify.sh
# Set to empty string "" to skip tests (typecheck+lint only).
#
# IMPORTANT: Do NOT run the full suite — it hangs. See AGENTS.md.

VITEST_TARGET="${VITEST_TARGET_TESTS:-}"

if [ -z "$VITEST_TARGET" ]; then
  echo ""
  warn "VITEST_TARGET_TESTS not set — skipping test run."
  warn "Set VITEST_TARGET_TESTS='<pattern>' to run relevant tests."
  warn "Example: VITEST_TARGET_TESTS='memory' bash verify.sh"
else
  echo ""
  echo "▸ Vitest (targeted: ${VITEST_TARGET})..."
  # Build --reporter args from space-separated patterns
  TEST_ARGS=""
  for pattern in $VITEST_TARGET; do
    TEST_ARGS="$TEST_ARGS $pattern"
  done

  # Override Redis to local if running locally (see AGENTS.md)
  REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}" \
  UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-redis://localhost:6379/0}" \
  pnpm vitest run -c config/vitest.config.ts $TEST_ARGS 2>&1

  if [ $? -eq 0 ]; then
    pass "targeted tests passed"
  else
    fail "tests FAILED"
    FAIL=1
  fi
fi

# ─── 5. Python tests (if PYTHON_CHANGED) ─────────────────────────────────────
if [ "${PYTHON_CHANGED:-0}" = "1" ]; then
  PYTEST_TARGET="${PYTEST_TARGET_TESTS:-tests/}"
  echo ""
  echo "▸ pytest (${PYTEST_TARGET})..."
  if uv run pytest "$PYTEST_TARGET" -q 2>&1; then
    pass "pytest passed"
  else
    fail "pytest FAILED"
    FAIL=1
  fi
fi

# ─── Result ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed${NC}"
  exit 0
else
  echo -e "${RED}❌ One or more checks failed${NC}"
  echo "   Fix the issues above. Do NOT weaken tests or suppress errors."
  exit 1
fi
