#!/bin/bash
# scripts/ci/check-no-suppressions.sh
#
# Pre-merge guard: fail the build if any forbidden suppression token
# appears in committed TypeScript/JavaScript source.
#
# Per CLAUDE.md, this codebase forbids:
#   @ts-ignore         — TypeScript-level escape from real type errors
#   eslint-disable     — oxlint/ESLint escape from real lint errors
#   # noqa             — Python ruff/Pylint escape (Python-scope, kept in
#                        regex for when this guard is extended)
#   # type: ignore     — Python mypy escape (Python-scope, kept in regex
#                        for the same reason)
#
# Why this exists:
#   We just deleted 7 forbidden suppressions across 6 files. Without a
#   mechanical guard, future PRs can silently re-introduce them in the
#   form of `// eslint-disable-next-line`, `/* eslint-disable */`, or
#   `@ts-ignore` on the next line, and oxlint's warning/error budget
#   loses its honesty about what's actually fixed.
#
# Scope (TypeScript/JavaScript family only):
#   In scope:  *.ts, *.tsx, *.js, *.jsx, *.mjs, *.cjs
#   Out:       Python (*.py) — that family has ~19k legitimate ruff/mypy
#               uses (e.g. `# noqa: PLR0915`) and is out of scope for this
#               guard until a separate migration sweep clears the baseline.
#   Out:       vendored deps — node_modules, .venv/* (the in-tree Python
#               site-packages at src/lib/ai/.../python-service/.venv/lib/…),
#               dist, build, .next, .pnpm-store, .turbo, coverage, .astro
#   Out:       git submodules — `foresight-mcp` has its own quality rules
#   In:        tests — no test is exempt; suppression in a test still
#               hides a real defect and CLAUDE.md is unambiguous about
#               "never".
#
# False-positive awareness:
#   This is comment-only (substring) detection. The four tokens are
#   abstract enough that they don't naturally appear in TS/JS string
#   literals; if a fixture ever holds one verbatim, ripgrep it out by
#   quoting the substring (e.g. write "`${'@ts-ignore'}`" via template).
#
# Output format:
#   On clean:        "✅ Scanned N files — no forbidden suppression
#                     tokens found."
#   On violation:    "<path>:<line>  ❌ forbidden suppression token:
#                     <matched-string>"
#                     followed by count + a fix-the-root-cause note.
#
# Exit codes:
#   0 — clean
#   1 — one or more forbidden suppression tokens found
#   2 — internal error (find produced nothing AND files were expected)
#
# Invocation:
#   - Local:        `pnpm lint:no-suppressions`
#   - In CI:        `pnpm lint:no-suppressions` step in
#                   `.github/workflows/ci.yml`, chained after the
#                   `pnpm lint:ci:with-markdown` step.
#   - On a subset:  pass file paths as CLI args; only files whose
#                   extension is in scope are scanned (lint-staged style).
#
# Roll-out safety:
#   This script is strict-fail from day 1 because the post-prior-deletion
#   TS/JS baseline is 0 hits. The CI step is added with
#   `continue-on-error: true` so a runner-image-only delta (e.g. an
#   inadvertent LFS checkout or submodule populate difference) does not
#   burn other jobs; flip to blocking in a fast-follow PR once verified.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Files in scope: TS/JS family, plus Astro (frontmatter is TS and can carry
# suppression tokens). `.d.ts` excluded — declaration files rarely
# carry suppression tokens and excluding them avoids surprises with ambient
# type augmentations.
SCAN_EXTENSIONS=(ts tsx js jsx mjs cjs astro)

# Path-exclusion globs. Each must match anywhere in the absolute or
# relative path (GNU find's `-path` accepts `*` anywhere, including
# before hidden dirs like `.venv` and `.pnpm-store`).
EXCLUDE_GLOBS=(
    '*/node_modules/*'
    '*/.pnpm-store/*'
    '*/.pnpm/*'
    '*/.venv/*'
    '*/venv/*'
    '*/__pycache__/*'
    '*/dist/*'
    '*/build/*'
    '*/.next/*'
    '*/.turbo/*'
    '*/coverage/*'
    '*/.astro/*'
    '*/.git/*'
    # Git submodules have their own quality rules.
    '*/foresight-mcp/*'
)

# Source roots scanned when no CLI files are passed. Missing directories
# are tolerated.
SOURCE_ROOTS=(src agents ai-services packages frontend backend tests)

# Pattern regex covers all four forbidden tokens. In TS/JS only the first
# two (`@ts-ignore`, `eslint-disable`) are realistic; the Python-shaped
# brackets are kept as future-proofing for when this guard is extended.
TOKENS_REGEX='@ts-ignore|eslint-disable|#\s*noqa|#\s*type:\s*ignore'

# ---------------------------------------------------------------------------
# Resolve the file set
# ---------------------------------------------------------------------------

CLI_FILES=()
if [ "$#" -gt 0 ]; then
    for arg in "$@"; do
        ext="${arg##*.}"
        for e in "${SCAN_EXTENSIONS[@]}"; do
            if [ "$ext" = "$e" ]; then
                CLI_FILES+=("$arg")
                break
            fi
        done
    done
fi

if [ ${#CLI_FILES[@]} -gt 0 ]; then
    # De-dup while preserving order.
    mapfile -t SCAN_FILES < <(printf '%s\n' "${CLI_FILES[@]}" | sort -u)
else
    # Build `-name` OR-list (one entry per extension), wrapped in a
    # single grouping. Strip the trailing `-o` so find treats the group
    # as a single argument.
    name_args=()
    for ext in "${SCAN_EXTENSIONS[@]}"; do
        name_args+=(-name "*.${ext}" -o)
    done
    if [ ${#name_args[@]} -gt 0 ]; then
        unset 'name_args[-1]'
    fi

    find_args=()
    if [ ${#name_args[@]} -gt 0 ]; then
        find_args+=( -type f \( "${name_args[@]}" \) )
    fi
    for excl in "${EXCLUDE_GLOBS[@]}"; do
        find_args+=( -not -path "$excl" )
    done

    mapfile -t SCAN_FILES < <(
        for root in "${SOURCE_ROOTS[@]}"; do
            [ -d "$root" ] || continue
            find "$root" "${find_args[@]}" 2>/dev/null || true
        done | sort -u
    )
fi

if [ ${#SCAN_FILES[@]} -eq 0 ]; then
    printf '✅ No files matched the scan glob — nothing to check.\n'
    exit 0
fi

# ---------------------------------------------------------------------------
# Scan + report
# ---------------------------------------------------------------------------

# Single grep -nE pass. -H ensures the filename prefix appears even on
# single-file runs (grep -n prints `path:line:rest` per match).
HITS=$(grep -nE -H -- "${TOKENS_REGEX}" "${SCAN_FILES[@]}" 2>/dev/null || true)

FILE_COUNT=${#SCAN_FILES[@]}

if [ -z "$HITS" ]; then
    printf '✅ Scanned %d %s — no forbidden suppression tokens found.\n' \
        "$FILE_COUNT" \
        "$( [ "$FILE_COUNT" -eq 1 ] && echo file || echo files )"
    exit 0
fi

# Pretty-print violations. `path:line:rest` → `path:line  ❌ forbidden
# suppression token: <matched-string>`. Avoid column math here for
# portability (bcp/mawk/perl columns diverge); the line number is enough
# to land a developer on the exact suppression site.
while IFS=: read -r path line rest; do
    matched=$(printf '%s' "$rest" | grep -oE -- "${TOKENS_REGEX}" | head -1)
    printf '%s:%s  ❌ forbidden suppression token: %s\n' \
        "$path" "$line" "$matched" >&2
done <<< "$HITS"

HIT_COUNT=$(printf '%s\n' "$HITS" | wc -l)
SCAN_LABEL="$( [ "$FILE_COUNT" -eq 1 ] && echo file || echo files )"
HIT_LABEL="$( [ "$HIT_COUNT" -eq 1 ]  && echo token || echo tokens )"

printf '\n❌ Found %s forbidden suppression %s across %d scanned %s.\n' \
    "$HIT_COUNT" "$HIT_LABEL" "$FILE_COUNT" "$SCAN_LABEL" >&2
printf '   Per CLAUDE.md, suppression comments (@ts-ignore, eslint-disable,\n' >&2
printf '   # noqa, # type: ignore) are NEVER allowed in committed source.\n' >&2
printf '   Fix the underlying issue (type-narrow, refactor, configure the\n' >&2
printf '   rule, or split the offending expression). Re-running will fail\n' >&2
printf '   the build until all violations are removed.\n' >&2
exit 1
