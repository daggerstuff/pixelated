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

sanitize_token() {
  local token="${1:-}"

  case "${token}" in
    ""|'$('*) printf '' ;;
    *) printf '%s' "${token}" ;;
  esac
}

has_github_credentials() {
  local github_token
  github_token="$(sanitize_token "${GITHUB_PAT:-${GITHUB_TOKEN:-}}")"
  [[ -n "${github_token}" ]]
}

remote_is_accessible() {
  local remote_url="$1"
  git_with_auth ls-remote --exit-code "${remote_url}" HEAD >/dev/null 2>&1
}

is_allowed_override_url() {
  local name="$1"
  local url="$2"

  case "${name}" in
    ai|docs) ;;
    *)
      return 1
      ;;
  esac

  case "${url}" in
    "https://github.com/daggerstuff/${name}.git"|\
    "https://dev.azure.com/handtransfer/pixelated/_git/${name}"|\
    "git@ssh.dev.azure.com:v3/handtransfer/pixelated/${name}"|\
    "https://bitbucket.org/slimshadyme/${name}.git"|\
    "git@bitbucket.org:slimshadyme/${name}.git")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Authentication Configuration
# ---------------------------------------------------------------------------
AUTH_GIT_ARGS=()

configure_credentials() {
  # 1. Azure DevOps Credentials
  if is_azure_environment; then
    local token
    token="$(sanitize_token "${SYSTEM_ACCESSTOKEN:-}")"
    if [[ -z "${token}" ]]; then
      echo "⚠️  Warning: SYSTEM_ACCESSTOKEN is not set. Azure DevOps internal repo access may fail."
    else
      AUTH_GIT_ARGS+=(
        -c "http.https://dev.azure.com/.extraHeader=AUTHORIZATION: bearer ${token}"
        -c "http.https://handtransfer.visualstudio.com/.extraHeader=AUTHORIZATION: bearer ${token}"
      )
      echo "✅ Azure DevOps credentials configured via per-command headers"
    fi
  fi

  # 2. GitHub Credentials (via GITHUB_PAT or GITHUB_TOKEN)
  local github_token
  github_token="$(sanitize_token "${GITHUB_PAT:-${GITHUB_TOKEN:-}}")"
  if [[ -n "${github_token}" ]]; then
    echo "🔑 Configuring GitHub credentials..."
    local auth_header
    auth_header="$(printf 'x-access-token:%s' "${github_token}" | base64 -w0)"
    
    AUTH_GIT_ARGS+=(
      -c "http.https://github.com/.extraHeader=AUTHORIZATION: basic ${auth_header}"
      -c "credential.helper="
      -c "url.https://x-access-token:${github_token}@github.com/.insteadOf=https://github.com/"
    )
    echo "✅ GitHub credentials configured"
  fi
}

cleanup_credentials() {
  if (( ${#AUTH_GIT_ARGS[@]} > 0 )); then
    AUTH_GIT_ARGS=()
    echo "🧹 Temporary Git credential headers cleared"
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

is_relative_submodule_url() {
  case "${1:-}" in
    ../*|./*) return 0 ;;
    *) return 1 ;;
  esac
}

select_submodule_url() {
  local name="$1"
  local env_override_key="$(printf '%s_SUBMODULE_URL' "$(printf '%s' "${name}" | tr '[:lower:]' '[:upper:]')")"

  # 1. Priority: Environment Override
  if [[ -n "${!env_override_key:-}" ]]; then
    local override_url="${!env_override_key}"

    if ! is_allowed_override_url "${name}" "${override_url}"; then
      echo "##[error]Rejected unsafe override URL for submodule '${name}': ${override_url}" >&2
      exit 1
    fi

    printf '%s' "${override_url}"
    return 0
  fi

  # 2. Get original from .gitmodules
  local original_url
  original_url="$(git config -f .gitmodules --get "submodule.${name}.url")"

  # 3. Azure Environment Logic
  if is_azure_environment; then
    if is_relative_submodule_url "${original_url}"; then
      printf '%s' "${original_url}"
      return 0
    fi

    local azure_url
    azure_url="$(azure_repo_url "${name}")"

    # Azure CI should prefer Azure-hosted mirrors to keep the superproject and
    # submodule source of truth aligned.
    if remote_is_accessible "${azure_url}"; then
      printf '%s' "${azure_url}"
      return 0
    fi

    echo "##[warning]Azure mirror for submodule '${name}' is not accessible. Falling back." >&2

    if [[ "${original_url}" == *"github.com"* ]] && has_github_credentials; then
      printf '%s' "${original_url}"
      return 0
    fi

    if remote_is_accessible "${original_url}"; then
      printf '%s' "${original_url}"
      return 0
    fi

    # Return the Azure mirror as the final value so the caller fails with the
    # correct remote if neither candidate is reachable.
    printf '%s' "${azure_url}"
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

git_with_auth() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    run git "${AUTH_GIT_ARGS[@]}" "$@"
    return 0
  fi

  git "${AUTH_GIT_ARGS[@]}" "$@"
}

# ---------------------------------------------------------------------------
# Main Execution
# ---------------------------------------------------------------------------
configure_credentials

# 1. Pre-initialize submodules to register them in .git/config
echo "📦 Initializing submodules..."
git_with_auth submodule init
git_with_auth submodule sync --recursive

# 2. Configure URLs for target submodules
for name in ai docs; do
  path="$(git config -f .gitmodules --get "submodule.${name}.path" || echo "${name}")"
  url="$(select_submodule_url "${name}")"
  
  echo "🔧 Configuring submodule '${name}' at '${path}'"
  echo "   URL: ${url}"
  
  # Set the URL directly in .git/config to override .gitmodules
  run git config "submodule.${name}.url" "${url}"

  if [[ -d "${path}/.git" ]]; then
    run git -C "${path}" remote set-url origin "${url}" 2>/dev/null || true
  elif [[ -f "${path}/.git" ]]; then
    gitdir="$(sed 's/gitdir: //' "${path}/.git")"
    if [[ "${gitdir}" != /* ]]; then
      gitdir="$(cd "${path}" && cd "${gitdir}" && pwd)"
    fi
    if [[ -d "${gitdir}" ]]; then
      run git -C "${path}" remote set-url origin "${url}" 2>/dev/null || true
    fi
  fi

  modules_config="${PROJECT_ROOT}/.git/modules/${name}/config"
  if [[ -f "${modules_config}" ]]; then
    run git -C ".git/modules/${name}" config remote.origin.url "${url}" 2>/dev/null || true
  fi
done

git_with_auth submodule sync --recursive

# 3. Update (fetch and checkout)
echo "📥 Updating submodules (depth=1)..."
if ! git_with_auth submodule update --recursive --force --depth 1; then
  echo "##[warning]Shallow submodule update failed. Retrying with full history for pinned commit checkout..."
  git_with_auth submodule update --recursive --force
fi

echo "✅ Submodule initialization complete!"
