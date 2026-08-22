#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# check-submodule-pointers.sh
# ---------------------------------------------------------------------------
# Fails when any submodule gitlink recorded in <commit-ish> (default HEAD)
# references a commit the upstream repository cannot serve. Prevents
# dangling submodule pointers - pins to unpushed or force-pushed-away
# commits - from landing on a shared branch and breaking every CI job that
# materializes submodules ("upload-pack: not our ref").
#
# Usage:
#   bash scripts/devops/check-submodule-pointers.sh [<commit-ish>]
#
# Env:
#   GITHUB_PAT / GH_TOKEN / GITHUB_TOKEN - optional auth for private repos.
#
# Exit codes: 0 = all pointers resolve; 1 = dangling pointer(s) found;
#             2 = usage/environment error.
# ---------------------------------------------------------------------------

COMMITISH="${1:-HEAD}"

git rev-parse --verify --quiet "${COMMITISH}^{commit}" >/dev/null 2>&1 || {
  echo "check-submodule-pointers: cannot resolve '${COMMITISH}'" >&2
  exit 2
}

mapfile -t NAMES < <(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | awk -F'.' '{print $2}')

if [[ ${#NAMES[@]} -eq 0 ]]; then
  echo "OK: No submodules in .gitmodules - nothing to validate."
  exit 0
fi

fail=0
for name in "${NAMES[@]}"; do
  path="$(git config -f .gitmodules --get "submodule.${name}.path" || echo "${name}")"
  url="$(git config -f .gitmodules --get "submodule.${name}.url")"

  pinned="$(git ls-tree "${COMMITISH}" -- "${path}" | awk '{print $3}')"
  if [[ -z "${pinned}" ]]; then
    echo "WARN: submodule '${name}' (${path}) absent from ${COMMITISH}; skipping."
    continue
  fi

  probe_url="${url}"
  token="${GITHUB_PAT:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
  if [[ -n "${token}" && "${probe_url}" == https://github.com/* ]]; then
    probe_url="https://x-access-token:${token}@github.com/${probe_url#https://github.com/}"
  fi

  scratch="$(mktemp -d)"
  err=""
  if git init -q "${scratch}" && err="$(cd "${scratch}" && git fetch --no-tags --quiet "${probe_url}" "${pinned}" 2>&1)"; then
    echo "PASS ${name}: ${pinned:0:12} resolves upstream (${url})"
  else
    echo "FAIL ${name}: pinned commit ${pinned:0:12} is NOT fetchable from ${url}"
    if [[ -n "${err}" ]]; then
      sanitized="$(printf '%s' "${err}" | tr '\n' ' ' | sed -E 's/x-access-token:[^@ ]+@/***@/g')"
      printf '   server said: %s\n' "${sanitized}"
    fi
    cat <<MSG
   Every git submodule update on this tree fails ("not our ref"). Fix one of:
     a) push the missing commit(s) to ${url}, or
     b) repoint to a resolvable commit, then commit the gitlink:
          git update-index --cacheinfo 160000,<resolvable-sha>,${path}
          git commit -m "fix(submodule): restore resolvable ${name} pointer"
MSG
    fail=1
  fi
  rm -rf "${scratch}"
done

if (( fail )); then
  echo "::error::Dangling submodule pointer(s) detected above. Do not merge/push until fixed."
  exit 1
fi
echo "PASS: All submodule pointers resolve."
