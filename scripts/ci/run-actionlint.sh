#!/usr/bin/env bash
# scripts/ci/run-actionlint.sh
#
# Local runner for actionlint, the GitHub Actions YAML linter.
# Mirrors the pinned version used by .github/workflows/actionlint.yml so
# devs get the same lint results locally as CI. The binary is cached in
# .cache/actionlint/<version>/ so repeated invocations are instant.
#
# Usage:
#   pnpm lint:actionlint              # lints all workflows
#   bash scripts/ci/run-actionlint.sh .github/workflows/ci.yml   # one file
#
# Exit code: non-zero if any workflow file has violations.

set -euo pipefail

ACTIONLINT_VERSION="1.7.7"
CACHE_DIR=".cache/actionlint/${ACTIONLINT_VERSION}"
BIN="${CACHE_DIR}/actionlint"

# Download if not cached
if [[ ! -x "${BIN}" ]]; then
  mkdir -p "${CACHE_DIR}"
  TMP_TAR="$(mktemp -t actionlint.XXXXXX.tar.gz)"
  echo "→ Downloading actionlint v${ACTIONLINT_VERSION} → ${CACHE_DIR}/"
  curl --connect-timeout 30 --retry 3 --retry-delay 5 --fail -sSL \
    -o "${TMP_TAR}" \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz"
  tar -xzf "${TMP_TAR}" -C "${CACHE_DIR}"
  rm -f "${TMP_TAR}"
  chmod +x "${BIN}"
fi

# Lint every arg (default: all workflow files)
if [[ "$#" -eq 0 ]]; then
  set -- .github/workflows/*.yml
fi

echo "→ Running actionlint v${ACTIONLINT_VERSION} on: $*"
exec "${BIN}" -color "$@"