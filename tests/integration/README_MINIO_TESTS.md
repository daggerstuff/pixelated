# MinIO Integration Tests

## Overview

This test suite validates MinIO/S3 object storage operations to ensure that the upgrade from `minio==7.1.0` to `minio==7.2.11` doesn't introduce regressions in critical storage functionality.

## Test Coverage

The test suite covers:

- **Bucket Operations**: Creation, listing, existence checks
- **Object Operations**: Upload (bytes/file), download (bytes/file), listing, metadata, deletion
- **Presigned URLs**: GET and PUT URL generation with expiration
- **Error Handling**: Non-existent objects, invalid operations
- **Content Types**: Explicit content type handling, binary data
- **Region Handling**: S3-compatible region configuration
- **Signature Calculation**: Authentication signature verification (critical for security)

## Prerequisites

1. **MinIO Server**: A local MinIO instance must be running
2. **Python Dependencies**: `minio>=7.2.11` and `pytest` installed

## Running Tests

### Option 1: Using Docker Compose (Recommended)

Start MinIO using the existing docker-compose configuration:

```bash
# Start MinIO from docker-compose.milvus.yml
docker-compose -f docker-compose.milvus.yml up -d minio

# Or use the multimodal service docker-compose
docker-compose -f src/lib/ai/multimodal-bias-detection/python-service/docker-compose.yml up -d minio

# Wait for MinIO to be ready (health check)
sleep 5

# Run tests
pytest tests/integration/test_minio_storage.py -v
```

### Option 2: Standalone MinIO Server

If you have MinIO installed locally:

```bash
# Start MinIO server
minio server /path/to/data --console-address ":9001"

# In another terminal, run tests
pytest tests/integration/test_minio_storage.py -v
```

### Option 3: Custom Configuration

Set environment variables to point to your MinIO instance:

```bash
export MINIO_ENDPOINT=your-minio-host:9000
export MINIO_ACCESS_KEY=your-access-key
export MINIO_SECRET_KEY=your-secret-key
export MINIO_SECURE=false  # or true for HTTPS
export MINIO_REGION=us-east-1

pytest tests/integration/test_minio_storage.py -v
```

## Skipping Tests

To skip MinIO tests (e.g., in CI when MinIO is not available):

```bash
export SKIP_MINIO_TESTS=true
pytest tests/integration/test_minio_storage.py -v
```

## Test Structure

```
tests/integration/test_minio_storage.py
├── TestMinIOBucketOperations      # Bucket CRUD operations
├── TestMinIOObjectOperations       # Object upload/download/list
├── TestMinIOPresignedURLs         # Presigned URL generation
├── TestMinIOErrorHandling         # Error cases and edge cases
├── TestMinIOContentTypes          # Content type handling
├── TestMinIORegionHandling        # Region configuration
└── TestMinIOSignatureCalculation  # Authentication signatures
```

## What These Tests Verify

### Critical Behaviors (Post-Upgrade Validation)

1. **Signature Calculation**: MinIO has had signature calculation changes across versions. Tests verify that:
   - Multiple operations with the same client maintain correct signatures
   - Presigned URLs contain valid signature parameters

2. **Path-Style vs Virtual-Hosted-Style**: Tests ensure addressing works correctly regardless of bucket naming

3. **TLS/SSL Handling**: Tests verify secure connections work (when `MINIO_SECURE=true`)

4. **Response Parsing**: Tests verify that response objects are parsed correctly (stat, list operations)

5. **Authentication**: Tests verify that access keys and secret keys work correctly

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# Example GitHub Actions step
- name: Start MinIO
  run: |
    docker-compose -f docker-compose.milvus.yml up -d minio
    sleep 10  # Wait for health check

- name: Run MinIO Integration Tests
  run: |
    pytest tests/integration/test_minio_storage.py -v --tb=short
  env:
    MINIO_ENDPOINT: localhost:9000
    MINIO_ACCESS_KEY: minioadmin
    MINIO_SECRET_KEY: minioadmin
```

## Troubleshooting

### Connection Errors

If tests fail with connection errors:

1. Verify MinIO is running: `curl http://localhost:9000/minio/health/live`
2. Check endpoint configuration: `echo $MINIO_ENDPOINT`
3. Verify credentials: Check `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`

### Permission Errors

If tests fail with permission errors:

1. Verify bucket creation permissions
2. Check MinIO root user credentials
3. Ensure test buckets can be created and deleted

### Timeout Errors

If tests timeout:

1. Check MinIO server logs
2. Verify network connectivity
3. Increase timeout values if needed

## Related Files

- `src/lib/ai/training/requirements.txt` - MinIO version specification
- `docker-compose.milvus.yml` - MinIO service configuration
- `src/lib/ai/multimodal-bias-detection/python-service/docker-compose.yml` - Alternative MinIO config

## Notes

- Tests create temporary buckets with unique names for isolation
- All test buckets are automatically cleaned up after tests
- Tests are designed to be idempotent and safe to run multiple times
- Each test class is independent and can be run in isolation
