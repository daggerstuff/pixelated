#!/bin/bash

# resolve-submodule-url.sh
# Dynamically override submodule URL based on deployment environment
# Used in CI/CD pipelines to avoid SSH key issues and support Azure DevOps internal access

set -euo pipefail

SUBMODULE_PATH="ai"

# Detect parent repo remote to derive org/owner dynamically
PARENT_REMOTE_URL="$(git config --get remote.origin.url || echo)"

# Helper: extract GitHub owner from parent remote
extract_github_owner() {
  case "$1" in
    git@github.com:*)
      echo "$1" | sed -E 's|git@github.com:([^/]+)/.*|\1|'
      ;;
    https://github.com/*)
      echo "$1" | sed -E 's|https://github.com/([^/]+)/.*|\1|'
      ;;
    *)
      echo "pixelatedempathy" # safe default
      ;;
  esac
}

GITHUB_OWNER="${GITHUB_ORG:-$(extract_github_owner "$PARENT_REMOTE_URL")}" 
# Use SSH ONLY for GitHub
SUBMODULE_URL_GITHUB="git@github.com:${GITHUB_OWNER}/ai.git"

# Helper: extract Azure org and project from environment or parent remote
extract_azure_org() {
  local uri="$1"
  # Prefer SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: https://dev.azure.com/<org>/
  if [[ -n "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}" ]]; then
    echo "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}" | sed -E 's|https?://dev.azure.com/([^/]+)/.*|\1|'
    return
  fi
  # Fallback: parse from BUILD_REPOSITORY_URI
  if [[ -n "${BUILD_REPOSITORY_URI:-}" ]]; then
    echo "${BUILD_REPOSITORY_URI}" | sed -E 's|https?://dev.azure.com/([^/]+)/.*|\1|'
    return
  fi
  # Fallback: parse from parent remote
  echo "$uri" | sed -E 's|.*dev.azure.com/([^/]+)/.*|\1|'
}

extract_azure_project() {
  # Prefer SYSTEM_TEAMPROJECT
  if [[ -n "${SYSTEM_TEAMPROJECT:-}" ]]; then
    echo "${SYSTEM_TEAMPROJECT}"
    return
  fi
  # Fallback: parse from BUILD_REPOSITORY_URI: https://dev.azure.com/<org>/<project>/_git/<repo>
  if [[ -n "${BUILD_REPOSITORY_URI:-}" ]]; then
    echo "${BUILD_REPOSITORY_URI}" | sed -E 's|https?://dev.azure.com/[^/]+/([^/]+)/.*|\1|'
    return
  fi
  # Fallback: parse from parent remote URL
  if [[ -n "$PARENT_REMOTE_URL" ]]; then
    echo "$PARENT_REMOTE_URL" | sed -E 's|.*dev.azure.com/[^/]+/([^/]+)/.*|\1|'
    return
  fi
  echo "ai" # worst-case placeholder
}

AZ_ORG="$(extract_azure_org "$PARENT_REMOTE_URL")"
AZ_PROJECT="$(extract_azure_project)"

# Azure DevOps URL: SSH ONLY (derived dynamically)
SUBMODULE_URL_AZURE_SSH="git@ssh.dev.azure.com:v3/${AZ_ORG}/${AZ_PROJECT}/ai"

# Helper: check remote accessibility quickly (HEAD)
remote_accessible() {
  local url="$1"
  # Attempt ls-remote. If successful, return 0.
  if git ls-remote --exit-code "$url" HEAD >/dev/null 2>&1; then
    return 0
  fi
  
  # If we're here, it failed. debugging with masked secrets
  local masked_url="$url"
  if [[ -n "${SYSTEM_ACCESSTOKEN:-}" ]]; then
    masked_url="${masked_url//$SYSTEM_ACCESSTOKEN/***}"
  fi
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    masked_url="${masked_url//$GITHUB_TOKEN/***}"
  fi
  
  echo "    ⚠️ Connection check failed for $masked_url"
  # Optional: run once more to capture stderr for logs (piping to cat to avoid failure exit code here)
  # But prevent showing unmasked secrets. Git usually masks basic auth but let's be careful.
  return 1
}

# Prefer constructing Azure submodule URL by mirroring parent remote scheme and swapping repo name
build_azure_url_from_parent() {
  local parent="$1"
  case "$parent" in
    git@ssh.dev.azure.com:*)
      # git@ssh.dev.azure.com:v3/<org>/<project>/<repo>
      echo "$parent" | sed -E 's|(git@ssh.dev.azure.com:v3/[^/]+/[^/]+)/[^/]+|\1/ai|'
      ;;
    https://dev.azure.com/*)
      # Parent uses HTTPS; convert to SSH while swapping repo
      echo "$parent" | sed -E 's|https://dev.azure.com/([^/]+)/([^/]+)/_git/[^/]+|git@ssh.dev.azure.com:v3/\1/\2/ai|'
      ;;
    *)
      # Fall back to dynamically derived SSH URL
      echo "${SUBMODULE_URL_AZURE_SSH}.git"
      ;;
  esac
}

# Detect environment using Azure DevOps built-in variables
if [[ "${TF_BUILD:-}" == "True" ]] || [[ -n "${SYSTEM_TEAMFOUNDATIONCOLLECTIONURI:-}" ]]; then
  echo "Detected Azure DevOps pipeline environment."
  echo "Context: Org='$AZ_ORG', Project='$AZ_PROJECT'"

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

  # Enforce SSH ONLY; mirror parent scheme (convert HTTPS parent to SSH) and swap repo name
  CANDIDATE_URL="$(build_azure_url_from_parent "$PARENT_REMOTE_URL")"
  echo "Using Azure submodule URL (SSH only)."
  # Ensure .git suffix for SSH
  if [[ "$CANDIDATE_URL" == git@ssh.dev.azure.com:* ]]; then
    SUBMODULE_URL="${CANDIDATE_URL}.git"
  else
    SUBMODULE_URL="${SUBMODULE_URL_AZURE_SSH}.git"
  fi

  # Validate Azure URL accessibility; fall back to GitHub via SSH if not accessible
  if remote_accessible "$SUBMODULE_URL"; then
    echo "✅ Azure submodule remote (SSH) is accessible"
  else
    echo "##[warning]⚠️ Azure submodule remote (SSH) not accessible."
    
    # Try Azure HTTPS if token is available
    AZURE_HTTPS_SUCCESS="false"
    if [[ -n "${SYSTEM_ACCESSTOKEN:-}" ]]; then
      echo "🔄 Attempting Azure HTTPS with SYSTEM_ACCESSTOKEN..."
      # Use 'build' as username
      AZURE_HTTPS_URL="https://build:${SYSTEM_ACCESSTOKEN}@dev.azure.com/${AZ_ORG}/${AZ_PROJECT}/_git/ai"
      if remote_accessible "$AZURE_HTTPS_URL"; then
        echo "✅ Azure submodule remote (HTTPS) is accessible"
        SUBMODULE_URL="$AZURE_HTTPS_URL"
        AZURE_HTTPS_SUCCESS="true"
      else
        echo "⚠️ Azure HTTPS access failed"
      fi
    else
      echo "ℹ️ No SYSTEM_ACCESSTOKEN available for Azure HTTPS fallback"
    fi

    if [[ "$AZURE_HTTPS_SUCCESS" != "true" ]]; then
      echo "##[warning]⚠️ Azure remote failed. Falling back to GitHub..."
      SUBMODULE_URL="$SUBMODULE_URL_GITHUB"
      
      # Check GitHub SSH
      if ! remote_accessible "$SUBMODULE_URL"; then
         echo "⚠️ GitHub SSH access failed. Checking for GITHUB_TOKEN..."
         # Try GitHub HTTPS
         if [[ -n "${GITHUB_TOKEN:-}" ]]; then
            echo "🔄 Attempting GitHub HTTPS with GITHUB_TOKEN..."
            GITHUB_HTTPS_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/ai.git"
            if remote_accessible "$GITHUB_HTTPS_URL"; then
               echo "✅ GitHub submodule remote (HTTPS) is accessible [x-access-token]"
               SUBMODULE_URL="$GITHUB_HTTPS_URL"
            else
               # Try alternative format: https://<token>@github.com
               echo "⚠️ 'x-access-token' format failed. Retrying with basic token auth..."
               GITHUB_HTTPS_URL_ALT="https://${GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/ai.git"
               if remote_accessible "$GITHUB_HTTPS_URL_ALT"; then
                 echo "✅ GitHub submodule remote (HTTPS) is accessible [token-only]"
                 SUBMODULE_URL="$GITHUB_HTTPS_URL_ALT"
               else
                 echo "❌ GitHub HTTPS access failed (both formats)"
               fi
            fi
         else
            echo "ℹ️ No GITHUB_TOKEN available for GitHub HTTPS fallback"
         fi
      fi
    fi
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

  # SSH-only mode: do not configure HTTPS fallback
else
  echo "Detected external/GitHub environment. Using GitHub submodule URL."
  SUBMODULE_URL="$SUBMODULE_URL_GITHUB"
  # SSH-only mode: GitHub authentication relies on SSH keys; no HTTPS credential helper is configured
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    echo "ℹ️ Using SSH; ensure GitHub deploy keys or agent SSH keys are configured."
  fi
fi

# Update git config for this repo only to override submodule URL
# Update git config for this repo only to override submodule URL
# Redact token from log output
SAFE_URL="$SUBMODULE_URL"
if [[ -n "${SYSTEM_ACCESSTOKEN:-}" ]]; then
  SAFE_URL="${SAFE_URL//$SYSTEM_ACCESSTOKEN/***}"
fi
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  SAFE_URL="${SAFE_URL//$GITHUB_TOKEN/***}"
fi
echo "Submodule URL selected: $SAFE_URL"

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
echo "Running: git submodule update --init --recursive --force"
# Using --init ensures it attempts initialization if not already done; --force resets local changes in CI
git submodule update --init --recursive --force

echo "✅ Submodule initialization complete"
