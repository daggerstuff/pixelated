#!/bin/bash
# ============================================================================
# Pixelated Empathy — Backend Container Entrypoint
# Runs database migrations before starting the service.
# Used by express-api and other Node service containers.
# ============================================================================

set -e

echo "[entrypoint] Pixelated Empathy backend starting..."
echo "[entrypoint] NODE_ENV=${NODE_ENV:-development}"

# ── Wait for PostgreSQL ──────────────────────────────────────────────────
if [ -n "${DATABASE_URL}" ]; then
    echo "[entrypoint] Waiting for PostgreSQL..."
    # Extract host and port from DATABASE_URL
    PG_HOST=$(echo "${DATABASE_URL}" | sed -n 's/.*@\([^:]*\):\([0-9]*\)\/.*/\1/p')
    PG_PORT=$(echo "${DATABASE_URL}" | sed -n 's/.*@\([^:]*\):\([0-9]*\)\/.*/\2/p')

    if [ -z "${PG_HOST}" ] || [ -z "${PG_PORT}" ]; then
        PG_HOST="postgres"
        PG_PORT="5432"
        echo "[entrypoint] Could not parse DATABASE_URL, using defaults: ${PG_HOST}:${PG_PORT}"
    fi

    MAX_RETRIES=30
    RETRY=0
    until nc -z "${PG_HOST}" "${PG_PORT}" 2>/dev/null || [ ${RETRY} -eq ${MAX_RETRIES} ]; do
        echo "[entrypoint] PostgreSQL not ready (${RETRY}/${MAX_RETRIES}), waiting..."
        sleep 2
        RETRY=$((RETRY + 1))
    done

    if [ ${RETRY} -eq ${MAX_RETRIES} ]; then
        echo "[entrypoint] WARNING: PostgreSQL not reachable after ${MAX_RETRIES} retries, continuing anyway..."
    else
        echo "[entrypoint] PostgreSQL is ready."

        # Run Node database migrations
        if [ -f "scripts/db-migrate.ts" ] && command -v npx >/dev/null 2>&1; then
            echo "[entrypoint] Running Node database migrations..."
            npx tsx scripts/db-migrate.ts migrate || echo "[entrypoint] Node migrations completed (some may have been skipped)"
        else
            echo "[entrypoint] No Node migration runner found, skipping."
        fi
    fi
fi

# ── Wait for Redis ───────────────────────────────────────────────────────
if [ -n "${REDIS_URL}" ]; then
    echo "[entrypoint] Waiting for Redis..."
    REDIS_HOST=$(echo "${REDIS_URL}" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    REDIS_PORT=$(echo "${REDIS_URL}" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    [ -z "${REDIS_HOST}" ] && REDIS_HOST="redis"
    [ -z "${REDIS_PORT}" ] && REDIS_PORT="6379"

    MAX_RETRIES=30
    RETRY=0
    until nc -z "${REDIS_HOST}" "${REDIS_PORT}" 2>/dev/null || [ ${RETRY} -eq ${MAX_RETRIES} ]; do
        echo "[entrypoint] Redis not ready (${RETRY}/${MAX_RETRIES}), waiting..."
        sleep 2
        RETRY=$((RETRY + 1))
    done
    echo "[entrypoint] Redis is ready."
fi

# ── Wait for MongoDB ─────────────────────────────────────────────────────
if [ -n "${MONGODB_URI}" ]; then
    echo "[entrypoint] Waiting for MongoDB..."
    MONGO_HOST=$(echo "${MONGODB_URI}" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    MONGO_PORT=$(echo "${MONGODB_URI}" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    [ -z "${MONGO_HOST}" ] && MONGO_HOST="mongo"
    [ -z "${MONGO_PORT}" ] && MONGO_PORT="27017"

    MAX_RETRIES=20
    RETRY=0
    until nc -z "${MONGO_HOST}" "${MONGO_PORT}" 2>/dev/null || [ ${RETRY} -eq ${MAX_RETRIES} ]; do
        echo "[entrypoint] MongoDB not ready (${RETRY}/${MAX_RETRIES}), waiting..."
        sleep 2
        RETRY=$((RETRY + 1))
    done
    echo "[entrypoint] MongoDB is ready."
fi

echo "[entrypoint] All dependencies are ready. Starting service..."

# Execute the main command (CMD from Dockerfile)
exec "$@"
