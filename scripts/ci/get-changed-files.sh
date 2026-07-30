#!/usr/bin/env bash
# scripts/ci/get-changed-files.sh
#
# Collect changed files from a GitHub Actions event into a file.
# Determines the diff base from PR_BASE_SHA, GITHUB_EVENT_BEFORE, or falls
# back to the full commit tree.
#
# Usage: get-changed-files.sh [output-path]
#   output-path   File to write changed file list (default: /tmp/changed_files.txt)
#
# Exit codes:
#   0 — files collected successfully (or none changed)
#   1 — failed to collect changed files
#
# Required env:
#   GITHUB_SHA  — current commit SHA

set -euo pipefail

OUTPUT_PATH="${1:-/tmp/changed_files.txt}"
: "${OUTPUT_PATH:?missing output path}"

if [ -z "${GITHUB_SHA:-}" ]; then
  echo "Error: GITHUB_SHA is empty; cannot determine changed files."
  exit 1
fi

ensure_object_exists() {
  local sha="$1"
  if [ -z "$sha" ]; then
    return 1
  fi
  if git cat-file -e "$sha" 2>/dev/null; then
    return 0
  fi
  echo "Warning: Commit $sha is not present locally. Attempting to fetch..."
  if git fetch origin "$sha" --depth=1 2>/dev/null || git fetch origin "$sha" 2>/dev/null; then
    if git cat-file -e "$sha" 2>/dev/null; then
      return 0
    fi
  fi
  echo "Warning: Failed to fetch commit $sha."
  return 1
}

if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ] && [ -n "${PR_BASE_SHA:-}" ] && ensure_object_exists "$PR_BASE_SHA"; then
  git diff --name-only "$PR_BASE_SHA" "$GITHUB_SHA" > "$OUTPUT_PATH"
elif [ -n "${GITHUB_EVENT_BEFORE:-}" ] && [ "$GITHUB_EVENT_BEFORE" != "0000000000000000000000000000000000000000" ] && ensure_object_exists "$GITHUB_EVENT_BEFORE"; then
  git diff --name-only "$GITHUB_EVENT_BEFORE" "$GITHUB_SHA" > "$OUTPUT_PATH"
else
  echo "Using fallback: collecting changed files from commit $GITHUB_SHA using git show."
  if ! git show --name-only --pretty=format: "$GITHUB_SHA" > "$OUTPUT_PATH"; then
    echo "Error: Failed to collect changed files from commit $GITHUB_SHA."
    exit 1
  fi
fi

if [ -s "$OUTPUT_PATH" ]; then
  echo "Collected $(wc -l < "$OUTPUT_PATH") changed file(s) into $OUTPUT_PATH."
else
  echo "No files changed in this commit."
fi
