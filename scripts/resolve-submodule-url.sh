#!/bin/bash

# resolve-submodule-url.sh
# Dynamically override submodule URL based on deployment environment
# Used in CI/CD pipelines to avoid SSH key issues and support Azure DevOps internal access

set -euo pipefail

SUBMODULE_PATH="ai"
SUBMODULE_URL_GITHUB="https://github.com/pixelatedempathy/ai.git"
# User requested SSH for Azure DevOps (keys laid down on agent)
SUBMODULE_URL_AZURE="git@ssh.dev.azure.com:v3/pixeljump/ai/ai"

# Detect environment using Azure DevOps built-in variables
# TF_BUILD is always set to 'True' in Azure Pipelines
# SYSTEM_TEAMFOUNDATIONCOLLECTIONURI contains the Azure DevOps organization URL
if [[ "${TF_BUILD:-}" == "True" ]] || [[ -n "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}" ]]; then
  echo "Detected Azure DevOps pipeline environment. Using Azure submodule URL (SSH)."
  SUBMODULE_URL="$SUBMODULE_URL_AZURE"
  
  # SSH authentication is handled by the agent's SSH keys (~/.ssh/config)
  # No need to configure http.extraheader for bearer tokens
  echo "✅ Using SSH URL for submodule (relies on agent SSH keys)"
else
  echo "Detected external/GitHub environment. Using GitHub submodule URL."
  SUBMODULE_URL="$SUBMODULE_URL_GITHUB"
  
  # Configure Git credential helper for GitHub HTTPS authentication
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "Configuring Git credential helper for GitHub authentication..."
    git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
    echo "✅ GitHub authentication configured"
  else
    echo "##[warning]⚠️ GITHUB_TOKEN not set - submodule clone may fail for private repositories"
  fi
fi

# Update git config for this repo only to override submodule URL
# This avoids modifying .gitmodules and keeps it clean for developers

# 1. Sync first to ensure local config matches .gitmodules (resets structure)
git submodule sync

# 2. Initialize to ensure submodule entries exist in .git/config
git submodule init

# 3. Apply the CONDITIONAL override to .git/config
# (SUBMODULE_URL was determined by the if/else block above)
git config submodule."$SUBMODULE_PATH".url "$SUBMODULE_URL"

echo "Submodule URL successfully updated in .git/config to: $SUBMODULE_URL"

# Pre-emptively update the submodule's internal configuration if it's already checked out.
# 'git submodule sync' (step 1) resets the internal remote to match .gitmodules (GitHub),
# which causes the subsequent update to fail on persistent agents despite the parent config change.
if [ -e "$SUBMODULE_PATH/.git" ]; then
  echo "🔧 Updating submodule's internal remote 'origin' to match overridden URL..."
  (
    cd "$SUBMODULE_PATH" || exit 1
    # Check if origin exists, update it; otherwise add it (unlikely for initialized submodules)
    if git remote | grep -q "^origin$"; then
      git remote set-url origin "$SUBMODULE_URL"
    else
      git remote add origin "$SUBMODULE_URL"
    fi
    echo "✅ Submodule internal remote updated"
  )
fi

# 4. Update (fetch & checkout) using the validated URL
echo "Running: git submodule update --recursive"
git submodule update --recursive

echo "✅ Submodule initialization complete"
