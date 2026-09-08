#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

OXLINT="./node_modules/.bin/oxlint"
CONFIG="./.oxlintrc.json"

file_list="$("$OXLINT" -c "$CONFIG" --debug=files . 2>/dev/null | sed '/^$/d')"

if [ -z "$file_list" ]; then
  echo "No lint targets found."
  exit 0
fi

# tsgolint headless hangs on the full aggregate file set. Lint in bounded
# batches so every batch gets its own type-aware runner and the process never
# crosses the aggregate limit.
printf '%s\n' "$file_list" | xargs -d '\n' -n 200 "$OXLINT" -c "$CONFIG"
