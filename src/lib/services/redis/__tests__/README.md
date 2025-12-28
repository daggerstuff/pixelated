# Redis Service Testing Guide

This guide explains how to effectively run tests for the Redis service, handle common issues, and configure the test environment correctly.

## Test Configuration

### Environment Variables

The Redis tests require the following environment variables:

```bash
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=test:
```

These can be set in your environment or supplied directly when running tests.

## Running Tests

### Standard Test Run

Run all Redis tests with:

```bash
pnpm test src/lib/services/redis/__tests__
```

### Skip Redis Performance Tests

To skip potentially flaky performance tests:

```bash
SKIP_REDIS_TESTS=true pnpm test src/lib/services/redis/__tests__
```

Alternatively, use the script:

```bash
pnpm test:skip-redis
```

### Using the Safe Test Runner

A script that automatically sets up the environment and handles Redis availability:

```bash
pnpm test:safe
```

This script:
1. Verifies Redis is running
2. Creates necessary test mocks
3. Sets appropriate environment variables
4. Runs tests with optimal concurrency settings

## Common Issues and Solutions

### Redis Connection Errors

**Problem**: `RedisServiceError: Failed to connect to Redis`

**Solutions**:
- Ensure Redis is running locally with `redis-cli ping`
- Set `SKIP_REDIS_TESTS=true` to skip Redis perf tests
- Use the mock Redis implementation by running in development mode
- Check for Redis connectivity issues if in CI

### Mock Expectations Errors

**Problem**: `TypeError: expect(...).toBe is not a function`

**Solution**:
- These errors typically occur when test matchers aren't properly available
- Make sure custom matchers have been correctly defined and extended
- Reset mocks between tests with `vi.resetAllMocks()`

### Redis Already Connected Errors

**Problem**: `Error: Redis is already connecting/connected`

**Solutions**:
- Ensure `disconnect()` is called in test teardown
- Use `beforeEach`/`afterEach` to properly setup/teardown Redis
- Reduce test concurrency with `--poolOptions.threads.maxThreads=3`

## Mock Implementation

The Redis service includes a mock implementation for testing in `src/lib/services/redis/__mocks__/redis.mock.ts`. This provides an in-memory version of Redis functionality that doesn't require a real Redis server.

To use the mock, set the `NODE_ENV=development` or explicitly skip Redis tests as described above.

## CI Environment

In CI environments, the Redis service should be configured via Docker services. An example configuration is available in the GitHub workflow files.
