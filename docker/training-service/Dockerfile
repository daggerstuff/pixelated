# Foundation Model Training Service - GPU Enabled
FROM nvidia/cuda:12.1-devel-ubuntu22.04 AS base

# Install Python 3.11 and system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    python3.11=3.11.0~rc1-1~22.04 \
    python3.11-venv=3.11.0~rc1-1~22.04 \
    python3.11-dev=3.11.0~rc1-1~22.04 \
    python3-pip=22.0.2+dfsg-1ubuntu0.4 \
    curl=7.81.0-1ubuntu1.15 \
    git=1:2.34.1-1ubuntu1.10 \
    build-essential=12.9ubuntu3 \
    ca-certificates=20230311ubuntu0.22.04.1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN python3.11 -m pip install --no-cache-dir uv==0.4.18

WORKDIR /app

# Create virtual environment with Python 3.11
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app:$PYTHONPATH"

# Copy requirements for training service
COPY src/lib/ai/training/requirements.txt ./requirements.txt
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
    wandb==0.16.0

FROM base AS production

# Create non-root user for security
RUN groupadd -g 1001 training || true && \
    useradd -u 1001 -g 1001 -s /bin/sh -M -N -r training || true

# Create necessary directories
RUN mkdir -p /app/data /app/models /app/checkpoints /app/logs && \
    chown -R training:training /app

# Copy training code
COPY --chown=training:training src/lib/ai/training ./src/lib/ai/training
COPY --chown=training:training .kiro/specs/foundation-model-training ./specs

USER training

EXPOSE 8003

# Health check for training service
HEALTHCHECK --interval=60s --timeout=30s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

# Default command for training service
CMD ["python", "src/lib/ai/training/server.py"]