# Agent Protocol: PR Churn Management

## Project Overview
This project is dedicated to the systematic processing, fixing, and merging of the pull request backlog for the `daggerstuff/pixelated` repository. Our goal is 100% clearance of stale or pending contributions while maintaining strict repository hygiene and environment isolation.

## Core Mandates
1. **Isolation**: EVERY PR must be processed in a fresh, isolated `RUBE_REMOTE_WORKBENCH` sandbox.
2. **Carry-Along Toolset**: Use the provided runtime script to instantly bootstrap new sandboxes.
3. **Hygiene**: Ensure `uv.lock` (Python) and `pnpm-lock.yaml` (Node.js) are always synchronized before merging.
4. **Safety**: Close redundant or dangerous PRs immediately with a clear explanation.

## First Steps for Agents
1. **Queue Identification**: Run `gh pr list --repo daggerstuff/pixelated --limit 10 --json number,headRefName --jq 'sort_by(.createdAt)'` to find the oldest pending work.
2. **Sandbox Initialization**: 
   - Spawn a new `RUBE_REMOTE_WORKBENCH`.
   - `write_file` the `sandbox-runtime.sh` script (see below) into the sandbox.
   - Run `source sandbox-runtime.sh <PR_NUMBER> <HEAD_REF>`.
3. **Verification**: Run `sync_deps` to ensure the environment is stable.
4. **Execution**: Apply fixes, run tests, and merge via `GITHUB_MERGE_A_PULL_REQUEST`.

## Carry-Along Toolset (`scripts/sandbox-runtime.sh`)
```bash
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
        curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=10.33.0 sh - > /dev/null 2>&1
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
```
