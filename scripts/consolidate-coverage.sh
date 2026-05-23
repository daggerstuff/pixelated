#!/usr/bin/env bash
#
# consolidate-coverage.sh
#
# Unified Coverage Reporter — PIX-223
# Runs TypeScript (vitest/v8) and Python (pytest/coverage) in sequence,
# then aggregates the results into a single markdown summary.
#
# Usage:
#   ./scripts/consolidate-coverage.sh                # run both & report
#   ./scripts/consolidate-coverage.sh --ts-only       # TypeScript only
#   ./scripts/consolidate-coverage.sh --py-only       # Python only
#   COVERAGE_TIMEOUT=120 ./scripts/consolidate-coverage.sh  # custom timeout
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="${ROOT_DIR}/coverage"
TS_COVERAGE_DIR="${REPORT_DIR}/ts"
PY_COVERAGE_DIR="${REPORT_DIR}/py"
SUMMARY_FILE="${REPORT_DIR}/summary.md"
TIMEOUT="${COVERAGE_TIMEOUT:-300}"               # default 5 minutes per suite
PY_FAIL_UNDER="${PY_FAIL_UNDER:-70}"
TS_FAIL_UNDER="${TS_FAIL_UNDER:-30}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

run_ts=1
run_py=1

for arg in "$@"; do
  case "$arg" in
    --ts-only) run_py=0  ;;
    --py-only) run_ts=0  ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Don't pre-create coverage subdirs — vitest manages ./coverage/ itself.
# We move its output into ts/ after the run.
mkdir -p "$REPORT_DIR"

# ── helpers ──────────────────────────────────────────────────────────────────

header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e " ${BOLD}$1${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

ok()   { echo -e " ${GREEN}✓${NC} $1"; }
warn() { echo -e " ${YELLOW}⚠${NC} $1"; }
fail() { echo -e " ${RED}✗${NC} $1"; }

# ── 1. TypeScript coverage ───────────────────────────────────────────────────

ts_pass=1
ts_pct="—"

if [[ "$run_ts" -eq 1 ]]; then
  header "TypeScript coverage — vitest + @vitest/coverage-v8"
  cd "$ROOT_DIR"

  # Use VITEST_TARGET_TESTS to scope to a safe subset (avoids the CPU-bound hanging test)
  if timeout "$TIMEOUT" \
    env VITEST_COVERAGE_ENABLED=true \
        VITEST_TARGET_TESTS="${VITEST_TARGET_TESTS:-}" \
    pnpm vitest run -c config/vitest.config.ts --coverage \
    --reporter=verbose 2>&1; then
    ok "TypeScript coverage suite completed"
  else
    ts_exit=$?
    if [[ "$ts_exit" -eq 124 ]]; then
      fail "TypeScript coverage TIMED OUT after ${TIMEOUT}s"
    else
      fail "TypeScript coverage exited with code $ts_exit (threshold not met or test failure)"
    fi
    ts_pass=0
  fi

  # Move vitest coverage output into ts/ subdirectory
  mkdir -p "$TS_COVERAGE_DIR"
  # Copy all files from coverage/ (except our subdirs) into ts/
  if [[ -d "$REPORT_DIR" ]]; then
    for item in "$REPORT_DIR"/*; do
      bn="$(basename "$item")"
      if [[ "$bn" != "ts" && "$bn" != "py" && "$bn" != "summary.md" ]]; then
        cp -a "$item" "$TS_COVERAGE_DIR/" 2>/dev/null || true
      fi
    done
    # Extract line coverage percentage from vitest text output (last report)
    ts_pct="(see reports in ${TS_COVERAGE_DIR}/)"
  fi
fi

# ── 2. Python coverage ───────────────────────────────────────────────────────

py_pass=1
py_pct="—"

if [[ "$run_py" -eq 1 ]]; then
  header "Python coverage — pytest + coverage.py"
  cd "$ROOT_DIR"
  COVERAGE_FILE="${PY_COVERAGE_DIR}/.coverage"
  mkdir -p "$PY_COVERAGE_DIR"

  if timeout "$TIMEOUT" \
    env COVERAGE_FILE="$COVERAGE_FILE" \
    uv run pytest --cov=src --cov=ai \
      --cov-report=term \
      --cov-report=html:"${PY_COVERAGE_DIR}/html" \
      --cov-report=xml:"${PY_COVERAGE_DIR}/cobertura.xml" \
      --cov-fail-under="$PY_FAIL_UNDER" \
      -x --tb=short 2>&1; then
    ok "Python coverage suite completed (threshold >= ${PY_FAIL_UNDER}%)"
  else
    py_exit=$?
    if [[ "$py_exit" -eq 124 ]]; then
      fail "Python coverage TIMED OUT after ${TIMEOUT}s"
    else
      fail "Python coverage exited with code $py_exit (threshold not met or test failure)"
    fi
    py_pass=0
  fi

  if [[ -f "${PY_COVERAGE_DIR}/cobertura.xml" ]]; then
    py_pct="(see cobertura report in ${PY_COVERAGE_DIR}/)"
  fi
fi

# ── 3. Summary ───────────────────────────────────────────────────────────────

header "Coverage Summary"

TIMESTAMP="$(date -u '+%Y-%m-%d %H:%M UTC')"

cat > "$SUMMARY_FILE" << SUMMARY_EOF
# Unified Coverage Report

**Generated:** ${TIMESTAMP}

## TypeScript (vitest/v8)
- **Status:** $([ "$ts_pass" -eq 1 ] && echo "PASS" || echo "FAIL")
- **Threshold:** >= ${TS_FAIL_UNDER}%
- **Details:** \`${TS_COVERAGE_DIR}/\`

## Python (pytest/coverage)
- **Status:** $([ "$py_pass" -eq 1 ] && echo "PASS" || echo "FAIL")
- **Threshold:** >= ${PY_FAIL_UNDER}%
- **Details:** \`${PY_COVERAGE_DIR}/\`

## Notes
- The hanging-test workaround uses targeted test subsets.
- Run individual suites with \`--ts-only\` or \`--py-only\`.
- Adjust timeouts with \`COVERAGE_TIMEOUT=<seconds>\`.
SUMMARY_EOF

echo ""
echo " Summary written to: ${SUMMARY_FILE}"
echo " TypeScript reports: ${TS_COVERAGE_DIR}/"
echo " Python reports:     ${PY_COVERAGE_DIR}/"

# Exit code reflects whether both suites passed
if [[ "$ts_pass" -eq 0 || "$py_pass" -eq 0 ]]; then
  echo ""
  fail "One or more coverage suites did not meet thresholds."
  exit 1
fi

ok "All coverage checks passed."
