#!/usr/bin/env bash
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
