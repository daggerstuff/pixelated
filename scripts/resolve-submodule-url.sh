#!/bin/bash

# resolve-submodule-url.sh
# Dynamically override submodule URL based on deployment environment
# Used in CI/CD pipelines to avoid SSH key issues and support Azure DevOps internal access

set -euo pipefail

SUBMODULE_PATH="ai"
SUBMODULE_URL_GITHUB="https://github.com/pixelatedempathy/ai.git"
# Support both SSH and HTTPS for Azure DevOps
SUBMODULE_URL_AZURE_SSH="git@ssh.dev.azure.com:v3/pixeljump/ai/ai"
SUBMODULE_URL_AZURE_HTTPS="https://dev.azure.com/pixeljump/ai/_git/ai"

# Detect environment using Azure DevOps built-in variables
if [[ "${TF_BUILD:-}" == "True" ]] || [[ -n "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}" ]]; then
  echo "Detected Azure DevOps pipeline environment."

  # Ensure ssh.dev.azure.com is in known_hosts to avoid interactive prompts
  echo "Ensuring Azure DevOps SSH host keys are recognized..."
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  
  # Use ssh-keygen -F which handles both hashed and plain hostnames
  if ! ssh-keygen -F ssh.dev.azure.com >/dev/null 2>&1; then
    echo "Adding ssh.dev.azure.com to known_hosts..."
    ssh-keyscan ssh.dev.azure.com >> ~/.ssh/known_hosts 2>/dev/null || echo "##[warning]⚠️ Could not pre-scan host keys"
  else
    echo "✅ ssh.dev.azure.com already in known_hosts"
  fi

  # Default to SSH as the primary method (per user confirmation)
  if [[ "${SUBMODULE_USE_SSH:-}" == "false" ]]; then
    echo "Using Azure submodule URL (HTTPS) as explicitly requested."
    SUBMODULE_URL="$SUBMODULE_URL_AZURE_HTTPS"
  else
    echo "Using Azure submodule URL (SSH) - expected to match parent repo permissions."
    # Appending .git is safer for some Git versions
    SUBMODULE_URL="${SUBMODULE_URL_AZURE_SSH}.git"
  fi

  # Diagnostic check for SSH access if using SSH
  if [[ "$SUBMODULE_URL" == git@* ]]; then
    echo "🔍 Running SSH diagnostic..."
    # Try to detect if we have a valid key. SSH -T returns exit code 1 for Azure 
    # but we can check the stderr for 'Successfully authenticated'
    ssh -o BatchMode=yes -o ConnectTimeout=5 git@ssh.dev.azure.com 2>&1 | head -n 5 || true
    
    # Check for custom identify files mentioned in ~/.ssh/config
    if [ -f ~/.ssh/config ] && grep -q "IdentityFile" ~/.ssh/config; then
      echo "✅ Found custom SSH config with IdentityFile"
    fi
  fi

  # Proactively configure HTTPS authentication regardless, as it's a zero-cost safety net
  if [[ -n "${SYSTEM_ACCESSTOKEN:-}" ]]; then
    echo "Configuring HTTPS fallback authentication for Azure DevOps..."
    git config --global url."https://azdo:${SYSTEM_ACCESSTOKEN}@dev.azure.com/".insteadOf "https://dev.azure.com/"
    echo "✅ HTTPS fallback authentication ready"
  fi
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
echo "Submodule URL selected: $SUBMODULE_URL"

# 1. Sync first to ensure local config matches .gitmodules (resets structure)
git submodule sync

# 2. Initialize to ensure submodule entries exist in .git/config
git submodule init

# 3. Apply the CONDITIONAL override to .git/config
git config submodule."$SUBMODULE_PATH".url "$SUBMODULE_URL"

echo "Submodule URL successfully updated in .git/config to: $SUBMODULE_URL"

# Pre-emptively update the submodule's internal configuration if it's already checked out.
if [ -e "$SUBMODULE_PATH/.git" ]; then
  echo "🔧 Updating submodule's internal remote 'origin' to match overridden URL..."
  (
    cd "$SUBMODULE_PATH" || exit 1
    if git remote | grep -q "^origin$"; then
      git remote set-url origin "$SUBMODULE_URL"
    else
      git remote add origin "$SUBMODULE_URL"
    fi
    echo "✅ Submodule internal remote updated"
  )
fi

# 4. Update (fetch & checkout) using the validated URL
echo "Running: git submodule update --init --recursive"
# Using --init ensures it attempts initialization if not already done
git submodule update --init --recursive

echo "✅ Submodule initialization complete"
