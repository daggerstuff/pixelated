#!/bin/bash
# scripts/ci/prelint-node.sh
#
# Pre-lint hook: source nvm (best-effort), switch to the version pinned in
# .nvmrc, and verify the active Node major meets `engines.node` in
# package.json. Invoked from `prelint*` scripts so that every lint command
# (pnpm lint, pnpm lint:fix, pnpm lint:ci:all, lint:ci:type-aware:all)
# runs on the project's pinned Node.
#
# Why this exists:
#   oxlint's type-aware mode (tsgolint) silently SIGKILLs on Node 22 when
#   scanning large repos. Failing fast here with a clear fix is far cheaper
#   than debugging a crashed CI job.
#
# Cross-platform behavior:
#   - Works with or without nvm installed. If nvm is missing, the script
#     reports the active version and exits 1 with install instructions.
#   - Honors $NVM_DIR first, then tries $HOME/.nvm, /usr/local/share/nvm,
#     and Homebrew's /opt/homebrew/opt/nvm (Apple Silicon).
#
# Minimum-major resolution (in priority order):
#   1. Environment override: PRE_LINT_MIN_MAJOR=N
#   2. engines.node in package.json (>=24, ^24, ~24, 24.x, 24, …)
#   3. Built-in default: 24
#
# engines.node parsing is intentionally conservative. For OR-style ranges
# like `"^18 || ^20"` the operator-prefixed regex picks the lowest listed
# major (18). This matches npm's effective floor when ranges are mixed.
# Tightening further would require a real semver parser; the small drift
# here only matters if engines.node uses an unusual OR format.
#
# Exit codes:
#   0 — active Node major meets the minimum and matches .nvmrc if pinned.
#   1 — node missing, or active Node is below the minimum and could not
#       be auto-resolved.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NVMRC="$PROJECT_ROOT/.nvmrc"
DEFAULT_MAJOR=24

# Fail fast with a clear message when `node` itself is missing — the rest
# of the script depends on it for both deriving the threshold and reading
# the active version.
if ! command -v node >/dev/null 2>&1; then
    echo "❌ node not found in PATH. Install Node ${DEFAULT_MAJOR}+ before running lint." >&2
    echo "   See: https://github.com/nvm-sh/nvm#installing-and-updating" >&2
    exit 1
fi

# Pull the operator-prefixed or bare major from engines.node. Operator
# prefix wins so e.g. `"0.12 || 14"` still surfaces 14. Falls back to "".
RAW_MIN="$(PKG_PATH="$PROJECT_ROOT/package.json" node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.env.PKG_PATH, "utf8"));
const e = String(pkg.engines?.node ?? "");
const op = e.match(/[v^~>=]\s*(\d+)/);
const any = op ? null : e.match(/\d+/);
process.stdout.write(op ? op[1] : any ? any[0] : "");
')"

# Resolve minimum major + its source so messages can be honest about
# whether the override, engines.node, or the default is in effect.
if [ -n "${PRE_LINT_MIN_MAJOR:-}" ]; then
    MIN_MAJOR="$PRE_LINT_MIN_MAJOR"
    MIN_SOURCE="override"
elif [ -n "$RAW_MIN" ]; then
    MIN_MAJOR="$RAW_MIN"
    MIN_SOURCE="engines.node"
else
    MIN_MAJOR="$DEFAULT_MAJOR"
    MIN_SOURCE="default"
fi
SOURCE_SUFFIX=""
if [ "$MIN_SOURCE" = "override" ]; then
    SOURCE_SUFFIX=" via PRE_LINT_MIN_MAJOR"
fi

# Try nvm in priority order: $NVM_DIR first (if set), then common paths.
NVM_SH=""
if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    NVM_SH="$NVM_DIR/nvm.sh"
else
    for candidate in \
        "$HOME/.nvm/nvm.sh" \
        "/usr/local/share/nvm/nvm.sh" \
        "/opt/homebrew/opt/nvm/nvm.sh"; do
        if [ -s "$candidate" ]; then
            NVM_SH="$candidate"
            break
        fi
    done
fi

if [ -n "$NVM_SH" ]; then
    # shellcheck disable=SC1090
    . "$NVM_SH"
    # --silent matches the existing project convention
    # (scripts/devops/jules-setup.sh:17). Errors are swallowed here so
    # the version check below can give actionable guidance.
    nvm use --silent >/dev/null 2>&1 || true
fi

ACTUAL_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0], 10)")"

if [ "$ACTUAL_MAJOR" -lt "$MIN_MAJOR" ]; then
    PIN_HINT=""
    if [ -s "$NVMRC" ]; then
        PIN_HINT="$(printf '\n   .nvmrc pins %s. Run:\n     nvm install\n     nvm use\n' "$(tr -d '[:space:]' < "$NVMRC")")"
    fi
    NVM_HINT=""
    if [ -z "$NVM_SH" ]; then
        NVM_HINT="\n   nvm not detected. Install: https://github.com/nvm-sh/nvm#installing-and-updating\n"
    fi

    printf '\n❌ Node %s+ required for lint (source: %s%s), but active shell has %s.%s%s\n' \
        "$MIN_MAJOR" \
        "$MIN_SOURCE" \
        "$SOURCE_SUFFIX" \
        "$(node -v)" \
        "$PIN_HINT" \
        "$NVM_HINT" >&2
    exit 1
fi

printf '✅ prelint: Node %s (>= %s, source: %s%s) OK\n' \
    "$(node -v)" \
    "$MIN_MAJOR" \
    "$MIN_SOURCE" \
    "$SOURCE_SUFFIX"
