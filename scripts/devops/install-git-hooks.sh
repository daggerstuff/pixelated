#!/usr/bin/env bash
set -euo pipefail

# --- Git Hook Installer ---
# Refactored for modularity, correctness, and performance.
# Fixes kluster issues: #1 heredoc escaping, #2 lint performance, #3 push performance, #4 modularity.

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
mkdir -p "$HOOKS_DIR"

echo "Installing advanced git hooks to $HOOKS_DIR..."

PROTECTED_BRANCHES="main master production staging"

# --- Hook Generators ---

generate_pre_commit() {
  local target="$1"
  # Fix Issue #1: Use quoted EOF to ensure variables expansion happens at runtime, not install time.
  # Fix Issue #2: Integrate lint-staged for performance on large codebases.
  cat > "$target" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "🔍 [Hook] Running pre-commit checks..."

# A. Secret scanning (Catch potential leaks before they leave)
echo "🔒 Scanning for secrets..."
EXPR="(\.env|config/secrets|\.pem|id_rsa)"
# Check for staged files matching sensitive patterns
if git diff --cached --name-only | grep -E "$EXPR" >/dev/null 2>&1; then
  SENSITIVE_FILES=$(git diff --cached --name-only | grep -E "$EXPR")
  echo "❌ ERROR: Potential sensitive file found in staged changes:"
  echo "$SENSITIVE_FILES"
  exit 1
fi

# Check for keywords like API_KEY, SECRET, PASSWORD in new code content
if git diff --cached --unified=0 | grep -Ei "(api_key|secret|password|token)[[:space:]]*=[[:space:]]*['\"][a-zA-Z0-9_\-]{8,}['\"]" >/dev/null 2>&1; then
  echo "⚠️  WARNING: Potential hardcoded secret found. Review changes carefully."
  # Non-blocking warning for now
fi

# B. Check lockfile synchronization
if [ -f scripts/devops/check-lockfiles-pre-commit.sh ]; then
  echo "🔗 Checking lockfile synchronization..."
  bash scripts/devops/check-lockfiles-pre-commit.sh
fi

# C. Run linting via lint-staged (Fix Issue #2: performant linting only on staged files)
if command -v pnpm >/dev/null 2>&1 && [ -f .lintstagedrc.json ]; then
  echo "✨ Running linting via lint-staged (only on changed files)..."
  pnpm exec lint-staged --quiet
else
  echo "✨ Running full project linting (consider setting up lint-staged)..."
  pnpm run lint
fi
EOF
}

generate_commit_msg() {
  local target="$1"
  cat > "$target" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Pattern for Conventional Commits
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.*\))?: .+"

if ! echo "$COMMIT_MSG" | grep -Eq "$PATTERN"; then
  echo "❌ ERROR: Commit message does not follow Conventional Commits format."
  echo "Example: feat(api): add new endpoint"
  echo "Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  exit 1
fi
EOF
}

generate_post_sync() {
  local target="$1"
  cat > "$target" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Auto-sync lockfiles on checkout/merge
PREV_REF=""
if git rev-parse --verify HEAD@{1} >/dev/null 2>&1; then
  PREV_REF="HEAD@{1}"
elif git rev-parse --verify ORIG_HEAD >/dev/null 2>&1; then
  PREV_REF="ORIG_HEAD"
fi

if [ -n "$PREV_REF" ]; then
  # check for lockfile changes
  if git diff-tree -r --name-only "$PREV_REF" HEAD | grep -q 'pnpm-lock.yaml'; then
    echo "📦 [Hook] pnpm-lock.yaml changed. Running pnpm install..."
    pnpm install
  fi
  # check for python lockfile changes
  if git diff-tree -r --name-only "$PREV_REF" HEAD | grep -q 'uv.lock'; then
    echo "📦 [Hook] uv.lock changed. Running uv lock..."
    uv lock
  fi
fi
EOF
}

generate_pre_push() {
  local target="$1"
  # Fix Issue #3: Optimization for large suites and transparent bypass.
  cat > "$target" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [ "${SKIP_PUSH_CHECKS:-}" = "true" ]; then
  echo "⏩ [Hook] Skipping push checks (SKIP_PUSH_CHECKS is true)"
  exit 0
fi

echo "🚀 [Hook] Running pre-push verification (tests)..."
echo "💡 TIP: Use 'SKIP_PUSH_CHECKS=true git push' to skip if your tests are verified elsewhere."

# If we have a dedicated smoke test suite, prefer it for speed.
if [ -f scripts/testing/smoke-tests.sh ]; then
    bash scripts/testing/smoke-tests.sh
else
    # Run a subset or quick test if possible, fallback to full suite
    pnpm test
fi
EOF
}

generate_pre_rebase() {
  local target="$1"
  local protected="$2"
  cat > "$target" << EOF
#!/usr/bin/env bash
set -euo pipefail

CURRENT_BRANCH=\$(git branch --show-current)
PROTECTED="$protected"

for BRANCH in \$PROTECTED; do
  if [ "\$CURRENT_BRANCH" = "\$BRANCH" ]; then
    echo "⚠️  WARNING: You are rebasing on a protected branch (\$BRANCH). Is this intentional?"
    break
  fi
done
EOF
}

# --- Execution ---

generate_pre_commit "$HOOKS_DIR/pre-commit"
generate_commit_msg "$HOOKS_DIR/commit-msg"
generate_post_sync "$HOOKS_DIR/post-checkout"
generate_post_sync "$HOOKS_DIR/post-merge"
generate_pre_push "$HOOKS_DIR/pre-push"
generate_pre_rebase "$HOOKS_DIR/pre-rebase" "$PROTECTED_BRANCHES"

# Ensure everything is executable
chmod +x "$HOOKS_DIR/"*

echo "✅ Git hooks installed: pre-commit, commit-msg, post-checkout, post-merge, pre-push, pre-rebase."
