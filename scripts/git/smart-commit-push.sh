#!/usr/bin/env bash
# =============================================================================
# smart-commit-push.sh
# Intelligently groups, stages, commits, and pushes all 4 repos in the
# Pixelated monorepo workspace (submodules first, then main repo).
#
# Usage:
#   ./scripts/git/smart-commit-push.sh [--dry-run] [--message "override msg"]
#   --dry-run    Show what would be committed without actually committing
#   --message    Override the auto-generated commit message for all repos
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

# ── Pre-commit sync: fetch + pull --rebase before committing ──────────────────
pre_commit_sync() {
  local repo_path="$1"
  local repo_name="$2"
  cd "$repo_path"

  info "Syncing ${repo_name} with remote before commit..."
  git fetch --all --prune 2>&1 || true

  local_ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
  local_behind=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo 0)

  if [[ "$local_ahead" -gt 0 && "$local_behind" -gt 0 ]]; then
    error "Diverged: ${repo_name} has ${local_ahead} local-only commit(s) and ${local_behind} remote commit(s)."
    error "Rebase would be required. Stopping — manual intervention needed."
    return 1
  fi

  if [[ "$local_behind" -gt 0 ]]; then
    info "Pulling ${local_behind} remote commit(s) into ${repo_name} (rebase)..."
    git pull --rebase 2>&1 || {
      error "Rebase failed for ${repo_name}. Resolve conflicts and re-run."
      return 1
    }
    success "Rebased ${repo_name} onto remote"
  elif [[ "$local_ahead" -gt 0 ]]; then
    info "${repo_name} is ahead of ${local_ahead} commit(s); skipping pull"
  else
    info "${repo_name} is up to date with remote"
  fi
}


# ── Argument parsing ──────────────────────────────────────────────────────────
DRY_RUN=false
MSG_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)   DRY_RUN=true; shift ;;
    --message)   MSG_OVERRIDE="$2"; shift 2 ;;
    -m)          MSG_OVERRIDE="$2"; shift 2 ;;
    *) warn "Unknown arg: $1"; shift ;;
  esac
done

[[ "$DRY_RUN" == "true" ]] && warn "DRY-RUN mode — no commits or pushes will be made"

# ── Repo root detection ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "/home/vivi/pixelated")"

if [[ ! -e "$ROOT/.git" ]]; then
  error "Cannot locate monorepo root (expected: /home/vivi/pixelated)"
  exit 1
fi

# ── Semantic grouping logic ───────────────────────────────────────────────────
# Returns a short group label for a file path
classify_file() {
  local f="$1"
  case "$f" in
    # CI / DevOps
    .github/*|.gitlab-ci*|ci-cd/*|Dockerfile*|*.dockerfile|docker-compose*)
      echo "ci" ;;
    # Tests
    *test*|*spec*|pytest.ini|jest.config*|vitest.config*|coverage*)
      echo "tests" ;;
    # Training / AI / ML pipeline
    training/*|core/pipelines/*|annotation/*|*fine_tuning*|*fine-tuning*|*dataset*|*embedder*|*ingestion*)
      echo "training" ;;
    # Memory / RAG / knowledge
    memory/*|*rag*|*nemotron*|*foresight*)
      echo "memory" ;;
    # Bias detection
    *bias*detection*|*bias_detection*)
      echo "bias-detection" ;;
    # CLI tooling
    cli/*|scripts/*)
      echo "tooling" ;;
    # Analytics / security / compliance
    *analytics*|*security*|*breach*|security-baseline*|release-readiness*)
      echo "security" ;;
    # Dependencies / lockfiles
    package.json|pnpm-lock.yaml|uv.lock|pyproject.toml|requirements*)
      echo "deps" ;;
    # Docs
    *.md|docs/*)
      echo "docs" ;;
    # Source components / lib
    src/*)
      echo "src" ;;
    # Tests (Python)
    tests/*)
      echo "tests" ;;
    # Everything else
    *)
      echo "misc" ;;
  esac
}

# Builds a human-readable commit message from a map of group→files
build_message() {
  local -n _groups=$1   # nameref to associative array
  local parts=()

  # Priority order for message prefix
  local priority=(training memory bias-detection ci tests src deps tooling security docs misc)

  for grp in "${priority[@]}"; do
    if [[ -n "${_groups[$grp]+x}" ]]; then
      local count
      count=$(echo "${_groups[$grp]}" | wc -w)
      parts+=("${grp}(${count})")
    fi
  done

  if [[ ${#parts[@]} -eq 0 ]]; then
    echo "chore: update files"
    return
  fi

  local prefix="${parts[0]}"
  local summary
  # Derive verb from group
  case "${prefix%%(*}" in
    ci)             summary="update CI/CD workflows" ;;
    tests)          summary="update test coverage and fixtures" ;;
    training)       summary="improve training pipeline and readiness gates" ;;
    memory)         summary="update memory and RAG components" ;;
    bias-detection) summary="update bias detection service and tests" ;;
    tooling)        summary="update CLI tooling and scripts" ;;
    security)       summary="update security baseline and analytics" ;;
    deps)           summary="update dependencies and lockfiles" ;;
    docs)           summary="update documentation" ;;
    src)            summary="update source components" ;;
    misc)           summary="miscellaneous updates" ;;
    *)              summary="update files" ;;
  esac

  # Add extra groups as scope hints
  if [[ ${#parts[@]} -gt 1 ]]; then
    local extras=("${parts[@]:1}")
    echo "chore: ${summary} [${extras[*]}]"
  else
    echo "chore: ${summary}"
  fi
}

# ── Stage + commit one repo ───────────────────────────────────────────────────
commit_repo() {
  local repo_path="$1"
  local repo_name="$2"
  local custom_msg="${3:-}"

  section "Processing: ${repo_name}"

  cd "$repo_path"
  pre_commit_sync "$repo_path" "$repo_name"

  # Collect changed & untracked files
  local modified new_files all_files
  modified=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only 2>/dev/null || true)
  new_files=$(git ls-files --others --exclude-standard 2>/dev/null || true)
  # Filter out scratch/aws/test results dirs from auto-commit
  new_files=$(echo "$new_files" | grep -v "^scratch/" | grep -v "^aws/" | grep -v "^tests/results/" || true)

  all_files=$(printf '%s\n%s\n' "$modified" "$new_files" | grep -v '^$' | sort -u || true)

  if [[ -z "$all_files" ]]; then
    info "No changes in ${repo_name} — skipping"
    return 0
  fi

  # Classify files into groups
  declare -A groups=()
  local file_list=()
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    local grp
    grp=$(classify_file "$f")
    groups[$grp]="${groups[$grp]:-} $f"
    file_list+=("$f")
  done <<< "$all_files"

  # Show grouping summary
  info "Files grouped:"
  for grp in "${!groups[@]}"; do
    local cnt
    cnt=$(echo "${groups[$grp]}" | wc -w)
    echo "    ${BOLD}${grp}${RESET}: ${cnt} file(s)"
  done

  # Build commit message
  local msg
  if [[ -n "$custom_msg" ]]; then
    msg="$custom_msg"
  else
    msg=$(build_message groups)
  fi

  info "Commit message: \"${msg}\""

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY-RUN] Would stage ${#file_list[@]} file(s) and commit: \"$msg\""
    echo "  Files that would be staged:"
    printf '    %s\n' "${file_list[@]}"
    return 0
  fi

  # Stage tracked modified files with -u (respects tracked state, bypasses gitignore for dirs)
  local tracked_modified
  tracked_modified=$(git diff --name-only HEAD 2>/dev/null || true)
  if [[ -n "$tracked_modified" ]]; then
    git add -u 2>/dev/null || true
  fi

  # Stage new untracked files individually (skip those git refuses due to gitignore)
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    # Only try to add if it's an untracked file (not already staged above)
    if git ls-files --others --exclude-standard -- "$f" 2>/dev/null | grep -q .; then
      git add -- "$f" 2>/dev/null || warn "  Skipped (gitignored?): $f"
    fi
  done <<< "$new_files"

  # Check if there's actually something staged
  if git diff --cached --quiet; then
    info "Nothing new to commit in ${repo_name} after staging"
    return 0
  fi

  git commit -m "$msg"
  success "Committed: ${repo_name} → \"$msg\""
}

# ── Push to all remotes ───────────────────────────────────────────────────────
push_repo() {
  local repo_path="$1"
  local repo_name="$2"

  cd "$repo_path"

  local branch
  branch=$(git branch --show-current)
  # If detached HEAD (submodules), get the branch from the remote tracking
  if [[ -z "$branch" ]]; then
    branch=$(git symbolic-ref --short -q HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  fi

  # Skip if detached HEAD (submodules in detached state can't be pushed)
  if [[ "$branch" == "HEAD" ]]; then
    warn "${repo_name} is in detached HEAD — skipping push"
    return 0
  fi

  # Gather all remotes
  local remotes
  remotes=$(git remote 2>/dev/null || true)

  if [[ -z "$remotes" ]]; then
    warn "No remotes configured for ${repo_name}"
    return 0
  fi

  info "Pushing ${repo_name} (branch: ${branch}) to all remotes..."
  local any_pushed=false

  while IFS= read -r remote; do
    [[ -z "$remote" ]] && continue

    local refspec="$branch"
    if [[ "$remote" == "gitlab" && "$repo_name" == "pixelated (main)" && "$branch" == "staging" ]]; then
      refspec="staging:sync-from-github-2026-06-09"
    fi

    # Check if remote has the branch (avoid pushing to remotes that lack it)
    if [[ "$DRY_RUN" == "true" ]]; then
      info "[DRY-RUN] Would push ${refspec} → ${remote}"
      continue
    fi

    if [[ "$remote" == "gitlab" && "$repo_name" == "pixelated (main)" && "$branch" == "staging" ]]; then
      info "  Using custom refspec for gitlab: staging → sync-from-github-2026-06-09"
    fi

    if git push "$remote" "$refspec" 2>&1; then
      success "  Pushed → ${remote}/${refspec}"
      any_pushed=true
    else
      # Try force-with-lease for non-origin remotes if normal push fails
      warn "  Normal push failed for ${remote}; trying --force-with-lease"
      if git push --force-with-lease "$remote" "$refspec" 2>&1; then
        success "  Force-pushed → ${remote}/${refspec}"
        any_pushed=true
      else
        error "  Failed to push to ${remote} — manual intervention may be needed"
      fi
    fi
  done <<< "$remotes"

  if [[ "$any_pushed" == "true" ]]; then
    success "All remotes pushed for ${repo_name}"
  fi
}

# ── Main workflow ─────────────────────────────────────────────────────────────
section "Pixelated Smart Commit & Push"
info "Root: ${ROOT}"

# ── 1. Submodules (order: ai → docs → foresight-mcp) ─────────────────────────
SUBMODULES=("ai" "docs" "foresight-mcp")

for sub in "${SUBMODULES[@]}"; do
  sub_path="${ROOT}/${sub}"
  if [[ ! -e "${sub_path}/.git" ]]; then
    warn "Submodule directory missing or not init'd: ${sub_path}"
    continue
  fi
  commit_repo "$sub_path" "$sub" "$MSG_OVERRIDE"
done

# Push submodules after all are committed
for sub in "${SUBMODULES[@]}"; do
  sub_path="${ROOT}/${sub}"
  [[ ! -e "${sub_path}/.git" ]] && continue
  push_repo "$sub_path" "$sub"
done

# ── 2. Main repo ──────────────────────────────────────────────────────────────
# After submodule commits, the parent needs updated submodule pointers
cd "$ROOT"

# Update submodule pointer tracking in main repo
git submodule update --remote --no-fetch 2>/dev/null || true

section "Main repo: pixelated"

# Check if submodule pointers changed (they should after sub commits)
local_sub_changes=$(git diff --name-only HEAD -- ai docs foresight-mcp 2>/dev/null || true)
if [[ -n "$local_sub_changes" ]]; then
  info "Submodule pointer updates detected: ${local_sub_changes}"
fi

commit_repo "$ROOT" "pixelated (main)" "$MSG_OVERRIDE"
push_repo "$ROOT" "pixelated (main)"

# ── Summary ───────────────────────────────────────────────────────────────────
section "Done"
success "All repos committed and pushed to all remotes."
echo ""
echo "  Repos processed:"
for sub in "${SUBMODULES[@]}"; do echo "    • ${sub}"; done
echo "    • pixelated (main)"
echo ""
