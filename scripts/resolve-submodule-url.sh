#!/bin/bash

# resolve-submodule-url.sh
# Dynamically override submodule URL based on deployment environment
# Used in CI/CD pipelines to avoid SSH key issues and support Azure DevOps internal access

set -euo pipefail

SUBMODULE_PATH="ai"
SUBMODULE_URL_GITHUB="https://github.com/pixelatedempathy/ai.git"
SUBMODULE_URL_AZURE="git@ssh.dev.azure.com:v3/pixeljump/ai/ai"

# Detect environment using Azure DevOps built-in variables
# TF_BUILD is always set to 'True' in Azure Pipelines
# SYSTEM_TEAMFOUNDATIONCOLLECTIONURI contains the Azure DevOps organization URL
if [[ "${TF_BUILD:-}" == "True" ]] || [[ -n "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}" ]]; then
  echo "Detected Azure DevOps pipeline environment. Using Azure submodule URL (SSH)."
  SUBMODULE_URL="$SUBMODULE_URL_AZURE"
  
  # For self-hosted agents, updating known_hosts avoids 'Host key verification failed'
  if command -v ssh-keyscan >/dev/null; then
      echo "Configuring known_hosts for ssh.dev.azure.com..."
      mkdir -p ~/.ssh
      ssh-keyscan -t rsa ssh.dev.azure.com >> ~/.ssh/known_hosts 2>/dev/null || true
  fi
  
  echo "✅ Using SSH. Assuming agent has valid SSH keys for dev.azure.com"
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

# 4. Update (fetch & checkout) using the validated URL
echo "Running: git submodule update --recursive"
git submodule update --recursive

echo "✅ Submodule initialization complete"
