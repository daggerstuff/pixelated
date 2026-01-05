# Multi-stage Docker build for bias detection service

# Build stage
FROM python:3.11-slim as builder

# Set build arguments
ARG APP_USER=appuser
ARG APP_UID=1000
ARG APP_GID=1000

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -g $APP_GID $APP_USER && \
    useradd -u $APP_UID -g $APP_GID -m -s /bin/bash $APP_USER

# Set working directory
WORKDIR /app

# Install uv package manager
RUN pip install --no-cache-dir uv

# Copy requirements and install dependencies
COPY pyproject.toml ./
RUN uv pip install --system --no-cache-dir -e .

# Runtime stage
FROM python:3.11-slim as runtime

# Set runtime arguments
ARG APP_USER=appuser
ARG APP_UID=1000
ARG APP_GID=1000

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -g $APP_GID $APP_USER && \
    useradd -u $APP_UID -g $APP_GID -m -s /bin/bash $APP_USER

# Set working directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=$APP_USER:$APP_USER . .

# Create models directory
RUN mkdir -p /app/models && chown $APP_USER:$APP_USER /app/models

# Switch to app user
USER $APP_USER

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Default command
CMD ["uv", "run", "python", "-m", "bias_detection.app"]

# Production stage with security hardening
FROM runtime as production

# Remove unnecessary packages and files
RUN apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Set security-focused environment variables
ENV APP_ENV=production
ENV DEBUG=false

# Use gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "--keep-alive", "5", "--max-requests", "1000", "--max-requests-jitter", "100", "bias_detection.app:app"]

# Development stage
FROM runtime as development

# Install development dependencies
RUN pip install --no-cache-dir \
    pytest \
    pytest-asyncio \
    pytest-cov \
    mypy \
    black \
    isort \
    flake8

# Set development environment variables
ENV APP_ENV=development
ENV DEBUG=true
ENV LOG_LEVEL=DEBUG

# Default command for development
CMD ["uv", "run", "python", "-m", "bias_detection.app", "--reload"]

# Testing stage
FROM development as testing

# Copy test files
COPY --chown=$APP_USER:$APP_USER tests/ /app/tests/

# Run tests by default
CMD ["pytest", "-v", "--cov=bias_detection", "--cov-report=term-missing", "tests/"]