# Foundation Model Training Service - GPU Enabled
# OVH Golden Image Strategy: Datasets baked into image to avoid DATASYNC errors
FROM nvidia/cuda:12.1.0-devel-ubuntu22.04 AS base

# Install Python 3.11 and system dependencies
RUN apt-get update && \
    apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    curl \
    git \
    build-essential \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN python3.11 -m pip install --no-cache-dir uv==0.4.18

WORKDIR /app

# Create virtual environment with Python 3.11
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app"

# Copy requirements for training service (from actual location)
COPY ai/training/requirements.txt ./requirements.txt
RUN uv pip install --python /opt/venv/bin/python --no-cache-dir -r requirements.txt

# Install PyTorch with CUDA support
RUN uv pip install --python /opt/venv/bin/python --no-cache-dir \
    torch==2.1.0+cu121 \
    torchvision==0.16.0+cu121 \
    torchaudio==2.1.0+cu121 \
    --index-url https://download.pytorch.org/whl/cu121

# Install Lightning.ai and training dependencies
RUN uv pip install --python /opt/venv/bin/python --no-cache-dir \
    lightning==2.1.0 \
    transformers==4.35.0 \
    datasets==2.14.0 \
    peft==0.6.0 \
    bitsandbytes==0.41.0 \
    accelerate==0.24.0 \
    wandb==0.16.0 \
    unsloth

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
CMD ["python", "/app/ai/training/ready_packages/platforms/ovh/train_ovh.py", "--stage", "stage1"]
