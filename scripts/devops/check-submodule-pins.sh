#!/usr/bin/env bash
# Pre-push guard: every submodule gitlink the parent is about to publish
# must be fetchable from the submodule's GitHub mirror (the .gitmodules
# URL). CI's init-submodules.sh fetches from that URL, so an
# unpublished pin fails three workflows with "not our ref" AFTER the
# push is already public — this check moves the failure to before it.
#
# Run from the repo root (or anywhere; paths are resolved).
# Exit 0: all pins published (or checks explicitly skipped).
# Exit 1: at least one pin is not on its mirror — the push is refused.
#
# SKIP_PUSH_CHECKS=true disables (same escape hatch as the rest of the
# pre-push hook). Network failures fail OPEN with a warning: a flaky
# connection must not block verified work.

set -uo pipefail

if [ "${SKIP_PUSH_CHECKS:-}" = "true" ]; then
  echo "  [gitlink] Skipping submodule pin check (SKIP_PUSH_CHECKS is true)"
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

if [ ! -f .gitmodules ]; then
  exit 0
fi

fail=0
# Every submodule in .gitmodules (path<TAB>url), pins resolved from the
# parent index — the same source `git push` will publish.
while IFS=$'\t' read -r sub_path sub_url; do
  [ -z "$sub_path" ] && continue
  pin="$(git ls-tree HEAD "$sub_path" | awk '{print $3}')"
  if [ -z "$pin" ]; then
    continue
  fi
  if [ ! -e "$sub_path/.git" ]; then
    echo "  [gitlink] $sub_path: submodule not checked out locally — skipping"
    continue
  fi
  if ! git -C "$sub_path" cat-file -e "$pin^{commit}" 2>/dev/null; then
    echo "  [gitlink] $sub_path: pin $pin not present locally — skipping"
    continue
  fi
  # Fast-bool: if a remote-tracking ref of the mirror already contains
  # the pin, no network round-trip is needed.
  if git -C "$sub_path" branch -r --contains "$pin" 2>/dev/null | grep -q .; then
    echo "  [gitlink] $sub_path: pin $pin published on the mirror"
    continue
  fi
  if ! git -C "$sub_path" fetch --quiet origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null; then
    echo "  [gitlink] $sub_path: could not reach the mirror (offline?) — not blocking"
    continue
  fi
  if git -C "$sub_path" branch -r --contains "$pin" 2>/dev/null | grep -q .; then
    echo "  [gitlink] $sub_path: pin $pin published on the mirror"
  else
    echo "  [gitlink] $sub_path: pin $pin is NOT on the mirror ($sub_url)."
    echo "            Push it before pushing the parent, e.g.:"
    echo "            git -C $sub_path push origin HEAD:staging   # (use the submodule's default branch)"
    fail=1
  fi
done < <(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' | awk -F' ' '{print $2}' |
  while read -r p; do printf '%s\t%s\n' "$p" "$(git config -f .gitmodules --get submodule.$p.url)"; done)

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "❌ Refusing to push: submodule pin(s) not on their mirrors."
  echo "   See docs/runbooks.md §8. Fast-forward the mirror, then re-push."
  exit 1
fi
exit 0
