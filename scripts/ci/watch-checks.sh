#!/usr/bin/env bash
# usage: watch-checks.sh <sha> [--all] [check-name ...]
#
# Defaults to the two build gates, `build` and `build-test`; the second is CI's own
# build-and-test job, so polling `build` alone does not cover the build. --all waits
# for every check-run on the SHA, which also picks up Dependabot PR runs attached
# to the commit.
# The check-runs API pages at 30 by default and this repo makes ~50 per commit,
# so an unpaginated query silently omits jobs and reports "never appeared" for
# a job that already passed. --paginate is the whole point of this script.
# A commit also keeps every attempt of a check, so only one attempt per name is
# judged: a pending attempt always wins (a queued run carries no started_at, so
# ordering by time alone would discard it and call a still-running gate green);
# otherwise the newest attempt that actually ran decides, because a skipped run
# did not execute and must not outrank an earlier success on the same commit.
# Exit: 0 green, 1 red, 2 no verdict, 3 the commit is no longer a branch head, so
# its runs were cancelled by a newer push and no verdict will ever come for it.
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
  set -- build build-test
fi

TIMEOUT_MINUTES=${WATCH_TIMEOUT_MINUTES:-60}
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
DEADLINE=$((SECONDS + TIMEOUT_MINUTES * 60))

if ! FULL_SHA=$(gh api "repos/$REPO/commits/$SHA" --jq .sha 2>/dev/null); then
  echo "✖ $SHA is not a commit in $REPO" >&2
  exit 2
fi
SHA=$FULL_SHA

fetch() {
  gh api --paginate "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
    --jq '.check_runs[] | {name, status, conclusion, started_at}' |
    jq -sr 'group_by(.name) | map(
              if (map(select(.status != "completed")) | length) > 0
              then (map(select(.status != "completed")) | .[0])
              else
                (map(select(.conclusion != "skipped")) as $ran
                 | if ($ran | length) > 0
                   then ($ran | sort_by(.started_at // "") | .[-1])
                   else (sort_by(.started_at // "") | .[-1]) end)
              end) |
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
  if [[ "$total" -eq 0 ]]; then
    heads=$(gh api "repos/$REPO/commits/$SHA/branches-where-head" --jq '.[].name' 2>/dev/null || true)
    if [[ -z "$heads" ]]; then
      echo "✖ $SHA is not the head of any branch: its runs were superseded, so nothing will report for it" >&2
      exit 3
    fi
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

failed=$(printf '%s\n' "$rows" | awk -F'\t' '$2 == "failure" || $2 == "cancelled" || $2 == "timed_out"' | grep -c . || true)
skipped=$(printf '%s\n' "$rows" | awk -F'\t' '$2 == "skipped"' | grep -c . || true)

if [[ "$failed" -gt 0 ]]; then
  real_failures=$(printf '%s\n' "$rows" | awk -F'\t' '$2 == "failure" || $2 == "timed_out"' | grep -c . || true)
  if [[ "$real_failures" -eq 0 ]]; then
    heads=$(gh api "repos/$REPO/commits/$SHA/branches-where-head" --jq '.[].name' 2>/dev/null || true)
    if [[ -z "$heads" ]]; then
      echo "✖ $SHA is not the head of any branch: its runs were cancelled by a newer push" >&2
      exit 3
    fi
  fi
fi

printf '%s\n' "$rows" | awk -F'\t' '$2 == "failure" || $2 == "cancelled" || $2 == "timed_out" { print "✖ " $3 ": " $2 }'
printf 'checked=%s failed=%s skipped=%s\n' "$total" "$failed" "$skipped"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
printf 'CHECKS_GREEN\n'
