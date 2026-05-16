FROM python:3.13-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Install dependencies
COPY ai-services/requirements.txt ./
RUN uv pip install --no-cache --system -r requirements.txt --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match

# Copy application code
COPY ai-services/ ./
COPY ai-services/security/ ./security/

RUN groupadd -g 42420 appuser && \
    useradd -u 42420 -g appuser -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose port
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import socket,sys; s=socket.socket(); s.connect_ex((\"127.0.0.1\", 5000)); sys.exit(0)" || exit 1

# Run the API server
CMD ["python", "api.py"]
