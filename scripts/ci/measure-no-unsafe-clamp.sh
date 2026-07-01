#!/usr/bin/env bash
# scripts/ci/measure-no-unsafe-clamp.sh
#
# Executable estimate of the no-unsafe-* warning clamp from running Phase 1
# of the typed-I/O-boundary migration locally on the 4 quick-win surfaces.
#
# What it does:
#   1. Pre-flight: abort if any of the 4 target files has working-tree changes.
#   2. `pnpm lint > before.txt` captures baseline lint (with cache cleared).
#   3. Apply Phase 1 surface edits via the node companion (precise str_replace).
#   4. `pnpm lint > after.txt` captures post-edit lint (cache cleared again).
#   5. Diff per-rule: open / close counts and percent clamping.
#   6. ALWAYS clean up: git restore + temp-file removal on EXIT/ERR/INT/TERM.
#
# Usage:
#   bash scripts/ci/measure-no-unsafe-clamp.sh
#
# Safety:
#   - Refuses to run if any target file has uncommitted changes (fail-fast).
#   - Uses `git restore` (modern, version-aware) on exit, including Ctrl-C.
#   - All temp output goes to /tmp; nothing is written into the repo.
#
# Exit codes:
#   0   - measurement completed (report always printed; check "new errors" line).
#   1   - pre-flight failed (dirty target files).
#   2   - apply companion reported failed anchors or lint crashed.
#
# This is a measurement tool, NOT a production migration. The apply companion
# (`scripts/ci/_measure-no-unsafe-clamp-apply.mjs`) is the source of truth for
# "what Phase 1 surface edits look like"; re-run this whenever the companion
# changes to get a fresh clamp number.

set -uo pipefail
# Note: deliberately NOT `set -e` — we want graceful recovery + cleanup.
# Lint exits non-zero on warnings (which is the common case); we tolerate that.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

TARGET_FILES=(
  packages/pixelated-sdk/src/index.ts
  packages/pixelated-sdk/src/foresight.ts
  src/lib/sdk/index.ts
  src/lib/api/therapeutic.ts
)

BEFORE=/tmp/measure-no-unsafe-clamp-before.txt
AFTER=/tmp/measure-no-unsafe-clamp-after.txt
APPLY="$SCRIPT_DIR/_measure-no-unsafe-clamp-apply.mjs"

# Ordered list of no-unsafe-* rules we care about (every type the triage
# measured; the breakdown loop prints them in descending priority).
RULES=(
  no-unsafe-assignment
  no-unsafe-argument
  no-unsafe-call
  no-unsafe-return
  no-unsafe-member-access
  no-unsafe-enum-comparison
)

# ---------------------------------------------------------------------------
# Cleanup (unconditional on every exit)
# ---------------------------------------------------------------------------
cleanup() {
  local exit_code=$?
  echo
  echo "=== Cleanup: restoring target files + removing temp ==="
  if [ ${#TARGET_FILES[@]} -gt 0 ]; then
    git restore -- "${TARGET_FILES[@]}" 2>/dev/null || true
  fi
  rm -f "$BEFORE" "$AFTER"
  exit "$exit_code"
}
trap cleanup EXIT ERR INT TERM

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
echo "=== Phase 1 measurement ==="
echo
echo "Pre-flight: target files must be at clean HEAD..."
DIRTY=()
for f in "${TARGET_FILES[@]}"; do
  if ! git diff --quiet -- "$f" 2>/dev/null; then
    DIRTY+=("$f")
  fi
done
if [ ${#DIRTY[@]} -gt 0 ]; then
  echo "  ❌ target files have uncommitted changes:"
  for f in "${DIRTY[@]}"; do echo "     - $f"; done
  echo
  echo "  Commit or `git stash` them before running this script."
  echo "  (Safety: prevents the measurement from accidentally reverting your work.)"
  exit 1
fi
echo "  ✅ clean"

# ---------------------------------------------------------------------------
# Step 1: baseline lint
# ---------------------------------------------------------------------------
echo
echo "=== Step 1: baseline \`pnpm lint\` ==="
# Clear caches so the measurement isn't fooled by stale TypeScript buildinfo.
rm -f tsconfig.tsbuildinfo .tsbuildinfo 2>/dev/null || true

if ! pnpm lint > "$BEFORE" 2>&1; then
  : # lint commonly exits non-zero on warnings; we only care about counts.
fi

BEFORE_TOTAL=$(grep -cE '^! ' "$BEFORE" 2>/dev/null || true); BEFORE_TOTAL=${BEFORE_TOTAL:-0}
BEFORE_UNSAFE=$(grep -cE 'no-unsafe-' "$BEFORE" 2>/dev/null || true); BEFORE_UNSAFE=${BEFORE_UNSAFE:-0}
echo "  baseline: $BEFORE_TOTAL total diagnostics, $BEFORE_UNSAFE no-unsafe-*"

# Per-rule baseline breakdown (before applying)
echo "  per-rule (before):"
for r in "${RULES[@]}"; do
  c=$(grep -cE "${r}\b" "$BEFORE" 2>/dev/null || true); c=${c:-0}
  printf "    %-30s %s\n" "$r" "$c"
done

# ---------------------------------------------------------------------------
# Step 2: apply Phase 1 surface edits
# ---------------------------------------------------------------------------
echo
echo "=== Step 2: applying Phase 1 surface edits ==="
# Clear caches again right before edits so the after-lint re-reads TypeScript
# surface freshly. (Mitigates stale .tsbuildinfo phantom diffs.)
rm -f tsconfig.tsbuildinfo .tsbuildinfo 2>/dev/null || true

if ! node "$APPLY"; then
  echo "  ❌ apply companion failed (see error above); aborting."
  exit 2
fi

# ---------------------------------------------------------------------------
# Step 3: after lint
# ---------------------------------------------------------------------------
echo
echo "=== Step 3: post-edit \`pnpm lint\` ==="
if ! pnpm lint > "$AFTER" 2>&1; then
  : # Lint non-zero on warnings is normal; counts come from the file.
fi

AFTER_TOTAL=$(grep -cE '^! ' "$AFTER" 2>/dev/null || true); AFTER_TOTAL=${AFTER_TOTAL:-0}
AFTER_UNSAFE=$(grep -cE 'no-unsafe-' "$AFTER" 2>/dev/null || true); AFTER_UNSAFE=${AFTER_UNSAFE:-0}
echo "  after:    $AFTER_TOTAL total diagnostics, $AFTER_UNSAFE no-unsafe-*"

# ---------------------------------------------------------------------------
# Step 4: report per-rule delta
# ---------------------------------------------------------------------------
echo
echo "=== ESTIMATE: per-rule no-unsafe-* clamp ==="
printf "    %-30s %6s   %6s   %6s\n" "rule" "before" "after" "delta"
printf "    %-30s %6s   %6s   %6s\n" "----" "------" "-----" "-----"

TOTAL_DELTA_UNSAFE=0
for r in "${RULES[@]}"; do
  b=$(grep -cE "${r}\b" "$BEFORE" 2>/dev/null || true); b=${b:-0}
  a=$(grep -cE "${r}\b" "$AFTER" 2>/dev/null || true); a=${a:-0}
  d=$((b - a))
  TOTAL_DELTA_UNSAFE=$((TOTAL_DELTA_UNSAFE + d))
  printf "    %-30s %6d   %6d   %6d\n" "$r" "$b" "$a" "$d"
done

# Any brand-new ERROR between before/after (these are warn-level rules, so a
# new error indicates the migration INTRODUCED a regression).
NEW_ERRORS=$(grep -cE '^❌|^[^!].*error\b' "$AFTER" 2>/dev/null || true); NEW_ERRORS=${NEW_ERRORS:-0}

echo
echo "=== ESTIMATE: overall ==="
TOTAL_DELTA=$((BEFORE_TOTAL - AFTER_TOTAL))
PCT=$(awk -v b="$BEFORE_UNSAFE" -v d="$TOTAL_DELTA_UNSAFE" 'BEGIN {
  if (b > 0) printf "%.1f", d*100/b; else print "0.0"
}')
echo "  no-unsafe-* clamp       : $TOTAL_DELTA_UNSAFE warnings closed"
echo "  project-wide diagnostics: $BEFORE_TOTAL -> $AFTER_TOTAL ($TOTAL_DELTA delta)"
echo "  no-unsafe-* reduction   : ${PCT}% ( $BEFORE_UNSAFE -> $AFTER_UNSAFE )"
echo "  new errors introduced   : $NEW_ERRORS (must be 0)"
echo
echo "  Run \`bash scripts/ci/measure-no-unsafe-clamp.sh\` again to re-measure"
echo "  after editing the apply companion."
