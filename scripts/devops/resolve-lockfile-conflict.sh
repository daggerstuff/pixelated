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
# Usage (while a merge is in progress and pnpm-lock.yaml is conflicted):
#   scripts/devops/resolve-lockfile-conflict.sh
#   scripts/devops/resolve-lockfile-conflict.sh --add   # also `git add`s the result
#
# What it does:
#   1. Refuses to run outside a conflicted merge (nothing to resolve).
#   2. Seeds the lockfile from the incoming side (MERGE_HEAD) so the
#      regenerated diff is minimal — any side would be correct.
#   3. Regenerates: pnpm install --lockfile-only (updates the lockfile
#      to match the merged package.json + pnpm-workspace.yaml).
#   4. Optionally stages the result. Commit the merge as usual after.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1
LOCKFILE="pnpm-lock.yaml"

do_add=false
if [ "${1:-}" = "--add" ]; then do_add=true; fi

if [ ! -e .git/MERGE_HEAD ] && [ ! -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then
  echo "❌ No merge in progress. This script resolves lockfile conflicts in a conflicted merge."
  echo "   To re-sync a stale (unconflicted) lockfile, run: pnpm install --lockfile-only"
  exit 1
fi

if ! git diff --name-only --diff-filter=U | grep -qx "$LOCKFILE"; then
  echo "✓ $LOCKFILE is not conflicted in this merge — nothing to do."
  exit 0
fi

echo "→ Seeding $LOCKFILE from the incoming side (MERGE_HEAD)"
git checkout MERGE_HEAD -- "$LOCKFILE"

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
echo "  Finish the merge: git commit   (review the lockfile diff first if you like)."
