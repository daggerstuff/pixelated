#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# init-submodules.sh
# ---------------------------------------------------------------------------
# Robust submodule initialization for Pixelated Empathy.
# Defaults to GitHub source repositories.
# ---------------------------------------------------------------------------

echo "🚀 Starting Pixelated Submodule Initialization"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run mode enabled]"
fi

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
cd "${PROJECT_ROOT}"

sanitize_token() {
  local token="${1:-}"
  case "${token}" in
    ""|'$('*) printf '' ;;
    *) printf '%s' "${token}" ;;
  esac
}

# ---------------------------------------------------------------------------
# Authentication Configuration
# ---------------------------------------------------------------------------
AUTH_GIT_ARGS=()

configure_credentials() {
  # GitHub Credentials (via GITHUB_PAT or GITHUB_TOKEN)
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
# Dynamically get list of submodules from .gitmodules
SUBMODULE_NAMES=$(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | awk -F. '{print $2}')

for name in ${SUBMODULE_NAMES}; do
  path="$(git config -f .gitmodules --get "submodule.${name}.path" || echo "${name}")"
  # Use the URL from .gitmodules as the source of truth
  url="$(git config -f .gitmodules --get "submodule.${name}.url")"
  
  echo "🔧 Configuring submodule '${name}' at '${path}'"
  echo "   URL: ${url}"
  
  # Set the URL directly in .git/config
  run git config "submodule.${name}.url" "${url}"

  if [[ -d "${path}/.git" ]]; then
    run git -C "${path}" remote set-url origin "${url}" 2>/dev/null || true
  elif [[ -f "${path}/.git" ]]; then
    gitdir_content=$(cat "${path}/.git")
    if [[ "${gitdir_content}" == "gitdir: "* ]]; then
      gitdir="${gitdir_content#gitdir: }"
      if [[ "${gitdir}" != /* ]]; then
        gitdir="$(cd "${path}" && cd "${gitdir}" && pwd)"
      fi
      if [[ -d "${gitdir}" ]]; then
        run git -C "${path}" remote set-url origin "${url}" 2>/dev/null || true
      fi
    fi
  fi

  modules_config="${PROJECT_ROOT}/.git/modules/${name}/config"
  if [[ -f "${modules_config}" ]]; then
    run git -C ".git/modules/${name}" config remote.origin.url "${url}" 2>/dev/null || true
  fi
done

# 3. Update (fetch and checkout)
echo "📥 Updating submodules (depth=1)..."
if ! git_with_auth submodule update --recursive --force --depth 1; then
  echo "##[warning]Shallow submodule update failed. Retrying with full history..."
  git_with_auth submodule update --recursive --force
fi

echo "✅ Submodule initialization complete!"
