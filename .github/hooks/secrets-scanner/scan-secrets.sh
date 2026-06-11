#!/usr/bin/env bash
# .github/hooks/secrets-scanner/scan-secrets.sh
#
# Content-level secrets scanner used by .git/hooks/pre-commit.
#
# Contract (set by the caller):
#   SCAN_MODE=block|warn    default: block  — exit 1 on findings (block) or 0 (warn)
#   SCAN_SCOPE=staged|all   default: staged — only staged changes, or the whole tree
#   SECRETS_ALLOWLIST=...   comma-separated literal substrings to suppress
#                           (a finding line containing any entry is skipped)
#
# Returns 0 on clean (or on findings in warn mode), 1 on findings in block mode,
# 2 on invalid config.

set -euo pipefail

SCAN_MODE="${SCAN_MODE:-block}"
SCAN_SCOPE="${SCAN_SCOPE:-staged}"
ALLOWLIST="${SECRETS_ALLOWLIST:-}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"
cd "$REPO_ROOT"

# Colors (only when stdout is a TTY)
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; NC=''
fi

# ---- Pattern catalog ----
# Format: "Label|Extended regex" (extended regex, case-sensitive unless (?i) used)
PATTERNS=(
  "AWS Access Key|AKIA[0-9A-Z]{16}"
  "GitHub PAT|ghp_[A-Za-z0-9]{36}"
  "GitHub OAuth|gho_[A-Za-z0-9]{36}"
  "GitHub App token|(ghs_|ghr_)[A-Za-z0-9]{36}"
  "GitHub fine-grained PAT|github_pat_[A-Za-z0-9_]{82}"
  "Slack token|xox[baprs]-[0-9a-zA-Z]{10,48}"
  "Stripe live key|sk_live_[0-9a-zA-Z]{24,}"
  "Stripe test key|sk_test_[0-9a-zA-Z]{24,}"
  "Google API key|AIza[0-9A-Za-z_-]{35}"
  "OpenAI API key|sk-[A-Za-z0-9]{40,}"
  "Anthropic API key|sk-ant-[A-Za-z0-9_-]{40,}"
  "Linear API key|lin_api_[A-Za-z0-9]{40}"
  "Private key header|-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
  "Generic high-entropy password|(?i)(password|passwd|pwd)\s*[:=]\s*['\"][^'\"\\s]{8,}['\"]"
  "Generic high-entropy secret|(?i)(secret|api[_-]?key|auth[_-]?token)\s*[:=]\s*['\"][^'\"\\s]{16,}['\"]"
  "Bearer token header|(?i)Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}"
)

# ---- File selection ----
case "$SCAN_SCOPE" in
  staged)
    mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
    ;;
  all)
    mapfile -t FILES < <(git ls-files 2>/dev/null || true)
    ;;
  *)
    echo -e "${RED}❌ Unknown SCAN_SCOPE: $SCAN_SCOPE (expected: staged|all)${NC}" >&2
    exit 2
    ;;
esac

# Filter to existing, regular files (skip deleted, symlinks, etc.)
TEXT_FILES=()
for f in "${FILES[@]}"; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue
  TEXT_FILES+=("$f")
done

if [ ${#TEXT_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ No files to scan (scope=$SCAN_SCOPE).${NC}"
  exit 0
fi

# ---- Allowlist preprocessing ----
# Split the comma-separated allowlist once into a bash array.
ALLOW_ENTRIES=()
if [ -n "$ALLOWLIST" ]; then
  IFS=',' read -r -a _raw <<< "$ALLOWLIST"
  for entry in "${_raw[@]}"; do
    # Trim leading/trailing whitespace
    entry="${entry#"${entry%%[![:space:]]*}"}"
    entry="${entry%"${entry##*[![:space:]]}"}"
    [ -z "$entry" ] && continue
    ALLOW_ENTRIES+=("$entry")
  done
fi

is_allowlisted() {
  local line="$1"
  local entry
  for entry in "${ALLOW_ENTRIES[@]:-}"; do
    [ -z "$entry" ] && continue
    case "$line" in
      *"$entry"*) return 0 ;;
    esac
  done
  return 1
}

# ---- Scan ----
FINDINGS=()

for entry in "${PATTERNS[@]}"; do
  label="${entry%%|*}"
  pattern="${entry#*|}"
  # -I: skip binary files, -n: line numbers, -E: extended regex, -H: filename
  # --color=never: keep output greppable (we format ourselves)
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    # grep -n output is "file:lineno:content"; extract robustly by splitting on first two colons
    file="${hit%%:*}"
    rest="${hit#*:}"
    lineno="${rest%%:*}"
    matched="${rest#*:}"
    if is_allowlisted "$hit" || is_allowlisted "$matched"; then
      continue
    fi
    FINDINGS+=("$file:$lineno: [$label] $matched")
  done < <(grep -InHE --color=never "$pattern" "${TEXT_FILES[@]}" 2>/dev/null || true)
done

# ---- Report ----
if [ ${#FINDINGS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ No secrets found in ${#TEXT_FILES[@]} file(s) (scope=$SCAN_SCOPE).${NC}"
  exit 0
fi

echo -e "${RED}❌ Found ${#FINDINGS[@]} potential secret(s) in staged content:${NC}"
for f in "${FINDINGS[@]}"; do
  echo -e "  ${YELLOW}$f${NC}"
done

case "$SCAN_MODE" in
  block)
    echo -e "${RED}Commit blocked. Remove the secrets above or update SECRETS_ALLOWLIST.${NC}"
    exit 1
    ;;
  warn)
    echo -e "${YELLOW}⚠️  Warning only (SCAN_MODE=warn). Proceeding.${NC}"
    exit 0
    ;;
  *)
    # Unknown mode: fail closed
    exit 1
    ;;
esac
