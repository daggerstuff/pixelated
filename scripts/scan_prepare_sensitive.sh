#!/usr/bin/env bash
# scan_prepare_sensitive.sh
#
# Temporarily move credential/sensitive files out of a repo before running a
# quality-score scan (so no secrets sit in the tree during analysis), then restore
# them afterward. The stash keeps each file's repo-relative path so restore is exact.
#
# Usage:
#   scan_prepare_sensitive.sh prepare <repo> [stash_root]   move sensitive files out
#   scan_prepare_sensitive.sh restore <repo> [stash_root]   put them back
#
# Sensitive basenames handled: .env*, .envrc, *.key, *.pem, *.p12, *.pfx, id_rsa*,
# id_ed25519*, credentials.json, secrets.json, service-account*.json.
# Safe templates (.env.example/.sample/.template) are always kept.
# Dependency/build dirs (.git, node_modules, .venv, venv, dist, build, .next,
# __pycache__) are never descended into.

set -euo pipefail

usage() { echo "usage: $0 prepare|restore <repo> [stash_root]" >&2; exit 1; }

MODE="${1:-}"
REPO="${2:-$(pwd)}"
STASH_ROOT="${3:-/tmp/predev-sensitive-stash}"

case "$MODE" in prepare|restore) ;; *) usage ;; esac

REPO_ABS="$(cd "$REPO" && pwd)"
STASH="$STASH_ROOT/$(basename "$REPO_ABS")"

list_sensitive() {
  find "$REPO_ABS" \
    \( \( -name .git -o -name node_modules -o -name .venv -o -name venv \
        -o -name dist -o -name build -o -name .next -o -name __pycache__ \) -prune \) -o \
    -type f \( -name '.env' -o -name '.env.*' -o -name '.envrc' \
              -o -name '*.key' -o -name '*.pem' -o -name '*.p12' -o -name '*.pfx' \
              -o -name 'id_rsa' -o -name 'id_rsa.*' -o -name 'id_ed25519' -o -name 'id_ed25519.*' \
              -o -name 'credentials.json' -o -name 'secrets.json' -o -name 'service-account*.json' \) \
    -print 2>/dev/null | while IFS= read -r f; do
      case "$(basename "$f")" in
        .env.example|.env.sample|.env.template) continue ;;
      esac
      printf '%s\n' "${f#"$REPO_ABS"/}"
    done
}

if [ "$MODE" = prepare ]; then
  mkdir -p "$STASH"
  list_sensitive | while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    dest="$STASH/$rel"
    mkdir -p "$(dirname "$dest")"
    mv -n "$REPO_ABS/$rel" "$dest" && echo "moved: $rel"
  done
  echo "stash dir: $STASH"
else
  [ -d "$STASH" ] || { echo "no stash at $STASH" >&2; exit 1; }
  (cd "$STASH" && find . -type f) | while IFS= read -r rel; do
    rel="${rel#./}"
    [ -n "$rel" ] || continue
    mkdir -p "$(dirname "$REPO_ABS/$rel")"
    mv -n "$STASH/$rel" "$REPO_ABS/$rel" && echo "restored: $rel"
  done
fi
