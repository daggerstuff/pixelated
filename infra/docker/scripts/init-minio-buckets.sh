#!/bin/bash
# MinIO Bucket Initialization Script
# Creates required buckets for local development

set -e

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
# Credentials must be provided via environment variables (no defaults)
if [ -z "$MINIO_ACCESS_KEY" ] || [ -z "$MINIO_SECRET_KEY" ]; then
echo "ERROR: MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables are required"
exit 1
fi

echo "=== MinIO Bucket Initialization ==="
echo "Endpoint: $MINIO_ENDPOINT"

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
for i in {1..30}; do
    if curl -s "$MINIO_ENDPOINT/minio/health/live" > /dev/null 2>&1; then
        echo "MinIO is ready!"
        break
    fi
    echo "Attempt $i/30 - waiting..."
    sleep 2
done

# Install mc if not present
if ! command -v mc &> /dev/null; then
    echo "Installing MinIO Client (mc)..."
    wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
    chmod +x /tmp/mc
    MC_CMD="/tmp/mc"
else
    MC_CMD="mc"
fi

# Configure mc alias
$MC_CMD alias set pixelated-minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

# Create required buckets
BUCKETS=(
    "pixel-data"
    "pixel-data-backup"
    "test-data"
    "model-registry"
    "artifacts"
)

echo "Creating buckets..."
for bucket in "${BUCKETS[@]}"; do
    if ! $MC_CMD ls "pixelated-minio/$bucket" &> /dev/null; then
        echo "  Creating bucket: $bucket"
        $MC_CMD mb "pixelated-minio/$bucket" --ignore-existing
        # Skip public access setting - buckets are private by default
# $MC_CMD anonymous set download "pixelated-minio/$bucket"
    else
        echo "  Bucket exists: $bucket"
    fi
done

# Bucket policies are private by default (secure)
echo "Bucket policies: All buckets private (secure by default)"

echo "=== MinIO Initialization Complete ==="
echo "Console: http://localhost:9001"
echo "API: http://localhost:9000"
echo "Username: $MINIO_ACCESS_KEY"
echo "Password: $MINIO_SECRET_KEY"
