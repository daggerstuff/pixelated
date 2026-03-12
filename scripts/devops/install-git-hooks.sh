#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "Git is not available; skipping git hook installation."
  exit 0
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not inside a git repository; skipping git hook installation."
  exit 0
fi

if [ ! -d ".beads/hooks" ]; then
  echo "No .beads/hooks directory found; skipping git hook installation."
  exit 0
fi

repo_root="$(git rev-parse --show-toplevel)"
git config core.hooksPath "${repo_root}/.beads/hooks"
echo "Configured Git hooks path to ${repo_root}/.beads/hooks."
