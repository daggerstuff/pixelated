#!/usr/bin/env bash

set -euo pipefail

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

