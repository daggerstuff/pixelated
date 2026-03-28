#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# init-submodules.sh
# ---------------------------------------------------------------------------
# Robust submodule initialization for Pixelated Empathy.
# Handles Azure DevOps internal mirrors vs GitHub source repositories.
# ---------------------------------------------------------------------------

echo "🚀 Starting Pixelated Submodule Initialization"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run mode enabled]"
fi

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
cd "${PROJECT_ROOT}"

# ---------------------------------------------------------------------------
# Environment Detection
# ---------------------------------------------------------------------------
is_azure_environment() {
  [[ "${TF_BUILD:-}" == "True" || -n "${SYSTEM_COLLECTIONURI:-}" ]]
}

# ---------------------------------------------------------------------------
# Authentication Configuration
# ---------------------------------------------------------------------------
_AUTH_CONFIGURED=false
_TEMP_GITCONFIG=""

configure_credentials() {
  # 1. Azure DevOps Credentials
  if is_azure_environment; then
    local token="${SYSTEM_ACCESSTOKEN:-}"
    if [[ -z "${token}" ]]; then
      echo "⚠️  Warning: SYSTEM_ACCESSTOKEN is not set. Azure DevOps internal repo access may fail."
    else
      local temp_gitconfig
      temp_gitconfig=$(mktemp "${TMPDIR:-/tmp}/git-azure-creds.XXXXXX")
      git config -f "${temp_gitconfig}" "http.https://dev.azure.com/.extraHeader" "AUTHORIZATION: bearer ${token}"
      git config -f "${temp_gitconfig}" "http.https://handtransfer.visualstudio.com/.extraHeader" "AUTHORIZATION: bearer ${token}"
      
      export GIT_CONFIG_GLOBAL="${temp_gitconfig}"
      _TEMP_GITCONFIG="${temp_gitconfig}"
      _AUTH_CONFIGURED=true
      echo "✅ Azure DevOps credentials configured via GIT_CONFIG_GLOBAL"
    fi
  fi

  # 2. GitHub Credentials (via GITHUB_PAT or GITHUB_TOKEN)
  local github_token="${GITHUB_PAT:-${GITHUB_TOKEN:-}}"
  if [[ -n "${github_token}" ]]; then
    echo "🔑 Configuring GitHub credentials..."
    local auth_header
    auth_header="$(printf 'x-access-token:%s' "${github_token}" | base64 -w0)"
    
    # We use --global for the runner context
    run git config --global "http.https://github.com/.extraheader" "AUTHORIZATION: basic ${auth_header}"
    run git config --global credential.helper ""
    run git config --global url."https://x-access-token:${github_token}@github.com/".insteadOf "https://github.com/"
    echo "✅ GitHub credentials configured"
  fi
}

cleanup_credentials() {
  if [[ "${_AUTH_CONFIGURED}" == "true" ]]; then
    [[ -f "${_TEMP_GITCONFIG}" ]] && rm -f "${_TEMP_GITCONFIG}"
    unset GIT_CONFIG_GLOBAL
    echo "🧹 Azure DevOps credentials cleared"
  fi
  
  if [[ -n "${GITHUB_PAT:-${GITHUB_TOKEN:-}}" ]]; then
    git config --global --unset-all "http.https://github.com/.extraheader" || true
    git config --global --unset-all url."https://x-access-token:${GITHUB_PAT:-${GITHUB_TOKEN:-}}@github.com/".insteadOf || true
    echo "🧹 GitHub credentials cleared"
  fi
}

trap cleanup_credentials EXIT

# ---------------------------------------------------------------------------
# URL Resolution Logic
# ---------------------------------------------------------------------------
azure_repo_url() {
  local repo_name="$1"
  printf 'https://dev.azure.com/handtransfer/pixelated/_git/%s' "${repo_name}"
}

select_submodule_url() {
  local name="$1"
  local env_override_key="$(printf '%s_SUBMODULE_URL' "$(printf '%s' "${name}" | tr '[:lower:]' '[:upper:]')")"

  # 1. Priority: Environment Override
  if [[ -n "${!env_override_key:-}" ]]; then
    printf '%s' "${!env_override_key}"
    return 0
  fi

  # 2. Get original from .gitmodules
  local original_url
  original_url="$(git config -f .gitmodules --get "submodule.${name}.url")"

  # 3. Azure Environment Logic
  if is_azure_environment; then
    # If it's a relative path (doesn't start with http or git@), force to Azure HTTPS mirror
    if [[ "${original_url}" != "http"* && "${original_url}" != "git@"* ]]; then
      azure_repo_url "${name}"
      return 0
    fi
    
    # If it's a GitHub URL, keep it as GitHub (we have GITHUB_PAT)
    if [[ "${original_url}" == *"github.com"* ]]; then
      printf '%s' "${original_url}"
      return 0
    fi

    # Fallback for Azure: use HTTPS mirror
    azure_repo_url "${name}"
    return 0
  fi

  # 4. Default: Use original
  printf '%s' "${original_url}"
}

run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '[dry-run] %q' "$1"
    shift
    for arg in "$@"; do printf ' %q' "${arg}"; done
    printf '\n'
    return 0
  fi
  "$@"
}

# ---------------------------------------------------------------------------
# Main Execution
# ---------------------------------------------------------------------------
configure_credentials

# 1. Pre-initialize submodules to register them in .git/config
echo "📦 Initializing submodules..."
run git submodule init

# 2. Configure URLs for target submodules
for name in ai docs; do
  path="$(git config -f .gitmodules --get "submodule.${name}.path" || echo "${name}")"
  url="$(select_submodule_url "${name}")"
  
  echo "🔧 Configuring submodule '${name}' at '${path}'"
  echo "   URL: ${url}"
  
  # Set the URL directly in .git/config to override .gitmodules
  run git config "submodule.${name}.url" "${url}"
done

# 3. Update (fetch and checkout)
echo "📥 Updating submodules (depth=1)..."
run git submodule update --recursive --force --depth 1

echo "✅ Submodule initialization complete!"
