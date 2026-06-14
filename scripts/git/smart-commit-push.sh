#!/usr/bin/env bash
# =============================================================================
# smart-commit-push.sh
# Stages, commits, syncs with origin, and pushes to all remotes.
# Works from any Git repo with optional submodules.
#
# Order:
#   1. Commit local changes (submodules first, then main repo)
#   2. Fetch & merge from origin  (submodules first, then main repo)
#   3. Push all repos to all their configured remotes
#
# No rebase — uses merge only (safe for protected branches).
# Only pulls from origin remote.
#
# Usage:
#   ./smart-commit-push.sh [--dry-run] [--message "override msg"]
#     --dry-run     Show what would be committed/pushed without doing it
#     --message -m  Override auto-generated commit message for all repos
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

# ── Repo detection (CWD-relative) ─────────────────────────────────────────────
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  error "Not inside a Git repository"
  exit 1
fi

REPO_NAME="$(basename "$ROOT")"

# ── Detect initialised submodules ─────────────────────────────────────────────
SUBMODULES=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  flag="${line:0:1}"       # ' ', '+', '-', or 'U'
  path="$(echo "$line" | awk '{print $2}')"
  # Skip un-initialised submodules (flagged with '-') or missing checkouts
    if [[ "$flag" != "-" && -e "$ROOT/$path/.git" ]]; then
    SUBMODULES+=("$path")
  fi
done < <(git -C "$ROOT" submodule status 2>/dev/null || true)

# ── Semantic grouping ─────────────────────────────────────────────────────────
# Returns a short group label for a file path (repo-agnostic categories).
classify_file() {
  local f="$1"
  case "$f" in
    # CI / DevOps
    .github/*|.gitlab*|.ci/*|Dockerfile*|*.dockerfile|docker-compose*|Jenkinsfile*)
      echo "ci" ;;
    # Tests
    *test*|*spec*|__tests__/*|pytest.ini|jest.config*|vitest.config*|coverage*|.nyc_output/*)
      echo "tests" ;;
    # Source code
    src/*|lib/*|app/*|packages/*|core/*|components/*)
      echo "src" ;;
    # CLI / scripts / tooling
    scripts/*|bin/*|Makefile|makefile|GNUmakefile|justfile|Taskfile*)
      echo "tooling" ;;
    # Dependencies / lockfiles
    package.json|pnpm-lock*|yarn.lock*|package-lock*|npm-shrinkwrap*|uv.lock|Cargo.lock|Gemfile.lock|poetry.lock|requirements*|pyproject.toml|composer.lock|go.sum)
      echo "deps" ;;
    # Docs
    *.md|*.mdx|docs/*|wiki/*)
      echo "docs" ;;
    # Everything else
    *)
      echo "misc" ;;
  esac
}

# Build a human-readable commit message from a map of group→file-counts
build_message() {
  local -n _groups=$1   # nameref
  local parts=()

  local priority=(ci src tests tooling deps docs misc)
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
  case "${prefix%%(*}" in
    ci)      summary="update CI/CD workflows" ;;
    tests)   summary="update tests" ;;
    src)     summary="update source files" ;;
    tooling) summary="update tooling and scripts" ;;
    deps)    summary="update dependencies" ;;
    docs)    summary="update documentation" ;;
    *)       summary="miscellaneous updates" ;;
  esac

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
  local detect_sub_changes="${3:-false}"

  section "Commit: ${repo_name}"

  cd "$repo_path"

  # Collect changed & untracked files
  local modified new_files all_files
  modified=$(git diff --name-only HEAD 2>/dev/null || true)
  new_files=$(git ls-files --others --exclude-standard 2>/dev/null || true)

  # Also detect submodule pointer changes (unstaged in parent)
  if [[ "$detect_sub_changes" == "true" && ${#SUBMODULES[@]} -gt 0 ]]; then
    local sub_dirty
    sub_dirty=$(git diff --name-only HEAD -- "${SUBMODULES[@]}" 2>/dev/null || true)
    if [[ -n "$sub_dirty" ]]; then
      modified="${modified}"$'\n'"${sub_dirty}"
    fi
  fi

  # Filter out commonly-unwanted dirs
  new_files=$(echo "$new_files" | grep -v "^scratch/" | grep -v "^aws/" | grep -v "^tmp/" | grep -v "^tests/results/" || true)

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
  if [[ -n "$MSG_OVERRIDE" ]]; then
    msg="$MSG_OVERRIDE"
  else
    msg=$(build_message groups)
  fi

  info "Message: \"${msg}\""

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY-RUN] Would stage ${#file_list[@]} file(s) and commit: \"$msg\""
    echo "  Files:"
    printf '    %s\n' "${file_list[@]}"
    return 0
  fi

  # Stage tracked modifications (full-tree)
  local tracked_modified
  tracked_modified=$(git diff --name-only HEAD 2>/dev/null || true)
  if [[ -n "$tracked_modified" ]]; then
    git add -u 2>/dev/null || true
  fi

  # Stage new untracked files individually
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if git ls-files --others --exclude-standard -- "$f" 2>/dev/null | grep -q .; then
      git add -- "$f" 2>/dev/null || warn "  Skipped (gitignored?): $f"
    fi
  done <<< "$new_files"

  # Handle submodule pointer updates (for main repo)
  if [[ "$detect_sub_changes" == "true" && ${#SUBMODULES[@]} -gt 0 ]]; then
    # Check if submodule .git files changed
    for sub in "${SUBMODULES[@]}"; do
      if git diff --cached --name-only -- "$sub" 2>/dev/null | grep -q .; then
        success "  Submodule pointer updated: ${sub}"
      fi
    done
  fi

  if git diff --cached --quiet; then
    info "Nothing new to commit in ${repo_name} after staging"
    return 0
  fi

  git commit -m "$msg"
  success "Committed: ${repo_name} → \"$msg\""
}

# ── Sync with origin (fetch + merge, no rebase) ───────────────────────────────
sync_with_origin() {
  local repo_path="$1"
  local repo_name="$2"

  section "Sync: ${repo_name}"

  cd "$repo_path"

  local branch
  branch=$(git branch --show-current 2>/dev/null || true)
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    info "${repo_name} is on detached HEAD — skipping sync"
    return 0
  fi

  # Only sync from origin
  if ! git remote get-url origin &>/dev/null; then
    info "${repo_name} has no 'origin' remote — skipping sync"
    return 0
  fi

  # Fetch only origin's matching branch
  info "Fetching origin/${branch}..."
  if ! git fetch origin "$branch" 2>&1; then
    warn "Fetch failed for ${repo_name} — skipping pull"
    return 0
  fi

  # Check if origin has this branch
  if ! git rev-parse --verify "origin/${branch}" &>/dev/null; then
    info "origin/${branch} does not exist — skipping pull"
    return 0
  fi

  local ahead behind
  ahead=$(git rev-list --count "origin/${branch}..HEAD" 2>/dev/null || echo 0)
  behind=$(git rev-list --count "HEAD..origin/${branch}" 2>/dev/null || echo 0)

  if [[ "$behind" -eq 0 ]]; then
    info "${repo_name} is up to date with origin/${branch}"
    return 0
  fi

  if [[ "$ahead" -gt 0 ]]; then
    info "${repo_name}: ${ahead} ahead + ${behind} behind — will create merge commit"
    info "Branch is protected / diverged — using merge (no rebase)"
  else
    info "${repo_name} is ${behind} commit(s) behind origin/${branch} — merging..."
  fi

  # Pull with merge (---no-rebase ensures merge, safe for protected branches)
  if git pull origin "$branch" --no-rebase --no-edit 2>&1; then
    success "${repo_name} merged with origin/${branch}"
    return 0
  fi

  # ── Merge conflict handling ───────────────────────────────────────────
  local conflicted
  conflicted=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
  if [[ -z "$conflicted" ]]; then
    error "Merge failed for ${repo_name} (no conflict markers found)"
    return 1
  fi

  warn "Merge conflicts in ${repo_name}:"
  echo "$conflicted" | while IFS= read -r f; do echo "    ${f}"; done

  # Try to resolve submodule conflicts intelligently
  local all_resolved=true
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if [[ " ${SUBMODULES[*]} " == *" ${f} "* ]] || git submodule status "$f" &>/dev/null; then
      if ! resolve_submodule_conflict "$repo_path" "$f"; then
        all_resolved=false
      fi
    else
      # Regular file conflict — cannot auto-resolve
      error "  File conflict in ${f} — manual resolution needed"
      all_resolved=false
    fi
  done <<< "$conflicted"

  if [[ "$all_resolved" == "true" ]]; then
    git commit --no-edit
    success "All conflicts resolved, merge committed for ${repo_name}"
    return 0
  else
    error " ${conflicted} unresolved conflict(s) remain in ${repo_name}"
    error " Resolve manually, then commit and re-run"
    return 1
  fi
}

# ── Resolve submodule pointer conflict during a merge ─────────────────────────
resolve_submodule_conflict() {
  local repo_path="$1"
  local sub_path="$2"
  local sub_full="${repo_path}/${sub_path}"

  local ours theirs
  ours=$(git rev-parse ":2:${sub_path}" 2>/dev/null || true)
  theirs=$(git rev-parse ":3:${sub_path}" 2>/dev/null || true)

  if [[ -z "$ours" || -z "$theirs" ]]; then
    warn "  Cannot determine conflict sides for ${sub_path}"
    return 1
  fi

  info "  Submodule conflict in ${sub_path}: ours=${ours:0:8} theirs=${theirs:0:8}"

  # 1) Ours already contains theirs → keep ours
  if git -C "$sub_full" merge-base --is-ancestor "$theirs" "$ours" 2>/dev/null; then
    info "  Ours (${ours:0:8}) already contains theirs (${theirs:0:8}) — keeping ours"
    git add "$sub_path"
    return 0
  fi

  # 2) Theirs already contains ours → take theirs
  if git -C "$sub_full" merge-base --is-ancestor "$ours" "$theirs" 2>/dev/null; then
    info "  Theirs (${theirs:0:8}) already contains ours (${ours:0:8}) — taking theirs"
    git -C "$sub_full" checkout "$theirs" 2>/dev/null || true
    git add "$sub_path"
    return 0
  fi

  # 3) Divergent — attempt merge inside submodule
  info "  Submodule pointers diverged — attempting merge within ${sub_path}..."
  local sub_branch
  sub_branch=$(git -C "$sub_full" branch --show-current 2>/dev/null || true)

  # Ensure we have the remote branch to merge
  if git -C "$sub_full" remote get-url origin &>/dev/null; then
    git -C "$sub_full" fetch origin 2>&1 || true
  fi

  if [[ -n "$sub_branch" ]]; then
    if git -C "$sub_full" merge "$theirs" --no-edit 2>&1; then
      local new_hash
      new_hash=$(git -C "$sub_full" rev-parse HEAD)
      info "  Merged submodule at ${new_hash:0:8}"
      git add "$sub_path"
      return 0
    else
      warn "  Merge failed inside submodule ${sub_path} — taking theirs"
      # Abort submodule merge, take theirs
      git -C "$sub_full" merge --abort 2>/dev/null || true
      git -C "$sub_full" checkout "$theirs" 2>/dev/null || true
      git add "$sub_path"
      warn "  Took theirs for ${sub_path} — verify correctness"
      return 0
    fi
  else
    # Detached HEAD — take theirs
    info "  Submodule on detached HEAD — taking theirs"
    git -C "$sub_full" checkout "$theirs" 2>/dev/null || true
    git add "$sub_path"
    return 0
  fi
}

# ── Push to all remotes ───────────────────────────────────────────────────────
push_repo() {
  local repo_path="$1"
  local repo_name="$2"

  section "Push: ${repo_name}"

  cd "$repo_path"

  local branch
  branch=$(git branch --show-current 2>/dev/null || true)
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    warn "${repo_name} is on detached HEAD — skipping push"
    return 0
  fi

  local remotes
  remotes=$(git remote 2>/dev/null || true)
  if [[ -z "$remotes" ]]; then
    warn "No remotes configured for ${repo_name}"
    return 0
  fi

  local any_pushed=false
  while IFS= read -r remote; do
    [[ -z "$remote" ]] && continue

    if [[ "$DRY_RUN" == "true" ]]; then
      info "[DRY-RUN] Would push ${branch} → ${remote}/${branch}"
      continue
    fi

    if git push "$remote" "$branch" 2>&1; then
      success "  Pushed → ${remote}/${branch}"
      any_pushed=true
    else
      warn "  Failed to push to ${remote}"
      info "  Suggestion: git pull origin ${branch} && git push ${remote} ${branch}"
    fi
  done <<< "$remotes"

  if [[ "$any_pushed" == "true" ]]; then
    success "All remotes pushed for ${repo_name}"
  fi
}

# ── Main workflow ─────────────────────────────────────────────────────────────
section "Smart Commit & Push"
info "Repository: ${BOLD}${REPO_NAME}${RESET} (root: ${ROOT})"
if [[ ${#SUBMODULES[@]} -gt 0 ]]; then
  info "Submodules: ${SUBMODULES[*]}"
else
  info "No submodules detected"
fi

# ── Step 1 — Commit local work (submodules first, then main) ──────────────────
section "Step 1/3: Commit local changes"
for sub in "${SUBMODULES[@]}"; do
  commit_repo "$ROOT/$sub" "$sub" false
done
commit_repo "$ROOT" "$REPO_NAME" true

# ── Step 2 — Sync with origin (submodules first, then main) ───────────────────
section "Step 2/3: Sync with origin"
for sub in "${SUBMODULES[@]}"; do
  sync_with_origin "$ROOT/$sub" "$sub"
done
sync_with_origin "$ROOT" "$REPO_NAME"

# After sync, if submodule pointers drifted from what the merge resolved, update
if [[ ${#SUBMODULES[@]} -gt 0 ]]; then
  cd "$ROOT"
  sub_dirty=$(git diff --name-only HEAD -- "${SUBMODULES[@]}" 2>/dev/null || true)
  if [[ -n "$sub_dirty" ]]; then
    info "Submodule pointers changed during merge — updating..."
    git add "${SUBMODULES[@]}" 2>/dev/null || true
    if ! git diff --cached --quiet; then
      git commit -m "chore: update submodule pointers after merge" 2>/dev/null && \
        success "Committed updated submodule pointers" || true
    fi
  fi

  # Sync submodule checkouts with what the main repo now references
  info "Syncing submodule checkouts with committed pointers..."
  git submodule update --recursive 2>/dev/null || true
  success "Submodule checkouts synced"
fi

# ── Step 3 — Push all repos (submodules first, then main) ─────────────────────
section "Step 3/3: Push to all remotes"
for sub in "${SUBMODULES[@]}"; do
  push_repo "$ROOT/$sub" "$sub"
done
push_repo "$ROOT" "$REPO_NAME"

# ── Summary ───────────────────────────────────────────────────────────────────
section "Done"
success "All repos committed, synced, and pushed."
echo ""
echo "  Repos processed:"
for sub in "${SUBMODULES[@]}"; do echo "    • ${sub}"; done
echo "    • ${REPO_NAME}"
echo ""
