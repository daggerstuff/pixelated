#!/usr/bin/env bash

set -euo pipefail

# Verify that the manifest + lockfile pair *being committed* (the git index)
# is coherent, without touching (or reading) the working tree.
#
# Why not the working tree: regenerating the lockfile from the working-tree
# package.json silently sweeps an unstaged, in-progress manifest from a
# parallel session into whatever commit is running. The pair that must be
# coherent is (index manifest, index lockfile) — everything else is the
# post-sync hook's job.
#
# Method: export the manifests and the staged lockfile from the index into a
# temp dir, regenerate there with `pnpm install --lockfile-only`, and diff
# against the staged lockfile. On mismatch the hook fails with instructions;
# it never stages or writes anything itself.

# Defensive toolchain pinning: this script shells out to `pnpm`, which on
# many developer machines is a /bin/sh wrapper that does `exec node`. If
# PATH resolves `node` to a system Node v20 (missing `node:sqlite`) and
# pnpm is >= 11.12.0 (which requires Node >= 22.13), pnpm crashes before
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

repo_root="$(pwd)"
tmp_root=""
failed=0

cleanup() {
  [ -n "$tmp_root" ] && rm -rf "$tmp_root"
}
trap cleanup EXIT

# Run git against a submodule. Hooks may be invoked with GIT_DIR (and
# friends) pointing at the PARENT repo, which would make `git -C <sub>` read
# the parent's index instead of the submodule's. Neutralize them in a
# subshell. (Deliberately not `env -u ...`: some machines have an `env`
# shim early in PATH that silently breaks `env -u` invocations.)
subgit() {
  local sub="$1"
  shift
  (
    unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
    git -C "$repo_root/$sub" "$@"
  )
}

# Export one file from the git index into "$tmp_root". Files that are not
# tracked (.npmrc is machine-local) are simply skipped.
export_index_file() {
  git checkout-index -f --prefix="$tmp_root/" -- "$1" >/dev/null 2>&1 || true
}

# Verify one workspace: regenerate its lockfile from index state and diff
# against the staged lockfile.
verify_workspace() {
  local workspace="$1"
  local package_json_rel="${workspace%/}/package.json"
  local lockfile_rel="${workspace%/}/pnpm-lock.yaml"

  # Only run when the pair exists in the index (a newly added manifest with
  # no lockfile yet is still worth failing on; missing both is skipped).
  if ! git cat-file -e ":$package_json_rel" 2>/dev/null; then
    return 0
  fi
  if ! git cat-file -e ":$lockfile_rel" 2>/dev/null; then
    echo "❌ No staged pnpm-lock.yaml for ${workspace}; the committed manifest would be unsynced."
    failed=1
    return 0
  fi

  echo "Checking lockfile sync for ${workspace} (staged state only)..."
  # For the root workspace pnpm runs at the export root; for a sub-workspace
  # the export preserves the directory layout, so pnpm runs inside it.
  local run_dir
  if [ "$workspace" = "." ]; then
    run_dir="$tmp_root"
  else
    run_dir="$tmp_root/$workspace"
  fi
  mkdir -p "$run_dir"

  if [ "$workspace" = "." ]; then
    # Root workspace: pnpm resolves every workspace manifest via
    # pnpm-workspace.yaml globs. Export all tracked package.json files
    # (a superset of the globs; extras outside the globs are ignored by
    # pnpm) plus the workspace config and any tracked .npmrc.
    while IFS= read -r -d '' f; do
      git checkout-index -f --prefix="$tmp_root/" -- "$f"
    done < <(git ls-files -z -- 'package.json' ':(glob)**/package.json' 'patches/*')
    export_index_file "pnpm-workspace.yaml"
    export_index_file ".npmrc"
    export_index_file ".pnpmfile.cjs"

    # Workspace globs can reach into gitlink submodules (pnpm-workspace.yaml
    # lists foresight/cli, and foresight/ is a submodule). Those manifests
    # are not in the parent index, so export them from each initialized
    # submodule's own index — same staged-state philosophy, one level down.
    while IFS= read -r sub; do
      [ -n "$sub" ] || continue
      if [ -e "$repo_root/$sub/.git" ]; then
        while IFS= read -r -d '' f; do
          subgit "$sub" checkout-index -f --prefix="$tmp_root/$sub/" -- "$f"
        done < <(subgit "$sub" ls-files -z -- 'package.json' ':(glob)**/package.json')
        subgit "$sub" checkout-index -f --prefix="$tmp_root/$sub/" -- pnpm-workspace.yaml >/dev/null 2>&1 || true
      else
        echo "⚠️  Submodule $sub is not initialized; its manifests cannot be exported."
      fi
    done < <(git ls-files -s | awk '$1 == "160000" {print $4}')
  else
    git checkout-index -f --prefix="$tmp_root/" -- "$package_json_rel"
  fi
  git checkout-index -f --prefix="$tmp_root/" -- "$lockfile_rel"

  local sync_log
  sync_log="$(mktemp)"
  if ! (cd "$run_dir" && pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile > "$sync_log" 2>&1); then
    echo "Failed to regenerate the lockfile for ${workspace} from the staged manifest."
    cat "$sync_log"
    rm -f "$sync_log"
    failed=1
    return 0
  fi
  rm -f "$sync_log"

  local expected
  expected="$(mktemp)"
  git show ":$lockfile_rel" > "$expected"
  if ! diff -q "$expected" "$run_dir/pnpm-lock.yaml" >/dev/null; then
    echo "❌ Staged pnpm-lock.yaml for ${workspace} does not match the staged manifest."
    echo "   Your commit changes the dependency state without a matching lockfile."
    echo "   Fix: pnpm install --lockfile-only && git add ${lockfile_rel}"
    echo "   --- diff (staged lockfile vs regenerated from staged manifests, first 20 lines) ---"
    diff "$expected" "$run_dir/pnpm-lock.yaml" | head -20
    echo "   --- end diff ---"
    failed=1
  fi
  rm -f "$expected"
}

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found; cannot verify lockfile sync."
  exit 1
fi

tmp_root="$(mktemp -d)"

workspaces=(
  "."
  "mcp-servers/linear-mcp"
)

for workspace in "${workspaces[@]}"; do
  verify_workspace "$workspace"
done

if [ "$failed" -eq 1 ]; then
  echo "Lockfile verification failed. Stage the regenerated lockfile with your manifest change, then re-run the commit."
  exit 1
fi

exit 0
