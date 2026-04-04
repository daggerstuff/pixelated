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

has_github_credentials() {
  [[ -n "${GITHUB_PAT:-${GITHUB_TOKEN:-}}" ]]
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
    local token="${SYSTEM_ACCESSTOKEN:-}"
    if [[ -z "${token}" ]]; then
      echo "⚠️  Warning: SYSTEM_ACCESSTOKEN is not set. Azure DevOps internal repo access may fail."
    else
      AUTH_GIT_ARGS+=(
        -c "http.https://dev.azure.com/.extraHeader=AUTHORIZATION: bearer ${token}"
        -c "http.https://handtransfer.visualstudio.com/.extraHeader=AUTHORIZATION: bearer ${token}"
        # URL rewrite embeds the token directly — works for ls-remote, fetch,
        # submodule update, etc. This is the mechanism that actually makes
        # authentication work; extraHeader alone does not cover ls-remote.
        -c "url.https://x-access-token:${token}@dev.azure.com/.insteadOf=https://dev.azure.com/"
        -c "url.https://x-access-token:${token}@handtransfer.visualstudio.com/.insteadOf=https://handtransfer.visualstudio.com/"
      )
      echo "✅ Azure DevOps credentials configured via per-command headers"
    fi
  fi

  # 2. GitHub Credentials (via GITHUB_PAT or GITHUB_TOKEN)
  local github_token="${GITHUB_PAT:-${GITHUB_TOKEN:-}}"
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

github_repo_url() {
  local repo_name="$1"
  printf 'https://github.com/daggerstuff/%s.git' "${repo_name}"
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
    local azure_url
    local github_url
    azure_url="$(azure_repo_url "${name}")"
    github_url="$(github_repo_url "${name}")"

    # Prefer the Azure mirror, but only when it is actually reachable by the
    # current CI identity. This keeps Azure-hosted repos authoritative while
    # still preserving GitHub fallback when a mirror is missing or inaccessible.
    if remote_is_accessible "${azure_url}"; then
      printf '%s' "${azure_url}"
      return 0
    fi

    echo "##[warning]Azure mirror for submodule '${name}' is not accessible. Falling back." >&2

    if has_github_credentials && remote_is_accessible "${github_url}"; then
      printf '%s' "${github_url}"
      return 0
    fi

    if [[ "${original_url}" == *"github.com"* ]] && has_github_credentials && remote_is_accessible "${original_url}"; then
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

# 2. Configure URLs for target submodules BEFORE fetching
# This MUST happen before submodule update to ensure Git fetches from the right remote.
for name in ai docs; do
  path="$(git config -f .gitmodules --get "submodule.${name}.path" || echo "${name}")"
  url="$(select_submodule_url "${name}")"

  echo "🔧 Configuring submodule '${name}' at '${path}'"
  echo "   URL: ${url}"

  # Set the URL in .git/config to override .gitmodules
  run git config "submodule.${name}.url" "${url}"

  # Update the submodule's internal remote URL if it exists.
  # This handles both embedded .git dirs and .git file pointers.
  if [[ -d "${path}/.git" ]]; then
    run git -C "${path}" remote set-url origin "${url}" 2>/dev/null || true
  elif [[ -f "${path}/.git" ]]; then
    # When .git is a file, it points to the actual gitdir in .git/modules/
    gitdir="$(sed 's/gitdir: //' "${path}/.git")"
    if [[ -d "${gitdir}" ]]; then
      run git -C "${path}" remote set-url origin "${url}" 2>/dev/null || true
    fi
  fi

  # CRITICAL: Also update the URL in .git/modules/${name}/config if it exists.
  # Git's submodule update reads from this file, not just .git/config.
  # If this still has the old GitHub URL, the fetch will fail.
  modules_config="${PROJECT_ROOT}/.git/modules/${name}/config"
  if [[ -f "${modules_config}" ]]; then
    run git -C ".git/modules/${name}" config remote.origin.url "${url}" 2>/dev/null || true
  fi
done

# 3. Update (fetch and checkout)
echo "📥 Updating submodules (depth=1)..."
if ! git_with_auth submodule update --recursive --force --depth 1; then
  echo "##[warning]Shallow submodule update failed. Retrying with full history for pinned commit checkout..."
  git_with_auth submodule update --recursive --force
fi

echo "✅ Submodule initialization complete!"
