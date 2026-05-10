#!/usr/bin/env bash
set -euo pipefail

OUTPUT_PATH="${1:-/tmp/changed_files.txt}"
: "${OUTPUT_PATH:?missing output path}"

if [ -z "${GITHUB_SHA:-}" ]; then
  echo "Error: GITHUB_SHA is empty; cannot determine changed files."
  exit 1
fi

if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ] && [ -n "${PR_BASE_SHA:-}" ]; then
  git diff --name-only "$PR_BASE_SHA" "$GITHUB_SHA" > "$OUTPUT_PATH"
elif [ -n "${GITHUB_EVENT_BEFORE:-}" ] && [ "$GITHUB_EVENT_BEFORE" != "0000000000000000000000000000000000000000" ]; then
  git diff --name-only "$GITHUB_EVENT_BEFORE" "$GITHUB_SHA" > "$OUTPUT_PATH"
elif ! git show --name-only --pretty=format: "$GITHUB_SHA" > "$OUTPUT_PATH"; then
  echo "Error: Failed to collect changed files from commit $GITHUB_SHA."
  exit 1
else
  true
fi

if [ -s "$OUTPUT_PATH" ]; then
  echo "Collected $(wc -l < "$OUTPUT_PATH") changed file(s) into $OUTPUT_PATH."
else
  echo "No files changed in this commit."
fi
