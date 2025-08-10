# syntax=docker/dockerfile:1.7-labs
# Use tag without digest to allow pulling the correct arch variant (amd64 set via compose)
FROM python:3.11-slim

# Ensure amd64 build
ARG TARGETPLATFORM
RUN echo "Building for: ${TARGETPLATFORM}" && true

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install LiteLLM
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "litellm[proxy]==1.53.2" uvicorn[standard]

# Runtime
WORKDIR /app
EXPOSE 8080

# Default command will be provided by compose via args
ENTRYPOINT ["litellm", "--config", "/app/config.yaml", "--port", "8080"]
