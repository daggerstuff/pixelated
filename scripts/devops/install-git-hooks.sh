#!/usr/bin/env bash
set -euo pipefail

# --- Git Hook Installer ---
# Refactored for modularity, using external templates for easier maintenance.
# Improvements:
# - Separate template files in scripts/devops/hooks/templates/
# - Enhanced secret scanning in pre-commit
# - Colored output for hooks
# - Python linting support via lint-staged

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not available; skipping git hook installation."
  exit 0
fi

GIT_DIR=$(git rev-parse --git-common-dir 2>/dev/null || git rev-parse --git-dir 2>/dev/null)
if [ -z "$GIT_DIR" ]; then
  echo "Not inside a git repository; skipping git hook installation."
  exit 0
fi

HOOKS_DIR="$GIT_DIR/hooks"
TEMPLATES_DIR="$(dirname "${BASH_SOURCE[0]}")/hooks/templates"
mkdir -p "$HOOKS_DIR"

PROTECTED_BRANCHES="main master production staging"

echo "Installing advanced git hooks to $HOOKS_DIR..."

# --- Helper Function ---

install_hook() {
  local hook_name="$1"
  local template_file="$2"
  local target="$HOOKS_DIR/$hook_name"

  if [ ! -f "$template_file" ]; then
    echo "❌ ERROR: Template for $hook_name not found at $template_file"
    return 1
  fi

  # Set default protected branches if not already configured
  if ! git config --get pixelated.protectedBranches >/dev/null 2>&1; then
    git config pixelated.protectedBranches "main master production staging"
  fi

  cp "$template_file" "$target"

  chmod +x "$target"
  echo "✅ Installed $hook_name"
}

# --- Execution ---

install_hook "pre-commit" "$TEMPLATES_DIR/pre-commit.tmpl"
install_hook "commit-msg" "$TEMPLATES_DIR/commit-msg.tmpl"
install_hook "post-checkout" "$TEMPLATES_DIR/post-sync.tmpl"
install_hook "post-merge" "$TEMPLATES_DIR/post-sync.tmpl"
install_hook "pre-push" "$TEMPLATES_DIR/pre-push.tmpl"
install_hook "pre-rebase" "$TEMPLATES_DIR/pre-rebase.tmpl"

echo "✨ Git hooks installation complete."
