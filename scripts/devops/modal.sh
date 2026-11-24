#!/bin/bash
# ============================================================================
# Pixelated Empathy — Modal compute platform
# Thin wrapper around `infra.modal.ops.cli` so operators and CI use one entry
# point with a pinned uv environment:
#   ./scripts/devops/modal.sh status      # is this checkout configured?
#   ./scripts/devops/modal.sh check       # run the smoke app on Modal
#   ./scripts/devops/modal.sh targets     # list the workload targets
#   ./scripts/devops/modal.sh deploy      # deploy every repo app
#   ./scripts/devops/modal.sh secret-sync # push local tokens into Modal
#   ./scripts/devops/modal.sh embed ...   # GPU embeddings
#   ./scripts/devops/modal.sh dataset ... # build/dedupe/split a corpus
#   ./scripts/devops/modal.sh train ...   # LoRA fine-tuning on a GPU
#   ./scripts/devops/modal.sh test ...    # run the suite in a clean container
# Requires `modal setup` (or MODAL_TOKEN_ID/MODAL_TOKEN_SECRET) for everything
# except `status` and `targets`, which report configuration instead of failing.
# Extra arguments after a workload name are forwarded to its local entrypoint,
# e.g. `./scripts/devops/modal.sh train --epochs 2`.
# ============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_VERSION="${PIXELATED_MODAL_PYTHON:-3.12}"

command="${1:-status}"
shift || true

run_uv() {
  uv run --no-project --python "$PYTHON_VERSION" --with "modal>=1.6.4" "$@"
}

case "$command" in
  status | check | targets | deploy | secret-sync | apps | embed | train | test | dataset)
    run_uv python -m infra.modal.ops.cli "$command" "$@"
    ;;
  help | -h | --help)
    run_uv python -m infra.modal.ops.cli --help
    ;;
  *)
    echo "unknown command: $command (expected status|check|targets|deploy|secret-sync|apps|embed|train|test|dataset)" >&2
    exit 2
    ;;
esac
