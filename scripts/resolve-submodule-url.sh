#!/bin/bash

# resolve-submodule-url.sh
# Dynamically override submodule URL based on deployment environment
# Used in CI/CD pipelines to avoid SSH key issues and support Azure DevOps internal access

set -euo pipefail

SUBMODULE_PATH="ai"
SUBMODULE_URL_GITHUB="https://github.com/pixelatedempathy/ai.git"
SUBMODULE_URL_AZURE="https://dev.azure.com/pixeljump/_git/ai"

# Detect environment using Azure DevOps built-in variables
# TF_BUILD is always set to 'True' in Azure Pipelines
# SYSTEM_TEAMFOUNDATIONCOLLECTIONURI contains the Azure DevOps organization URL
if [[ "${TF_BUILD:-}" == "True" ]] || [[ -n "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}" ]]; then
  echo "Detected Azure DevOps pipeline environment. Using Azure submodule URL."
  SUBMODULE_URL="$SUBMODULE_URL_AZURE"
  
  # Azure DevOps uses System.AccessToken for authentication
  # Configure git to use the token for Azure Repos
  if [[ -n "${SYSTEM_ACCESSTOKEN:-}" ]]; then
    echo "Configuring Git credential helper for Azure Repos authentication..."
    git config --global credential.helper store
    # Azure DevOps uses a special header for authentication
    echo "https://build:${SYSTEM_ACCESSTOKEN}@dev.azure.com" > ~/.git-credentials
    echo "✅ Azure Repos authentication configured"
  else
    echo "##[warning]⚠️ SYSTEM_ACCESSTOKEN not set - using agent's default credentials"
  fi
else
  echo "Detected external/GitHub environment. Using GitHub submodule URL."
  SUBMODULE_URL="$SUBMODULE_URL_GITHUB"
  
  # Configure Git credential helper for GitHub HTTPS authentication
  # If GITHUB_TOKEN is set, configure git to use it for authentication
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "Configuring Git credential helper for GitHub authentication..."
    
    # Configure Git to use the token for GitHub URLs
    git config --global url."https://x-access-token:${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
    
    # Alternative: Set credential helper to use the token
    # This creates a temporary credential helper that provides the token
    git config --global credential.helper "store --file=$(mktemp)"
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com" | git credential approve
    
    echo "✅ GitHub authentication configured"
  else
    echo "##[warning]⚠️ GITHUB_TOKEN not set - submodule clone may fail for private repositories"
    echo "##[warning]Add GITHUB_TOKEN to Azure DevOps variable group 'pixelated-pipeline-variables'"
  fi
fi

# Update git config for this repo only to override submodule URL
# This avoids modifying .gitmodules and keeps it clean for developers


# 1. Sync first to ensure local config matches .gitmodules (resets structure)
git submodule sync

# 2. Initialize to ensure submodule entries exist in .git/config
# This copies from .gitmodules, but we'll override it next
git submodule init

# 3. Apply the CONDITIONAL override to .git/config
# (SUBMODULE_URL was determined by the if/else block above)
git config submodule."$SUBMODULE_PATH".url "$SUBMODULE_URL"

echo "Submodule URL successfully updated in .git/config to: $SUBMODULE_URL"

# 4. Update (fetch & checkout) using the validated URL
echo "Running: git submodule update --recursive"
git submodule update --recursive

echo "✅ Submodule initialization complete"
