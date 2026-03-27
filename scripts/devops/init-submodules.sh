#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
cd "${PROJECT_ROOT}"

# ---------------------------------------------------------------------------
# Azure Pipelines authentication
# When running inside Azure Pipelines (TF_BUILD=True), inject the pipeline
# OAuth token as a git extraheader so HTTPS submodule clones can authenticate
# without interactive prompts. The token is cleared after use.
# Note: Uses --global scope so submodules inherit the credential configuration
# ---------------------------------------------------------------------------
_AZ_AUTH_CONFIGURED=false
configure_azure_credentials() {
  if [[ "${TF_BUILD:-}" == "True" || -n "${SYSTEM_COLLECTIONURI:-}" ]]; then
    local token="${SYSTEM_ACCESSTOKEN:-}"
    if [[ -z "${token}" ]]; then
      echo '##vso[task.logissue type=error]SYSTEM_ACCESSTOKEN is empty. Expose it via env: SYSTEM_ACCESSTOKEN: $(System.AccessToken) and enable OAuth token access for the pipeline/job.'
      exit 1
    fi
    # Use extraHeader for Bearer token authentication. This is more secure than
    # embedding the token in the URL and more reliable to clean up.
    # Using --global so submodule clones inherit this configuration
    git config --global "http.https://dev.azure.com/.extraHeader" "AUTHORIZATION: bearer ${token}"
    # Also configure for the legacy visualstudio.com endpoint
    git config --global "http.https://handtransfer.visualstudio.com/.extraHeader" "AUTHORIZATION: bearer ${token}"
    _AZ_AUTH_CONFIGURED=true
    echo 'Azure DevOps git credential header (extraHeader) configured globally.'
  fi
}

cleanup_azure_credentials() {
  if [[ "${_AZ_AUTH_CONFIGURED}" == "true" ]]; then
    git config --global --unset "http.https://dev.azure.com/.extraHeader" 2>/dev/null || true
    git config --global --unset "http.https://handtransfer.visualstudio.com/.extraHeader" 2>/dev/null || true
    echo 'Azure DevOps git credential header (extraHeader) cleared.'
  fi
}
trap cleanup_azure_credentials EXIT

configure_azure_credentials

run() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    printf '[dry-run] %q' "$1"
    shift
    for arg in "$@"; do
      printf ' %q' "${arg}"
    done
    printf '\n'
    return 0
  fi

  "$@"
}

azure_repo_url() {
  local repo_name="$1"
  printf 'https://dev.azure.com/handtransfer/pixelated/_git/%s' "${repo_name}"
}

github_repo_url() {
  local repo_name="$1"
  printf 'https://github.com/daggerstuff/%s.git' "${repo_name}"
}

select_submodule_url() {
  local repo_name="$1"
  local env_key="$2"

  if [[ -n "${!env_key:-}" ]]; then
    printf '%s' "${!env_key}"
    return 0
  fi

  if [[ "${TF_BUILD:-}" == "True" || -n "${SYSTEM_COLLECTIONURI:-}" ]]; then
    azure_repo_url "${repo_name}"
    return 0
  fi

  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    github_repo_url "${repo_name}"
    return 0
  fi

  git config -f .gitmodules --get "submodule.${repo_name}.url"
}

configure_submodule() {
  local name="$1"
  local path
  local url

  path="$(git config -f .gitmodules --get "submodule.${name}.path")"
  url="$(select_submodule_url "${name}" "$(printf '%s_SUBMODULE_URL' "$(printf '%s' "${name}" | tr '[:lower:]' '[:upper:]')")")"

  echo "Configuring submodule ${name} (${path}) -> ${url}"
  run git submodule set-url "${path}" "${url}"
}

# Configure URLs for all submodules
configure_submodule ai
configure_submodule docs

# Sync and initialize
# Note: --depth 1 is used for faster cloning in CI environments
run git submodule sync --recursive
run git submodule update --init --recursive --depth 1
