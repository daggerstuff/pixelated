#!/usr/bin/env bash
  success "Committed: ${repo_name} → \"$msg\""
}

# ── Push to all remotes ───────────────────────────────────────────────────────
push_repo() {
  local repo_path="$1"
  local repo_name="$2"

  cd "$repo_path"

  local branch
  branch=$(git branch --show-current)

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

    # Check if remote has the branch (avoid pushing to remotes that lack it)
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
