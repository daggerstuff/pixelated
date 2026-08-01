# Pixelated Empathy — FastAPI Backend (src/pe)
# Multi-stage build for the clinical simulation platform

FROM python:3.13-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install uv for fast dependency management
RUN pip install --no-cache-dir uv

# Copy dependency manifests
COPY pyproject.toml uv.lock ./

# Install dependencies into a virtual environment
# Try editable install from pyproject.toml first; fall back to explicit package list.
# Always ensure asyncpg is present (required by the entrypoint DB-wait probe).
RUN uv venv /app/.venv && \
    uv pip install --python /app/.venv/bin/python -e "." || \
    uv pip install --python /app/.venv/bin/python fastapi uvicorn sqlalchemy[asyncio] asyncpg \
        pydantic pydantic-settings structlog python-jose[cryptography] passlib[bcrypt] \
        alembic redis celery pyyaml && \
    uv pip install --python /app/.venv/bin/python asyncpg

# ── Runtime stage ──────────────────────────────────────────────────
FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy application source
COPY src/pe/ /app/src/pe/
COPY src/lib/ /app/src/lib/

# Copy alembic config if it exists
COPY alembic.ini* /app/

# Create entrypoint
RUN cat > /app/entrypoint.sh <<'ENTRYPOINT'
#!/bin/sh
set -e

echo "[pe-backend] Waiting for PostgreSQL..."
until python -c "
import asyncio, asyncpg, os
async def check():
    try:
        url = os.environ.get('PE_DATABASE_URL', '').replace('+asyncpg', '')
        if not url:
            print('PE_DATABASE_URL not set, skipping DB wait')
            return
        conn = await asyncpg.connect(url)
        await conn.close()
        print('PostgreSQL is ready')
    except Exception as e:
        print(f'Waiting: {e}')
        raise
asyncio.run(check())
"; do
    sleep 2
done

echo "[pe-backend] Running Alembic migrations..."
if [ -f /app/src/pe/migrations/alembic.ini ]; then
    cd /app && alembic -c src/pe/migrations/alembic.ini upgrade head || echo "Alembic: no migrations to run or alembic not configured"
elif [ -f /app/alembic.ini ]; then
    cd /app && alembic upgrade head || echo "Alembic: no migrations to run or alembic not configured"
else
    echo "[pe-backend] No alembic.ini found, skipping migrations"
fi

echo "[pe-backend] Starting FastAPI server..."
exec uvicorn src.pe.main:app --host 0.0.0.0 --port 8000
ENTRYPOINT
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -sf http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
