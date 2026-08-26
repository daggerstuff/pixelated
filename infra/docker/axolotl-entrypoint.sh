#!/usr/bin/env bash
# Axolotl training entrypoint script.
#
# Supports three modes:
#   1. Direct axolotl CLI (default):  axolotl train <config>
#   2. Accelerate multi-GPU launch:   accelerate launch --num_processes N -m axolotl.cli.train <config>
#   3. Custom command:                any shell command (just pass it)
#
# Environment variables:
#   TRAINING_CONFIG   — path to Axolotl YAML config (default: ai/training/configs/axolotl.yaml)
#   NUM_GPUS          — number of GPUs for accelerate launch (default: 1; >1 triggers accelerate)
#   TRAINING_MODE     — "axolotl" (default) or "accelerate" or "custom"
#   WANDB_MODE        — passed through to wandb (offline/online/disabled)
#   HF_HOME           — HuggingFace cache directory
#
# Usage examples:
#   docker run --gpus all pixelated-axolotl-train:latest
#   docker run --gpus all -e TRAINING_CONFIG=ai/training/configs/orpo_axolotl.yaml pixelated-axolotl-train:latest
#   docker run --gpus all -e NUM_GPUS=8 -e TRAINING_MODE=accelerate pixelated-axolotl-train:latest
#   docker run --gpus all pixelated-axolotl-train:latest python -m ai.training.orpo_trainer --help

set -euo pipefail

# Color output for readability.
info()  { printf '\033[0;36m[entrypoint]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[entrypoint]\033[0m %s\n' "$*" >&2; }
error() { printf '\033[0;31m[entrypoint]\033[0m %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

# Verify GPU is available (unless overridden).
if [ "${SKIP_GPU_CHECK:-0}" != "1" ]; then
    if ! python3 -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
        warn "CUDA not available — training will fail without a GPU."
        warn "Set SKIP_GPU_CHECK=1 to suppress this warning."
    else
        GPU_COUNT=$(python3 -c "import torch; print(torch.cuda.device_count())")
        GPU_NAME=$(python3 -c "import torch; print(torch.cuda.get_device_name(0))" 2>/dev/null || echo "unknown")
        info "GPU detected: ${GPU_NAME} (count=${GPU_COUNT})"
    fi
fi

# Resolve training config.
CONFIG="${TRAINING_CONFIG:-ai/training/configs/axolotl.yaml}"
if [ ! -f "/workspace/${CONFIG}" ]; then
    warn "Training config not found at /workspace/${CONFIG}"
    warn "Available configs:"
    ls /workspace/ai/training/configs/*.yaml 2>/dev/null || warn "  (no YAML configs found)"
fi

# ---------------------------------------------------------------------------
# Mode selection
# ---------------------------------------------------------------------------

MODE="${TRAINING_MODE:-auto}"
NUM_GPUS="${NUM_GPUS:-1}"

# Auto-detect mode: if NUM_GPUS > 1, use accelerate; otherwise use axolotl CLI.
if [ "${MODE}" = "auto" ]; then
    if [ "${NUM_GPUS}" -gt 1 ]; then
        MODE="accelerate"
    else
        MODE="axolotl"
    fi
fi

info "Training mode: ${MODE}"
info "Training config: ${CONFIG}"
info "Number of GPUs: ${NUM_GPUS}"

# ---------------------------------------------------------------------------
# Execute
# ---------------------------------------------------------------------------

case "${MODE}" in
    axolotl)
        info "Starting single-GPU training: axolotl train ${CONFIG}"
        exec axolotl train "${CONFIG}"
        ;;

    accelerate)
        info "Starting multi-GPU training: accelerate launch --num_processes ${NUM_GPUS}"
        exec accelerate launch \
            --num_processes "${NUM_GPUS}" \
            --multi_gpu \
            -m axolotl.cli.train "${CONFIG}"
        ;;

    custom)
        # Pass through to whatever command was provided.
        info "Running custom command: $*"
        exec "$@"
        ;;

    *)
        error "Unknown TRAINING_MODE: ${MODE}"
        error "Valid modes: auto (default), axolotl, accelerate, custom"
        exit 1
        ;;
esac
