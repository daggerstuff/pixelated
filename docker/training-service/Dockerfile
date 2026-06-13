# Foundation Model Training Service - GPU Enabled
# HETZNER Golden Image Strategy: Datasets baked into image to avoid DATASYNC errors
FROM nvidia/cuda:12.6.3-devel-ubuntu22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/New_York

# Install Python 3.13 and system dependencies
# Ubuntu 22.04 doesn't ship 3.13 — add deadsnakes PPA first
RUN apt-get update && \
    apt-get install --no-install-recommends -y software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa -y && \
    apt-get update && \
    apt-get install --no-install-recommends -y \
    python3.13 \
    python3.13-venv \
    python3.13-dev \
    python3-pip \
    curl \
    git \
    build-essential \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install uv package manager via official installer (avoids py3.13 pip/distutils issues)
RUN curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh

WORKDIR /app

# Create virtual environment with Python 3.13
RUN python3.13 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app"

# Copy requirements for training service (from actual location)
COPY ai/config/requirements_training.txt ./requirements.txt
RUN uv pip install --python /opt/venv/bin/python --no-cache-dir -r requirements.txt

# Note: torch, transformers, peft, accelerate, bitsandbytes, and other training deps
# are already installed via requirements_training.txt above with Python 3.13-compatible versions.

FROM base AS production

# Create non-root user for security
RUN groupadd -g 1001 training || true && \
    useradd -u 1001 -g 1001 -s /bin/sh -M -N -r training || true

# Create necessary directories
RUN mkdir -p /app/data /app/models /app/checkpoints /app/logs && \
    chown -R training:training /app

# Copy training code (from actual location)
COPY --chown=training:training ai/training ./ai/training

#DATASYNC_FIX: Download datasets from S3 at runtime instead of baking in
# This prevents 8GB+ context transfer and DATASYNC_RETRY_ERROR
RUN mkdir -p /app/data/compiled_dataset /app/data/stage2

# Create placeholder to indicate data will be downloaded at runtime
RUN echo "Datasets will be downloaded from S3 at runtime" > /app/data/README.txt

USER training

EXPOSE 8003

# Health check for training service
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

# Default command - run Stage 1 training
# Override with: --stage stage2 or --stage stage3
CMD ["python", "/app/ai/training/ready_packages/platforms/hetzner/train_hetzner_canonical.py", "--stage", "foundation"]
