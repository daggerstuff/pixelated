# Pixelated Empathy — Axolotl Training Image (Enhanced)
#
# Blueprint Appendix D: "Custom Axolotl image" for SFT / DPO / ORPO training.
# Base: nvidia/cuda:12.6-devel-ubuntu22.04 (blueprint §6).
# Python: 3.11 (blueprint §6: "best compatibility with PyTorch 2.4+, bitsandbytes,
#   transformers 4.45+").
#
# Multi-stage build:
#   1. base       — system packages + Python 3.11 + torch (CUDA 12.4 wheels)
#   2. deps       — training requirements + Axolotl (cached layer)
#   3. runtime    — final image with entrypoint, non-root user, healthcheck
#
# Build:
#   docker build -t pixelated-axolotl-train:latest \
#     -f infra/docker/axolotl-train.Dockerfile .
#
# Run (single-GPU SFT):
#   docker run --gpus all --shm-size 16g -v $(pwd):/workspace \
#     pixelated-axolotl-train:latest
#
# Run (ORPO with custom config):
#   docker run --gpus all --shm-size 16g -v $(pwd):/workspace \
#     -e TRAINING_CONFIG=ai/training/configs/orpo_axolotl.yaml \
#     pixelated-axolotl-train:latest
#
# Run (multi-GPU with DeepSpeed ZeRO-3):
#   docker run --gpus all --shm-size 32g -v $(pwd):/workspace \
#     -e NUM_GPUS=8 -e TRAINING_MODE=accelerate \
#     pixelated-axolotl-train:latest
#
# Run (custom command):
#   docker run --gpus all -v $(pwd):/workspace \
#     -e TRAINING_MODE=custom \
#     pixelated-axolotl-train:latest \
#     python -m ai.training.orpo_trainer --help

# ===========================================================================
# Stage 1: Base — system packages + Python 3.11 + torch
# ===========================================================================
FROM nvidia/cuda:12.6.3-devel-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/workspace/.cache/huggingface \
    TRANSFORMERS_CACHE=/workspace/.cache/transformers \
    TORCH_HOME=/workspace/.cache/torch

RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common \
        curl \
        git \
        git-lfs \
        wget \
        build-essential \
        pkg-config \
        openssh-client \
        ca-certificates \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-dev \
        python3.11-distutils \
        python3.11-venv \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && curl -fsSL https://bootstrap.pypa.io/get-pip.py | python3.11

# Install torch first (CUDA 12.4 wheel — compatible with CUDA 12.6 runtime).
RUN pip install --no-cache-dir \
        torch==2.5.1 \
        torchvision==0.20.1 \
        --index-url https://download.pytorch.org/whl/cu124

# ===========================================================================
# Stage 2: Deps — training requirements + Axolotl (cached layer)
# ===========================================================================
FROM base AS deps

COPY ai/configs/requirements_training.txt /tmp/requirements_training.txt
RUN pip install --no-cache-dir -r /tmp/requirements_training.txt

# Axolotl pulls in its own dependency tree (flash-attn, xformers, etc.)
# Install after the base stack so it can detect torch/CUDA versions.
RUN pip install --no-cache-dir axolotl>=0.4.1

# Install accelerate for multi-GPU launch support.
RUN pip install --no-cache-dir accelerate>=0.24.0

# ===========================================================================
# Stage 3: Runtime — final image with entrypoint, non-root user, healthcheck
# ===========================================================================
FROM deps AS runtime

# Build metadata.
ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG VERSION

LABEL org.opencontainers.image.title="Pixelated Empathy — Axolotl Training" \
    org.opencontainers.image.description="Axolotl training image for SFT / DPO / ORPO fine-tuning" \
    org.opencontainers.image.vendor="Pixelated Team" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${GIT_COMMIT}" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.source="https://github.com/vivi/pixelated"

# Workspace setup.
WORKDIR /workspace

# Git LFS for pulling model weights / datasets.
RUN git lfs install

# Non-root user for safety (matches ai/ops/Dockerfile UID 42420).
RUN groupadd -g 42420 axolotl && \
    useradd -u 42420 -g 42420 -m -s /bin/bash axolotl && \
    mkdir -p /workspace/.cache/huggingface \
             /workspace/.cache/transformers \
             /workspace/.cache/torch \
             /workspace/checkpoints \
             /workspace/models \
             /workspace/data && \
    chown -R axolotl:axolotl /workspace

# Copy entrypoint script.
COPY --chmod=0755 infra/docker/axolotl-entrypoint.sh /usr/local/bin/axolotl-entrypoint.sh

# Environment defaults.
ENV TRAINING_CONFIG=ai/training/configs/axolotl.yaml \
    TRAINING_MODE=auto \
    NUM_GPUS=1 \
    WANDB_MODE=offline \
    NCCL_DEBUG=INFO \
    NCCL_IB_DISABLE=0 \
    NCCL_NET_GDR_LEVEL=2 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512 \
    OMP_NUM_THREADS=8

USER axolotl

# Healthcheck — verify Python + torch + CUDA are functional.
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD python3 -c "import torch; torch.cuda.is_available()" || exit 1

ENTRYPOINT ["/usr/local/bin/axolotl-entrypoint.sh"]
CMD []
