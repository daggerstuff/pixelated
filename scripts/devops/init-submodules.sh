#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

PROJECT_ROOT="${PROJECT_ROOT:-$(git rev-parse --show-toplevel)}"
cd "${PROJECT_ROOT}"

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

is_azure_environment() {
  [[ "${TF_BUILD:-}" == "True" || -n "${SYSTEM_COLLECTIONURI:-}" ]]
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

  if is_azure_environment; then
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

git_submodule_update_command() {
  if is_azure_environment && [[ -n "${SYSTEM_ACCESSTOKEN:-}" ]]; then
    printf '%s\n' \
      git \
      -c \
      "http.https://dev.azure.com/.extraheader=AUTHORIZATION: bearer ${SYSTEM_ACCESSTOKEN}" \
      submodule \
      update \
      --init \
      --recursive \
      --depth \
      1
    return 0
  fi

  printf '%s\n' git submodule update --init --recursive --depth 1
}

run_submodule_update() {
  local -a cmd=()
  mapfile -t cmd < <(git_submodule_update_command)
  run "${cmd[@]}"
}

configure_submodule ai
configure_submodule docs

run git submodule sync --recursive
run_submodule_update
