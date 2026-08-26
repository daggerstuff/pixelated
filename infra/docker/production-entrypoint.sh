#!/bin/sh

# Production entrypoint script for Pixelated Empathy Platform
set -e

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if required environment variables are set
check_env_vars() {
    log "Checking environment variables..."

    # Critical environment variables that must be set
    local required_vars=(
        "NODE_ENV"
        "DB_HOST"
        "DB_NAME"
        "DB_USER"
        "REDIS_URL"
    )

    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log "ERROR: Required environment variable $var is not set"
            exit 1
        fi
    done

    log "Environment variables validated"
}

# Function to wait for database to be ready
wait_for_database() {
    log "Waiting for database to be ready..."

    local max_attempts=60
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
            log "Database is ready"
            return 0
        fi

        log "Database not ready yet (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done

    log "ERROR: Database not ready after $max_attempts attempts"
    exit 1
}

# Function to wait for Redis to be ready
wait_for_redis() {
    log "Waiting for Redis to be ready..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
            log "Redis is ready"
            return 0
        fi

        log "Redis not ready yet (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done

    log "ERROR: Redis not ready after $max_attempts attempts"
    exit 1
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."

    # Wait a bit for database to be fully ready
    sleep 5

    # Run migrations using the application's migration system
    if [ -f "/app/scripts/run-migrations.sh" ]; then
        /app/scripts/run-migrations.sh
    else
        log "No migration script found, skipping migrations"
    fi

    log "Database migrations completed"
}

# Function to perform health check
health_check() {
    log "Performing final health check..."

    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:4321/api/health" > /dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi

        log "Health check failed (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done

    log "ERROR: Health check failed after $max_attempts attempts"
    exit 1
}

# Function to start application
start_application() {
    log "Starting Pixelated Empathy Platform..."

    # Set production optimizations
    export NODE_ENV=production
    export NODE_OPTIONS="--max-old-space-size=8192"

    # Start the application
    exec node dist/server/entry.mjs
}

# Main execution flow
main() {
    log "🚀 Starting Pixelated Empathy Platform in production mode"

    check_env_vars
    wait_for_database
    wait_for_redis
    run_migrations
    health_check
    start_application
}

# Handle shutdown signals gracefully
trap 'log "Received shutdown signal, stopping gracefully..."; exit 0' TERM INT

# Run main function
main "$@"