#!/usr/bin/env bash
# rollback-model.sh — one-command rollback to a previously tagged checkpoint.
#
# Usage:
#   scripts/devops/rollback-model.sh <run-id>
#
# This is a thin shell wrapper around the Python model-registry CLI.
# It also handles the S3 sync before updating the local symlink.
#
# Prerequisites:
#   - aws CLI installed and configured
#   - PIX_S3_BUCKET environment variable set (default: pixelated-models)
#   - PIX_CHECKPOINT_DIR environment variable (default: /tmp/pixelated-checkpoints)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_CLI="$SCRIPT_DIR/model-registry.py"
S3_BUCKET="${PIX_S3_BUCKET:-pixelated-models}"
CHECKPOINT_DIR="${PIX_CHECKPOINT_DIR:-/tmp/pixelated-checkpoints}"

if [ $# -ne 1 ]; then
    echo "Usage: $0 <run-id>" >&2
    echo "Example: $0 grpo-20260613" >&2
    exit 1
fi

RUN_ID="$1"
CHECKPOINT_PATH="$CHECKPOINT_DIR/$RUN_ID"
ACTIVE_LINK="$CHECKPOINT_DIR/active"

# 1. Verify the run_id exists in the registry
echo "[1/4] Verifying run ID '$RUN_ID' in registry..."
uv run python "$REGISTRY_CLI" show "$RUN_ID" > /dev/null 2>&1 || {
    echo "ERROR: Run ID '$RUN_ID' not found in registry." >&2
    echo "       Run 'uv run python scripts/devops/model-registry.py list' to see available checkpoints." >&2
    exit 1
}

# 2. Pull checkpoint from S3 if not present locally
if [ ! -d "$CHECKPOINT_PATH" ]; then
    echo "[2/4] Downloading checkpoint from S3 (s3://$S3_BUCKET/models/$RUN_ID/)..."
    aws s3 sync "s3://$S3_BUCKET/models/$RUN_ID/" "$CHECKPOINT_PATH" --no-progress || {
        echo "WARNING: S3 download failed. Checkpoint may not be in S3 yet."
        echo "         Creating local directory for future use."
        mkdir -p "$CHECKPOINT_PATH"
    }
else
    echo "[2/4] Checkpoint found locally at $CHECKPOINT_PATH"
fi

# 3. Update the active symlink
echo "[3/4] Updating active symlink..."
if [ -L "$ACTIVE_LINK" ] || [ -e "$ACTIVE_LINK" ]; then
    rm -rf "$ACTIVE_LINK"
fi
ln -sf "$CHECKPOINT_PATH" "$ACTIVE_LINK"
echo "       Active model -> $CHECKPOINT_PATH"

# 4. Update registry manifest
echo "[4/4] Updating registry manifest..."
uv run python "$REGISTRY_CLI" rollback "$RUN_ID" --checkpoint-dir "$CHECKPOINT_DIR"

echo ""
echo "✓ Rollback to $RUN_ID complete."
echo "  Active model path: $ACTIVE_LINK"
