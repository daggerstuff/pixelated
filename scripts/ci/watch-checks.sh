#!/usr/bin/env bash
# usage: watch-checks.sh <sha> [--all] [check-name ...]
#
# Defaults to the `build` gate. --all waits for every check-run on the SHA, which
# also picks up Dependabot PR runs attached to the commit.
# The check-runs API pages at 30 by default and this repo makes ~50 per commit,
# so an unpaginated query silently omits jobs and reports "never appeared" for
# a job that already passed. --paginate is the whole point of this script.
# A commit also keeps every attempt of a check, so only the newest attempt per
# name is judged: an older red attempt that was superseded is not a failure.
set -euo pipefail

ALL=false
if [[ "${1:-}" == "--all" ]]; then
  ALL=true
  shift
fi

SHA=${1:-}
if [[ -z "$SHA" ]]; then
  echo "usage: watch-checks.sh <sha> [--all] [check-name ...]" >&2
  exit 2
fi
shift || true

if [[ $# -eq 0 && "$ALL" != true ]]; then
  set -- build
fi

TIMEOUT_MINUTES=${WATCH_TIMEOUT_MINUTES:-60}
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
DEADLINE=$((SECONDS + TIMEOUT_MINUTES * 60))

fetch() {
  gh api --paginate "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
    --jq '.check_runs[] | {name, status, conclusion, started_at}' |
    jq -sr 'group_by(.name) | map(sort_by(.started_at // "") | .[-1]) |
            .[] | "\(.status)\t\(.conclusion // "-")\t\(.name)"'
}

select_rows() {
  if [[ $# -eq 0 ]]; then
    cat
  else
    awk -F'\t' 'NR==FNR { want[$0] = 1; next } ($3 in want)' <(printf '%s\n' "$@") -
  fi
}

rows=""
while :; do
  rows=$(fetch | select_rows "$@")
  total=$(printf '%s' "$rows" | grep -c . || true)
  pending=$(printf '%s' "$rows" | awk -F'\t' '$1 != "completed"' | grep -c . || true)
  if [[ "$total" -gt 0 && "$pending" -eq 0 ]]; then
    break
  fi
  if [[ "$SECONDS" -ge "$DEADLINE" ]]; then
    echo "✖ no verdict after ${TIMEOUT_MINUTES}m (total=$total pending=$pending)" >&2
    if [[ -n "$rows" ]]; then
      printf '%s\n' "$rows" | awk -F'\t' '$1 != "completed" { print "  " $3 ": " $1 }' >&2
    fi
    exit 2
  fi
  sleep 30
done

printf '%s\n' "$rows" | awk -F'\t' '$2 == "failure" || $2 == "cancelled" || $2 == "timed_out" { print "✖ " $3 ": " $2 }'
failed=$(printf '%s\n' "$rows" | awk -F'\t' '$2 == "failure" || $2 == "cancelled" || $2 == "timed_out"' | grep -c . || true)
skipped=$(printf '%s\n' "$rows" | awk -F'\t' '$2 == "skipped"' | grep -c . || true)
printf 'checked=%s failed=%s skipped=%s\n' "$total" "$failed" "$skipped"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
printf 'CHECKS_GREEN\n'
