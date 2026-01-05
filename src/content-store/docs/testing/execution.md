---
title: 'Test Execution'
description: 'Guide to running and managing tests in Pixelated'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

# Test Execution

This guide covers how to run tests, configure test environments, and manage test execution in Pixelated.

## Test Commands

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- path/to/test.spec.ts

# Run tests matching pattern
npm test -- -t "auth flow"
```

### Test Suites

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# API tests
npm run test:api
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Generate and open HTML coverage report
npm run test:coverage:html

# Check coverage thresholds
npm run test:coverage:check
```

## Test Environment

### Environment Setup

1. Create test database:

```bash
npm run db:create:test
```

2. Run migrations:

```bash
npm run db:migrate:test
```

3. Seed test data:

```bash
npm run db:seed:test
```

### Environment Variables

Create `.env.test`:

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/gradiant_test

# Redis
REDIS_URL=redis://localhost:6379/1

# Test Users
TEST_USER_EMAIL=test@gemcity.xyz
TEST_USER_PASSWORD=testpass123

# API Keys
TEST_STRIPE_KEY=sk_test_...
TEST_SENDGRID_KEY=SG.test...
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:

- Pull requests
- Push to main branch
- Daily scheduled runs

```yaml
name: Tests

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: gradiant_test
        ports:
          - 5432:5432

      redis:
        image: redis:6
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:migrate:test

      - name: Run tests
        run: npm run test:ci
```

## Performance Optimization

### Parallel Execution

Run tests in parallel:

```bash
# Run with 4 workers
npm test -- --parallel --jobs=4

# Run specific suites in parallel
npm run test:integration -- --parallel
```

### Test Sharding

Split tests across CI jobs:

```bash
# Run shard 1 of 4
npm test -- --shard=1/4

# Run shard 2 of 4
npm test -- --shard=2/4
```

## Debugging

### Debug Mode

```bash
# Run with Node inspector
npm test -- --inspect

# Run specific test with debugger
npm test -- --inspect-brk path/to/test.spec.ts
```

### Verbose Output

```bash
# Run with detailed logs
npm test -- --verbose

# Show test timing
npm test -- --verbose --timing
```

## Test Maintenance

### Updating Snapshots

```bash
# Update all snapshots
npm test -- -u

# Update specific snapshot
npm test -- -u path/to/test.spec.ts
```

### Clearing Cache

```bash
# Clear Vitest cache
npm test -- --clearCache

# Clear all test artifacts
npm run test:clean
```

For more information about specific testing areas, refer to:

- [Test Patterns](/testing/patterns)
- [Debugging Tests](/testing/debugging)
- [Coverage Requirements](/testing/coverage)

```

```
