#!/usr/bin/env bash

set -euo pipefail

# Defensive toolchain pinning: this script shells out to `pnpm`, which on
# many developer machines is a /bin/sh wrapper that does `exec node`. If
# PATH resolves `node` to a system Node v20 (missing `node:sqlite`) and
# pnpm is >= 11.5.2 (which requires Node >= 22.13), pnpm crashes before
# even checking the lockfile. Pin to the nvm-managed node when one is
# available so pnpm always finds a compatible runtime.
if [ -z "${NVM_DIR:-}" ]; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
  elif [ -s "$HOME/.config/nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.config/nvm"
  fi
fi
if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  _nvm_node_dir="$(nvm which current 2>/dev/null | xargs -r dirname || true)"
  if [ -n "${_nvm_node_dir:-}" ] && [ -x "${_nvm_node_dir}/node" ]; then
    _clean_path=""
    IFS=':' read -r -a _path_parts <<< "$PATH"
    for _p in "${_path_parts[@]}"; do
      case ":${_p}:" in
        *":${PNPM_HOME:-/nonexistent}/bin:"*) continue ;;
      esac
      _clean_path="${_clean_path:+${_clean_path}:}${_p}"
    done
    export PATH="${_nvm_node_dir}:${_clean_path}"
    unset _nvm_node_dir _clean_path _path_parts _p
  fi
fi

workspaces=(
  "."
  "mcp-servers/linear-mcp"
)

repo_root="$(pwd)"
updated=0

for workspace in "${workspaces[@]}"; do
  package_json="${repo_root}/${workspace}/package.json"
  lockfile="${repo_root}/${workspace}/pnpm-lock.yaml"

  if [ ! -f "$package_json" ] || [ ! -f "$lockfile" ]; then
    continue
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found; cannot verify lockfile sync for ${workspace}."
    exit 1
  fi

  echo "Checking lockfile sync for ${workspace}..."
  sync_log="$(mktemp)"
  if ! (cd "$workspace" && pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile > "$sync_log" 2>&1); then
    echo "Failed to update lockfile sync for ${workspace}."
    cat "$sync_log"
    rm -f "$sync_log"
    exit 1
  fi
  rm -f "$sync_log"

  if ! git diff --quiet -- "$lockfile"; then
    updated=1
    echo "Updated lockfile in workspace ${workspace}. Review and stage it before committing."
    git add "$lockfile"
  fi
done

if [ "$updated" -eq 1 ]; then
  echo "Lockfiles were updated. Re-run commit after reviewing staged changes."
  exit 1
fi

exit 0

