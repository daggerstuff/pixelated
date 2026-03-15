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

echo "No git hooks to install."
