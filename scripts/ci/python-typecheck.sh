#!/usr/bin/env bash
# Python strict type checking (mypy).
#
# Scope: the `pe` FastAPI service (`apps/web/src/pe`) plus the full scripts/
# and tools/ trees are checked in `--strict` mode. The remaining legacy trees
# (ai/, foresight/, tests/) are still exempted in pyproject.toml
# [[tool.mypy.overrides]] and are not part of the enforced scope here.
#
# NOTE: apps/web/src/__init__.py is a required marker — without it, the pe
# targets derive module names like `pe.*` while the code imports `src.pe.*`,
# and `ignore_missing_imports` silently degrades every cross-module pe
# import to `Any`, vacating most of the strict check.
#
# History: scripts/ and tools/ carried ~1000 pinned strict errors and were
# enforced incrementally by scripts/ci/python-strict-ratchet.mjs (a shrink-only
# baseline). Every pinned file has since reached zero strict errors, so the
# exemption was retired and both trees are now enforced directly by this
# check — the ratchet and its baseline were removed with it.
#
# The scripts/tools run uses the same flags the retired ratchet used:
#   --explicit-package-bases  avoids "found twice" errors from the
#                             submodule layout (e.g. tools/agent_runner).
#   --follow-imports silent   errors in exempt trees (ai/) that scripts
#                             import do not leak into the run; untyped
#                             callees still surface as no-untyped-call in
#                             the caller.
#
# A CI-visible summary line is printed so the check is easy to locate in logs.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

PE_TARGETS=("apps/web/src/pe")
WIDE_TARGETS=("scripts" "tools")

echo "🐍 Running mypy --strict on: ${PE_TARGETS[*]}"
echo "   Config: pyproject.toml [tool.mypy]; exemptions for legacy trees are documented there."

# `uv run --extra dev` guarantees mypy is present even when the environment has
# not synced the dev extra yet (fresh CI checkout).
if ! uv run --extra dev mypy "${PE_TARGETS[@]}"; then
  echo "❌ mypy strict check failed. Add precise type annotations (no suppressions)." >&2
  exit 1
fi
echo "✅ Python strict type check passed for ${PE_TARGETS[*]}"

echo "🐍 Running mypy --strict on: ${WIDE_TARGETS[*]}"
if ! uv run --extra dev mypy --explicit-package-bases --follow-imports silent "${WIDE_TARGETS[@]}"; then
  echo "❌ mypy strict check failed. Add precise type annotations (no suppressions)." >&2
  exit 1
fi
echo "✅ Python strict type check passed for ${WIDE_TARGETS[*]}"
