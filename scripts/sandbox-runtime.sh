#!/bin/bash
set -e

# Pixelated Sandbox Carry-Along Toolset
# Use: source ./sandbox-runtime.sh <pr_number> <head_ref>

PR_NUMBER=$1
HEAD_REF=$2
REPO_URL="https://github.com/daggerstuff/pixelated.git"

echo "⚡ [Runtime] Initializing sandbox for PR #$PR_NUMBER..."

# 1. Path & Env Setup
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$HOME/.local/bin:$PNPM_HOME:$PATH"

# 2. Idempotent Tool Installation
install_tools() {
    if ! command -v uv &> /dev/null; then
        echo "📦 [Runtime] Installing uv..."
        curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1
    fi

    if ! command -v pnpm &> /dev/null; then
        echo "📦 [Runtime] Installing pnpm..."
        curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=11.0.8 sh - > /dev/null 2>&1
    fi
}

# 3. Git Identity
setup_git() {
    git config --global user.email "bot@composio.dev"
    git config --global user.name "Composio Bot"
    git config --global credential.helper store
}

# 4. Repo Lifecycle
sync_repo() {
    if [ ! -d "repo" ]; then
        echo "🚀 [Runtime] Cloning repository..."
        git clone "$REPO_URL" repo > /dev/null 2>&1
    fi
    cd repo
    echo "git [Runtime] Checking out $HEAD_REF..."
    git fetch origin "$HEAD_REF" > /dev/null 2>&1
    git checkout "$HEAD_REF" > /dev/null 2>&1
}

# 5. Dependency Management
sync_deps() {
    echo "🔗 [Runtime] Syncing all dependencies..."
    uv pip compile pyproject.toml -o requirements.txt > /dev/null 2>&1
    uv lock > /dev/null 2>&1
    pnpm install --no-frozen-lockfile > /dev/null 2>&1
}

# Execute Setup
install_tools
setup_git
sync_repo

echo "✅ [Runtime] Sandbox Ready. Use 'sync_deps' to align lockfiles."
