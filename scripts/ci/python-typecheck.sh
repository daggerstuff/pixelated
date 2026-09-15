#!/usr/bin/env bash
# Python strict type checking (mypy).
#
# Scope: the `pe` FastAPI service (`apps/web/src/pe`) is checked in full
# `--strict` mode. The wider codebase (ai/, scripts/, foresight/, tools/) is
# not yet strict-clean, so those packages are explicitly exempted below. This
# is the same incremental-adoption strategy used for TypeScript (see
# scripts/ci/ts-strict-mode-tracker.ts): strict where it is enforced today,
# documented exemptions for legacy trees, and a clear path to widen the net.
#
# A CI-visible summary line is printed so the check is easy to locate in logs.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

STRICT_TARGETS=("apps/web/src/pe")

echo "🐍 Running mypy --strict on: ${STRICT_TARGETS[*]}"
echo "   Config: pyproject.toml [tool.mypy]; exemptions for legacy trees are documented there."

# `uv run --extra dev` guarantees mypy is present even when the environment has
# not synced the dev extra yet (fresh CI checkout).
if ! uv run --extra dev mypy "${STRICT_TARGETS[@]}"; then
  echo "❌ mypy strict check failed. Add precise type annotations (no suppressions)." >&2
  exit 1
fi

echo "✅ Python strict type check passed for ${STRICT_TARGETS[*]}"
