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
      -c "url.https://x-access-token:${github_token}@github.com/.insteadOf=git@github.com:"
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
# Submodule Recovery
# ---------------------------------------------------------------------------
# When a submodule's pinned commit has been force-pushed out of the remote,
# fall back to the configured branch (or remote HEAD) so CI can proceed.
# ---------------------------------------------------------------------------

recover_submodule() {
  local name="$1"
  local path="$2"
  local url="$3"
  local branch="${4:-}"

  echo "##[warning]Recovering submodule '${name}' at '${path}'..."

  if [[ -n "${branch}" ]]; then
    echo "  → Trying remote branch '${branch}'..."
    if git_with_auth submodule update --force --init --remote "${path}" 2>/dev/null; then
      run git -C "${path}" checkout "${branch}" 2>/dev/null || true
      echo "  ✅ Recovered via remote tracking (branch: ${branch})"
      return 0
    fi
  else
    echo "  → Trying remote HEAD..."
    if git_with_auth submodule update --force --init --remote "${path}" 2>/dev/null; then
      echo "  ✅ Recovered via remote tracking (HEAD)"
      return 0
    fi
  fi

  echo "  → Trying direct clone..."
  run rm -rf "${path}" 2>/dev/null || true
  run mkdir -p "$(dirname "${path}")" 2>/dev/null || true

  if [[ -n "${branch}" ]]; then
    if git_with_auth clone --branch "${branch}" --single-branch "${url}" "${path}" 2>/dev/null; then
      echo "  ✅ Recovered via direct clone (branch: ${branch})"
      return 0
    fi
  fi

  if git_with_auth clone --single-branch "${url}" "${path}" 2>/dev/null; then
    echo "  ✅ Recovered via direct clone (default branch)"
    return 0
  fi

  echo "  ❌ Failed to recover submodule '${name}'"
  return 1
}

recover_failed_submodules() {
  local all_recovered=true

  for name in ${SUBMODULE_NAMES}; do
    path="$(git config -f .gitmodules --get "submodule.${name}.path" || echo "${name}")"
    url="$(git config -f .gitmodules --get "submodule.${name}.url")"
    branch="$(git config -f .gitmodules --get "submodule.${name}.branch" || echo "")"

    # Check submodule status: leading '-' means pinned commit is not fetched
    local status_line
    status_line=$(git submodule status -- "${path}" 2>/dev/null || true)
    local status_char="${status_line:0:1}"

    # '-' = registered but never fetched/checked out; '+' = fetched but the
    # worktree sha does not match the recorded gitlink (the #5743 ghost-pin
    # signature: fetch succeeds, checkout of the missing pin fails, leaving a
    # broken tree that the old code reported as recovered). Both states mean
    # the tree does NOT contain what the superproject records -> recover.
    if [[ "${status_char}" == "-" || "${status_char}" == "+" ]]; then
      if ! recover_submodule "${name}" "${path}" "${url}" "${branch}"; then
        all_recovered=false
      fi
    fi
  done

  if [[ "${all_recovered}" == "false" ]]; then
    echo "##[error]One or more submodules could not be recovered"
    return 1
  fi

  echo "✅ All submodules recovered successfully"
}

# ---------------------------------------------------------------------------
# Main Execution
# ---------------------------------------------------------------------------
configure_credentials

# ---------------------------------------------------------------------------
# Pointer Guard (strict by default)
# ---------------------------------------------------------------------------
# Fail fast BEFORE touching submodules when a pinned gitlink cannot be served
# by its upstream remote. Prevents the #5743 class of incident: a ghost pin
# lands on a shared branch while recovery logic masks it as success.
# Emergencies only:  SUBMODULE_PIN_STRICT=false ./scripts/devops/init-submodules.sh
# ---------------------------------------------------------------------------
GUARD_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-submodule-pointers.sh"
if [[ -f "${GUARD_SCRIPT}" ]]; then
  if [[ "${SUBMODULE_PIN_STRICT:-true}" == "true" ]]; then
    echo "Validating submodule pointers..."
    if ! bash "${GUARD_SCRIPT}" HEAD; then
      echo "##[error]Submodule pointer validation FAILED - refusing to initialize against unresolvable pins."
      echo "##[error]Fix the pointer(s) above (push missing commits or repoint the gitlink),"
      echo "##[error]or export SUBMODULE_PIN_STRICT=false to bypass (discouraged, masks breakage)."
      exit 1
    fi
  else
    echo "[skip-guard] SUBMODULE_PIN_STRICT=false - pointer validation skipped (legacy fallback mode)."
  fi
fi

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
  if ! git_with_auth submodule update --recursive --force; then
    echo "##[warning]Full submodule update failed. Attempting per-submodule recovery..."
    recover_failed_submodules
  fi
fi

echo "✅ Submodule initialization complete!"
