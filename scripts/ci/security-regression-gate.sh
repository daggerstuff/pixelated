#!/usr/bin/env bash
# scripts/ci/security-regression-gate.sh
#
# Security regression gate (PIX-4143 / S9).
#
# Fails CI when a previously-remediated vulnerability is REINTRODUCED. This
# complements (does not replace) the vulnerability scanners in security.yml
# (CodeQL, Trivy, Checkov, pnpm audit, pip-audit) — those catch NEW issues;
# this gate catches KNOWN ones coming back.
#
# Current regression checks:
#   1. react-router / react-router-dom in the lockfile (advisory 1124282,
#      removed 2026-07-30 — see PIX-4165).
#
# NOTE: This lockfile-based check supersedes scripts/ci/check-react-router.mjs
# (PIX-4165) for CI purposes — the gate needs no `pnpm install` (grep on the
# lockfile only), while the .mjs uses `pnpm why`. The .mjs is retained as a
# standalone manual check. Keep the two in sync if the blocklist changes.
#
# Adding a new check:
#   Append a guard function below and call it from main(). Each guard must
#   set RETURN=1 on failure so the gate fails with a clear message.
#
# Exit codes:
#   0 — no regressions detected
#   1 — one or more known-vulnerable patterns reintroduced

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

RETURN=0

# ---------------------------------------------------------------------------
# Guard 1: react-router / react-router-dom reintroduction
# ---------------------------------------------------------------------------
guard_react_router() {
  echo "::group::react-router reintroduction guard"
  # pnpm-lock.yaml always exists in this repo; if it is ever missing the grep
  # will find nothing and the guard passes (treated as no-match, not an error).
  if grep -qE 'react-router(-dom)?@' pnpm-lock.yaml 2>/dev/null; then
    echo "::error::❌ react-router / react-router-dom detected in pnpm-lock.yaml"
    echo "   These packages were removed due to advisory 1124282 (CSRF in RSC mode)."
    echo "   Do not reintroduce them. See PIX-4165."
    RETURN=1
  else
    echo "✅ react-router / react-router-dom not present in the lockfile."
  fi
  echo "::endgroup::"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
guard_react_router

if [ "$RETURN" -ne 0 ]; then
  echo "::error::Security regression gate FAILED — known-vulnerable patterns were reintroduced."
  exit 1
fi

echo "✅ Security regression gate passed."
