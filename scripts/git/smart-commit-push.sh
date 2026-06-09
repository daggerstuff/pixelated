#!/usr/bin/env bash
set -euo pipefail

# ── Helpers ────────────────────────────────────────────────────────────────────

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DRY_RUN="${DRY_RUN:-false}"
MSG_OVERRIDE="${MSG_OVERRIDE:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

section() { echo -e "\n${MAGENTA}▶${NC} $*"; }
info()    { echo -e "  ${BLUE}ℹ${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $*"; }
error()   { echo -e "  ${RED}✗${NC} $*"; }
success() { echo -e "  ${GREEN}✓${NC} $*"; }

# ── Argument parsing ───────────────────────────────────────────────────────────

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN="true" ;;
    --message=*) MSG_OVERRIDE="${arg#*=}" ;;
    -m) shift; MSG_OVERRIDE="$1" ;;
    *) warn "Unknown arg: $arg" ;;
  esac
done

# ── Generate semantic commit message ────────────────────────────────────────────

generate_msg() {
  local repo_path="$1"
  local repo_name="$2"

  cd "$repo_path"

  local staged
  staged=$(git diff --name-only --cached 2>/dev/null || true)
  local unstaged
  unstaged=$(git diff --name-only 2>/dev/null || true)
  local all_files
  all_files=$(echo -e "$staged\n$unstaged" | sort -u | grep -v "^$" || true)

  if [[ -z "$all_files" ]]; then
    echo ""
    return 0
  fi

  # Categorize files
  local ts_files py_files md_files cfg_files other_files
  ts_files=$(echo "$all_files" | grep -E "\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$" | wc -l)
  py_files=$(echo "$all_files" | grep -E "\.py$" | wc -l)
  md_files=$(echo "$all_files" | grep -E "\.(md|mdx)$" | wc -l)
  cfg_files=$(echo "$all_files" | grep -E "(package\.json|tsconfig|pyproject\.toml|requirements|\.yaml|\.yml|\.toml|\.json|\.lock)$" | wc -l)
  other_files=$(echo "$all_files" | wc -l)

  local parts=()
  [[ $ts_files -gt 0 ]] && parts+=("$ts_files TS/JS")
  [[ $py_files -gt 0 ]] && parts+=("$py_files Python")
  [[ $md_files -gt 0 ]] && parts+=("$md_files docs")
  [[ $cfg_files -gt 0 ]] && parts+=("$cfg_files config")
  [[ $other_files -gt ${#parts[@]} ]] && parts+=("$((other_files - ts_files - py_files - md_files - cfg_files)) other")

  if [[ ${#parts[@]} -eq 0 ]]; then
    echo "chore: update $repo_name"
  else
    local msg="chore($repo_name): ${parts[*]}"
    echo "$msg"
  fi
}

# ── Commit a single repo ────────────────────────────────────────────────────────

commit_repo() {
  local repo_path="$1"
  local repo_name="$2"
  local msg_override="$3"

  cd "$repo_path"

  # Check for changes (staged + unstaged, excluding excluded dirs)
  local changes
  changes=$(git status --porcelain 2>/dev/null | grep -v -E "^\?\? (scratch|aws|tests/results)/" | grep -v "^$" || true)

  if [[ -z "$changes" ]]; then
    info "No changes in ${repo_name}"
    return 0
  fi

  local msg
  if [[ -n "$msg_override" ]]; then
    msg="$msg_override"
  else
    msg=$(generate_msg "$repo_path" "$repo_name")
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    info "[DRY-RUN] Would commit ${repo_name}: \"$msg\""
    info "[DRY-RUN] Files: $(echo "$changes" | wc -l)"
    return 0
  fi

  # Stage all changes (except excluded)
  git add -A 2>/dev/null || true

  # Remove excluded from staging
  git reset -q HEAD -- scratch aws tests/results 2>/dev/null || true

  git commit -m "$msg" 2>&1 | tail -1
  success "Committed: ${repo_name} → \"$msg\""
}

# ── Push to all remotes ───────────────────────────────────────────────────────

push_repo() {
  local repo_path="$1"
  local repo_name="$2"

  cd "$repo_path"

  local branch
  branch=$(git branch --show-current 2>/dev/null || echo "main")

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

    if [[ "$DRY_RUN" == "true" ]]; then
      info "[DRY-RUN] Would push ${branch} → ${remote}"
      continue
    fi

    if git push "$remote" "$branch" 2>&1; then
      success "  Pushed → ${remote}/${branch}"
      any_pushed=true
    else
      # Try force-with-lease for non-origin remotes if normal push fails
      warn "  Normal push failed for ${remote}; trying --force-with-lease"
      if git push --force-with-lease "$remote" "$branch" 2>&1; then
        success "  Force-pushed → ${remote}/${branch}"
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
[[ "$DRY_RUN" == "true" ]] && warn "DRY-RUN mode — no changes will be made"

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