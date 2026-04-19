#!/bin/bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AI_DIR="$ROOT_DIR/ai"

echo -e "${GREEN}🔍 Starting Security Scan...${NC}"
echo -e "${BLUE}Root: $ROOT_DIR${NC}"

EXIT_CODE=0

# ──────────────────────────────────────────
# 1. Node.js / pnpm audit
# ──────────────────────────────────────────
echo -e "\n${YELLOW}📦 [1/3] Running pnpm audit...${NC}"
if ! command -v pnpm &>/dev/null; then
    echo -e "${RED}❌ pnpm is not installed.${NC}"
    exit 1
fi
cd "$ROOT_DIR"
AUDIT_RESULTS_FILE="audit-results.json"
if pnpm audit --help 2>/dev/null | grep -q -- "--prod"; then
  pnpm audit --json --prod --audit-level moderate > "$AUDIT_RESULTS_FILE" || true
else
  pnpm audit --json --audit-level moderate > "$AUDIT_RESULTS_FILE" || true
fi

if node scripts/utils/check-pnpm-audit.js "$AUDIT_RESULTS_FILE"; then
  echo -e "${GREEN}✅ No Node.js vulnerabilities found.${NC}"
else
  echo -e "${RED}⚠️  Node.js vulnerabilities detected above.${NC}"
  EXIT_CODE=1
fi

# ──────────────────────────────────────────
# 2. Python audit (ai submodule)
# ──────────────────────────────────────────
echo -e "\n${YELLOW}🐍 [2/3] Running Python pip-audit...${NC}"
if [ -d "$AI_DIR" ] && command -v uv &>/dev/null; then
    cd "$AI_DIR"
    if uv run pip-audit 2>&1; then
        echo -e "${GREEN}✅ No Python vulnerabilities found.${NC}"
    else
        echo -e "${RED}⚠️  Python vulnerabilities detected above.${NC}"
        EXIT_CODE=1
    fi
    cd "$ROOT_DIR"
else
    echo -e "${YELLOW}⚠️  ai/ dir or uv not found — skipping Python audit.${NC}"
fi

# ──────────────────────────────────────────
# 3. Hardcoded secrets grep
# Scans: .ts .tsx .js .mjs .cjs .py files only
# Excludes:
#   - GitHub Actions ${{ secrets.X }} references (safe — CI managed)
#   - CI test env var values (pattern: *test-* or *testing*)
#   - process.env / os.environ references (safe — runtime injected)
#   - config/settings files
#   - lock files / generated files
# ──────────────────────────────────────────
echo -e "\n${YELLOW}🕵️  [3/3] Scanning source files for hardcoded secrets...${NC}"
cd "$ROOT_DIR"

GREP_RESULTS=$(grep -rEn \
    "(API_KEY|SECRET_KEY|ACCESS_KEY|ACCESS_TOKEN|PASSWORD|PRIVATE_KEY|AUTH_TOKEN)\s*[=:]\s*['\"][a-zA-Z0-9+/=_\-]{16,}['\"]" \
    . \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.mjs" \
    --include="*.cjs" \
    --include="*.py" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.git \
    --exclude-dir=coverage \
    --exclude-dir=__pycache__ \
    --exclude-dir=.venv \
    | grep -v "process\.env" \
    | grep -v "os\.environ" \
    | grep -v "os\.getenv" \
    | grep -v "\${{" \
    | grep -vE "(test|TEST|testing|TESTING|example|placeholder|your[-_]|dummy|fake|mock)" \
    | grep -vE "^\s*(//|#|\*)" \
    | head -n 20 || true)

if [ -n "$GREP_RESULTS" ]; then
    echo -e "${RED}🚨 Potential hardcoded secrets found — verify manually:${NC}"
    echo "$GREP_RESULTS"
    EXIT_CODE=1
else
    echo -e "${GREEN}✅ No hardcoded secrets detected in source files.${NC}"
fi

# ──────────────────────────────────────────
# Summary
# ──────────────────────────────────────────
echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed.${NC}"
else
    echo -e "${RED}❌ Security scan completed with issues. Review above output.${NC}"
fi

exit "$EXIT_CODE"
