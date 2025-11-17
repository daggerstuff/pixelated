# Dockerfile for Journal Research API Server
# Multi-stage build for optimized production image

FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Runtime stage
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy installed packages from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY ai/journal_dataset_research/api ./ai/journal_dataset_research/api
COPY ai/journal_dataset_research/__init__.py ./ai/journal_dataset_research/__init__.py

# Create non-root user
RUN groupadd -r api && useradd -r -g api api
RUN chown -R api:api /app

USER api

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run the API server
CMD ["/app/.venv/bin/python", "-m", "ai.journal_dataset_research.api.server"]

