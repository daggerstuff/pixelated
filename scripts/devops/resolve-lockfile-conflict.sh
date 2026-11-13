#!/usr/bin/env bash
# Resolve a pnpm-lock.yaml merge conflict by regeneration, not by hand.
#
# The lockfile is a pure function of the workspace manifests
# (package.json files + pnpm-workspace.yaml). Any apparent "conflict" in
# it is an artifact of two branches churning the same serialized graph —
# the correct merged lockfile is whatever pnpm generates from the
# MERGED manifests. Hand-merging produces broken states that CI then
# rejects; this script never looks at the conflict markers at all.
#
# Usage (while a merge or rebase is in progress and pnpm-lock.yaml is conflicted):
#   scripts/devops/resolve-lockfile-conflict.sh
#   scripts/devops/resolve-lockfile-conflict.sh --add   # also `git add`s the result
#
# What it does:
#   1. Refuses to run outside a conflicted merge or rebase (nothing to resolve).
#   2. Seeds the lockfile from the incoming side so the regenerated diff is
#      minimal — any side would be correct, but the seed decides which pins
#      survive, so it has to be the upstream one. In a merge that is MERGE_HEAD;
#      in a rebase it is HEAD, because the commit being replayed is the "ours"
#      side there and REBASE_HEAD holds the old base's pins.
#   3. Regenerates: pnpm install --lockfile-only (updates the lockfile
#      to match the merged package.json + pnpm-workspace.yaml).
#   4. Optionally stages the result. Finish the merge or rebase as usual after.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1
LOCKFILE="pnpm-lock.yaml"

do_add=false
if [ "${1:-}" = "--add" ]; then do_add=true; fi

in_merge=false
in_rebase=false
if [ -e .git/MERGE_HEAD ] || [ -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then in_merge=true; fi
if git rev-parse -q --verify REBASE_HEAD >/dev/null 2>&1; then in_rebase=true; fi

if [ "$in_merge" = false ] && [ "$in_rebase" = false ]; then
  echo "❌ No merge or rebase in progress. This script resolves lockfile conflicts in one of those."
  echo "   To re-sync a stale (unconflicted) lockfile, run: pnpm install --lockfile-only"
  exit 1
fi

if ! git diff --name-only --diff-filter=U | grep -qx "$LOCKFILE"; then
  echo "✓ $LOCKFILE is not conflicted — nothing to do."
  exit 0
fi

if [ "$in_rebase" = true ]; then
  echo "→ Seeding $LOCKFILE from the new base (HEAD)"
  git checkout HEAD -- "$LOCKFILE"
else
  echo "→ Seeding $LOCKFILE from the incoming side (MERGE_HEAD)"
  git checkout MERGE_HEAD -- "$LOCKFILE"
fi

echo "→ Regenerating $LOCKFILE from the merged manifests"
pnpm install --lockfile-only

if git diff --name-only --diff-filter=U | grep -qx "$LOCKFILE"; then
  echo "❌ $LOCKFILE is still marked conflicted after regeneration — unexpected, refusing to stage."
  exit 1
fi

if [ -n "$(git status --porcelain "$LOCKFILE" | grep -E '^(UU|AA)')" ]; then
  # Unmerged index entries survive a checkout of one side; add resolves them.
  echo "→ Staging $LOCKFILE"
  git add "$LOCKFILE"
elif [ "$do_add" = true ]; then
  echo "→ Staging $LOCKFILE"
  git add "$LOCKFILE"
fi

echo ""
echo "✓ $LOCKFILE regenerated from the merged manifests."
if [ "$in_rebase" = true ]; then
  echo "  Finish the rebase: git rebase --continue   (review the lockfile diff first if you like)."
else
  echo "  Finish the merge: git commit   (review the lockfile diff first if you like)."
fi
