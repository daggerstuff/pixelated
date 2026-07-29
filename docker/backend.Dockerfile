# Pixelated Empathy — FastAPI Backend Dockerfile
FROM python:3.13-slim AS base

# Apply OS-level security updates then install system deps
RUN apt-get update && apt-get upgrade -y --no-install-recommends && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[pe]"

# Copy application code
COPY src/pe/ src/pe/
COPY src/pe/migrations/alembic.ini src/pe/migrations/

# Create non-root user and fix permissions
RUN groupadd -g 1001 app && useradd -u 1001 -g app -m app && \
    chown -R app:app /app

USER app

EXPOSE 8000

CMD ["uvicorn", "src.pe.main:app", "--host", "0.0.0.0", "--port", "8000"]