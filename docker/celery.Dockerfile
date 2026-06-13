# Pixelated Empathy — Celery Worker Dockerfile
FROM python:3.13-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[pe]"

COPY src/pe/ src/pe/

CMD ["celery", "-A", "src.pe.celery_app", "worker", "--loglevel=info", "--concurrency=4"]