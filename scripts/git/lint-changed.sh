#!/usr/bin/env bash
# =============================================================================
# lint-changed.sh
# Runs linting and formatting on all changed files (staged + unstaged) across
# all 4 repos in the Pixelated workspace.
#
# Covers:
#   • TypeScript/JavaScript: oxlint + prettier
#   • Python: ruff (lint + format)
#
# Usage:
#   ./scripts/git/lint-changed.sh [--fix] [--check-only] [--repo <name>]
#   --fix         Auto-fix issues where possible (default: true)
#   --check-only  Only report, don't write any fixes
#   --repo        Limit to one repo: ai | docs | foresight-mcp | main
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
BOLD=$'\e[1m'; RESET=$'\e[0m'
GREEN=$'\e[32m'; YELLOW=$'\e[33m'; CYAN=$'\e[36m'; RED=$'\e[31m'; MAGENTA=$'\e[35m'

info()    { echo "${CYAN}${BOLD}ℹ  $*${RESET}"; }
success() { echo "${GREEN}${BOLD}✔  $*${RESET}"; }
warn()    { echo "${YELLOW}${BOLD}⚠  $*${RESET}"; }
error()   { echo "${RED}${BOLD}✖  $*${RESET}" >&2; }
section() { echo ""; echo "${MAGENTA}${BOLD}━━━  $*  ━━━${RESET}"; echo ""; }

# ── Argument parsing ──────────────────────────────────────────────────────────
FIX=true
TARGET_REPO=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --fix)         FIX=true; shift ;;
    --check-only)  FIX=false; shift ;;
    --repo)        TARGET_REPO="$2"; shift 2 ;;
    *) warn "Unknown arg: $1"; shift ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "/home/vivi/pixelated")"

ERRORS=0

# ── Helper: collect changed files in a repo ───────────────────────────────────
get_changed_files() {
  local repo="$1"
  local exts="${2:-}"  # optional extension filter like "ts|tsx|js|jsx"

  cd "$repo"

  # Staged + unstaged modified + untracked
  local files
  files=$(
    {
      git diff --name-only HEAD 2>/dev/null || true
      git diff --name-only 2>/dev/null || true
      git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u | grep -v '^$' | grep -v "^scratch/" | grep -v "^aws/" || true
  )

  if [[ -n "$exts" ]]; then
    files=$(echo "$files" | grep -E "\.(${exts})$" || true)
  fi

  # Return only files that actually exist
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ -f "${repo}/${f}" ]] && echo "$f"
  done <<< "$files"
  true
}

# ── TypeScript / JavaScript linting ──────────────────────────────────────────
lint_ts_files() {
  local repo="$1"
  local repo_name="$2"

  cd "$repo"

  # Collect TS/JS changed files
  local ts_files
  ts_files=$(get_changed_files "$repo" "ts|tsx|js|jsx|mts|cts|mjs|cjs")

  if [[ -z "$ts_files" ]]; then
    info "  No TS/JS changed files in ${repo_name}"
    return 0
  fi

  local count
  count=$(echo "$ts_files" | wc -l)
  info "  Linting ${count} TS/JS file(s) in ${repo_name}..."

  # Build file list as array
  local file_arr=()
  while IFS= read -r f; do
    [[ -n "$f" ]] && file_arr+=("$f")
  done <<< "$ts_files"

  # oxlint
  if command -v oxlint &>/dev/null || [[ -f "${repo}/node_modules/.bin/oxlint" ]]; then
    local oxlint_cmd="oxlint"
    [[ -f "${repo}/node_modules/.bin/oxlint" ]] && oxlint_cmd="${repo}/node_modules/.bin/oxlint"
  if command -v oxlint &>/dev/null || [[ -f "${repo}/node_modules/.bin/oxlint" ]] || command -v pnpm &>/dev/null; then
    local oxlint_cmd="oxlint"
    if command -v pnpm &>/dev/null; then
      oxlint_cmd="pnpm exec oxlint"
    elif [[ -f "${repo}/node_modules/.bin/oxlint" ]]; then
      oxlint_cmd="${repo}/node_modules/.bin/oxlint"
    fi

    info "    Running oxlint..."
    if [[ "$FIX" == "true" ]]; then
      $oxlint_cmd --fix "${file_arr[@]}" 2>&1 || { error "    oxlint reported errors in ${repo_name}"; ERRORS=$((ERRORS+1)); }
    else
      $oxlint_cmd "${file_arr[@]}" 2>&1 || { error "    oxlint reported errors in ${repo_name}"; ERRORS=$((ERRORS+1)); }
    fi
  else
    # Fall back to pnpm lint (repo-root only)
    if [[ "$repo" == "$ROOT" ]] && [[ -f "${repo}/package.json" ]]; then
      info "    Running pnpm lint (oxlint not found in PATH)..."
      if [[ "$FIX" == "true" ]]; then
        (cd "$repo" && pnpm lint:fix 2>&1) || { warn "    pnpm lint:fix had warnings"; }
      else
        (cd "$repo" && pnpm lint 2>&1) || { error "    pnpm lint reported errors"; ERRORS=$((ERRORS+1)); }
      fi
    fi
  fi

  # prettier
  if command -v prettier &>/dev/null || [[ -f "${repo}/node_modules/.bin/prettier" ]]; then
    local prettier_cmd="prettier"
    [[ -f "${repo}/node_modules/.bin/prettier" ]] && prettier_cmd="${repo}/node_modules/.bin/prettier"

    info "    Running prettier..."
    if [[ "$FIX" == "true" ]]; then
      $prettier_cmd --write "${file_arr[@]}" 2>&1 || warn "    prettier encountered issues"
    else
      $prettier_cmd --check "${file_arr[@]}" 2>&1 || { error "    prettier found formatting issues"; ERRORS=$((ERRORS+1)); }
    fi
  fi
}

# ── Python linting ────────────────────────────────────────────────────────────
lint_py_files() {
  local repo="$1"
  local repo_name="$2"

  cd "$repo"

  local py_files
  py_files=$(get_changed_files "$repo" "py")

  if [[ -z "$py_files" ]]; then
    info "  No Python changed files in ${repo_name}"
    return 0
  fi

  local count
  count=$(echo "$py_files" | wc -l)
  info "  Linting ${count} Python file(s) in ${repo_name}..."

  local file_arr=()
  while IFS= read -r f; do
    [[ -n "$f" ]] && file_arr+=("$f")
  done <<< "$py_files"

  # ruff via uv (preferred per AGENTS.md)
  if command -v uv &>/dev/null; then
    info "    Running ruff check (via uv)..."
    if [[ "$FIX" == "true" ]]; then
      uv run ruff check --fix "${file_arr[@]}" 2>&1 || { error "    ruff check errors in ${repo_name}"; ERRORS=$((ERRORS+1)); }
      uv run ruff format "${file_arr[@]}" 2>&1 || warn "    ruff format had warnings"
    else
      uv run ruff check "${file_arr[@]}" 2>&1 || { error "    ruff check errors in ${repo_name}"; ERRORS=$((ERRORS+1)); }
      uv run ruff format --check "${file_arr[@]}" 2>&1 || { error "    ruff format issues in ${repo_name}"; ERRORS=$((ERRORS+1)); }
    fi
  elif command -v ruff &>/dev/null; then
    info "    Running ruff check..."
    if [[ "$FIX" == "true" ]]; then
      ruff check --fix "${file_arr[@]}" 2>&1 || { error "    ruff errors in ${repo_name}"; ERRORS=$((ERRORS+1)); }
      ruff format "${file_arr[@]}" 2>&1 || warn "    ruff format had warnings"
    else
      ruff check "${file_arr[@]}" 2>&1 || { error "    ruff errors in ${repo_name}"; ERRORS=$((ERRORS+1)); }
      ruff format --check "${file_arr[@]}" 2>&1 || { error "    ruff format issues"; ERRORS=$((ERRORS+1)); }
    fi
  else
    warn "  ruff not available — skipping Python linting for ${repo_name}"
  fi
}

# ── Process one repo ──────────────────────────────────────────────────────────
process_repo() {
  local repo_path="$1"
  local repo_name="$2"

  section "Lint: ${repo_name}"

  lint_ts_files "$repo_path" "$repo_name"
  lint_py_files "$repo_path" "$repo_name"

  success "${repo_name} lint complete"
}

# ── Main ──────────────────────────────────────────────────────────────────────
section "Pixelated Lint & Format — Changed Files"
[[ "$FIX" == "false" ]] && warn "CHECK-ONLY mode — no files will be modified"

declare -A REPOS=(
  ["ai"]="${ROOT}/ai"
  ["docs"]="${ROOT}/docs"
  ["foresight-mcp"]="${ROOT}/foresight-mcp"
  ["main"]="${ROOT}"
)

if [[ -n "$TARGET_REPO" ]]; then
  if [[ -z "${REPOS[$TARGET_REPO]+x}" ]]; then
    error "Unknown --repo: '${TARGET_REPO}'. Valid: ai docs foresight-mcp main"
    exit 1
  fi
  process_repo "${REPOS[$TARGET_REPO]}" "$TARGET_REPO"
else
  for repo_name in ai docs foresight-mcp main; do
    process_repo "${REPOS[$repo_name]}" "$repo_name"
  done
fi

section "Summary"
if [[ $ERRORS -eq 0 ]]; then
  success "All checks passed with 0 errors."
else
  error "${ERRORS} lint/format error(s) detected."
  exit 1
fi
