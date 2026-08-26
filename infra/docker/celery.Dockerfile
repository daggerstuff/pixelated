# Pixelated Empathy — Celery Worker Dockerfile
FROM python:3.13-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[pe]"

COPY apps/web/src/pe/ src/pe/

# Create non-root user and fix permissions
RUN groupadd -g 1001 app && useradd -u 1001 -g app -m app && \
    chown -R app:app /app

USER app

CMD ["celery", "-A", "src.pe.celery_app", "worker", "--loglevel=info", "--concurrency=4"]