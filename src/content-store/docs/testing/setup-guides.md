---
title: 'Testing Environment Setup Guides'
description: 'Comprehensive guides for setting up testing environments for Pixelated'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

## Testing Environment Setup Guides

This document provides detailed instructions for setting up various testing environments for the
Pixelated platform. Following these guides will ensure consistent testing across development,
CI/CD, and production environments.

### Local Development Environment Setup

#### Prerequisites

- Node.js v18.17.0 or higher
- pnpm v8.6.0 or higher
- Docker and Docker Compose (for integration tests)
- Git

#### Basic Setup

1. Clone the repository:

```bash
git clone https://github.com/gradiantascent/gradiant.git
cd gradiant
```

2. Install dependencies:

```bash
pnpm install --no-frozen-lockfile
```

3. Set up environment variables:

```bash
cp .env.example .env.test.local
```

4. Edit `.env.test.local` to configure test-specific variables:

```bash
# Test Database Configuration
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gradiant_test
TEST_REDIS_URL=redis://localhost:6379/1

# Test API Keys (use test mode keys)
TEST_OPENAI_$1=YOUR_API_KEY_HERE
TEST_$1=YOUR_API_KEY_HERE

# Test Authentication
TEST_AUTH_SECRET=random-test-secret
```

5. Run the test suite:

```bash
pnpm test
```

### Setting Up Vitest

Pixelated uses Vitest for unit and integration testing. Here's how to configure it:

1. The Vitest configuration is in `vitest.config.ts`:

```typescript

  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/types/**'],
    },
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
```

2. Create a `vitest.setup.ts` file for global test setup:

```typescript

// Mock global fetch
global.fetch = vi.fn()

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api'

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})
```

### CI/CD Testing Environment

#### GitHub Actions Setup

1. Create a `.github/workflows/test.yml` file:

```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

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
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Run tests
        run: pnpm test
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/gradiant_test
          TEST_REDIS_URL: redis://localhost:6379/1
          TEST_AUTH_SECRET: ${{ secrets.TEST_AUTH_SECRET }}
          TEST_OPENAI_API_KEY: ${{ secrets.TEST_OPENAI_API_KEY }}
          TEST_ANTHROPIC_API_KEY: ${{ secrets.TEST_ANTHROPIC_API_KEY }}

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

### Docker Testing Environment

For consistent testing across environments, use Docker:

1. Create a `docker-compose.test.yml` file:

```yaml
version: '3.8'

services:
  test:
    build:
      context: .
      dockerfile: Dockerfile.test
    environment:
      - TEST_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/gradiant_test
      - TEST_REDIS_URL=redis://redis:6379/1
      - NODE_ENV=test
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules
    command: pnpm test

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=gradiant_test
    ports:
      - '5432:5432'
    volumes:
      - postgres-test-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - '6379:6379'
    volumes:
      - redis-test-data:/data

volumes:
  postgres-test-data:
  redis-test-data:
```

2. Create a `Dockerfile.test`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application
COPY . .

# Run tests
CMD ["pnpm", "test"]
```

3. Run tests with Docker:

```bash
docker-compose -f docker-compose.test.yml up --build
```

### Testing with Mocks

#### Setting Up Mock Services

1. Create a `mocks` directory for mock services:

```bash
mkdir -p src/mocks
```

2. Create a mock service for external APIs:

```typescript
// src/mocks/openai.ts

  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1677652288,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello, how can I help you today?',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 10,
    total_tokens: 20,
  },
}

  chat: {
    completions: {
      create: vi.fn().mockResolvedValue(mockOpenAIResponse),
    },
  },
}
```

3. Use the mock in tests:

```typescript
// src/services/ai.test.ts


vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => mockOpenAIClient),
}))

describe('AIService', () => {
  let aiService: AIService

  beforeEach(() => {
    aiService = new AIService()
  })

  it('should generate a response', async () => {
    const response = await aiService.generateResponse('Hello')

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(response).toBe('Hello, how can I help you today?')
  })
})
```

### Database Testing

#### Setting Up Test Databases

1. Create a separate database for testing:

```bash
createdb gradiant_test
```

2. Use Prisma for database testing:

```typescript
// src/lib/prisma-test.ts

const prismaBinary = './node_modules/.bin/prisma'

  const testUrl = process.env.TEST_DATABASE_URL

  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not defined')
  }

  // Generate a unique schema name for this test run
  const schema = `test_${uuid().replace(/-/g, '_')}`
  const url = `${testUrl}?schema=${schema}`

  // Create a new Prisma client with the test URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  })

  // Run migrations on the test database
  execSync(`${prismaBinary} migrate deploy`, {
    env: {
      ...process.env,
      DATABASE_URL: url,
    },
  })

  return {
    prisma,
    url,
    cleanup: async () => {
      // Drop the schema when done
      await prisma.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      )
      await prisma.$disconnect()
    },
  }
}
```

3. Use in tests:

```typescript
// src/services/user.test.ts

describe('UserService', () => {
  let userService: UserService
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const { prisma, cleanup: cleanupFn } = await setupTestDatabase()
    cleanup = cleanupFn
    userService = new UserService(prisma)
  })

  afterAll(async () => {
    await cleanup()
  })

  it('should create a user', async () => {
    const user = await userService.create({
      email: 'test@example.com',
      name: 'Test User',
    })

    expect(user).toHaveProperty('id')
    expect(user.email).toBe('test@example.com')
    expect(user.name).toBe('Test User')
  })
})
```

### Performance Testing

### Setting Up Performance Tests

1. Create a performance test directory:

```bash
mkdir -p tests/performance
```

2. Create a performance test file:

```typescript
// tests/performance/api.bench.ts

describe('API Performance', () => {
  const server = createServer()
  const baseUrl = 'http://localhost:3000'

  beforeAll(async () => {
    await server.listen(3000)
  })

  afterAll(async () => {
    await server.close()
  })

  bench(
    'GET /api/health',
    async () => {
      const response = await request(`${baseUrl}/api/health`)
      return response.statusCode
    },
    { iterations: 100 },
  )

  bench(
    'POST /api/chat',
    async () => {
      const response = await request(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Hello, world!',
        }),
      })
      return response.statusCode
    },
    { iterations: 50 },
  )
})
```

3. Run performance tests:

```bash
pnpm test:perf
```

## Troubleshooting Common Issues

### Database Connection Issues

If you encounter database connection issues:

1. Verify the database is running:

```bash
pg_isready -h localhost -p 5432
```

2. Check the connection URL:

```bash
psql "postgresql://postgres:postgres@localhost:5432/gradiant_test"
```

3. Ensure the database exists:

```bash
createdb gradiant_test
```

### Test Timeouts

If tests are timing out:

1. Increase the timeout in Vitest config:

```typescript
// vitest.config.ts
  test: {
    // ...
    testTimeout: 10000, // 10 seconds
  },
})
```

2. Check for long-running operations or infinite loops.

3. Use proper mocking for external services.

### Memory Issues

If you encounter memory issues during testing:

1. Run tests with increased memory:

```bash
NODE_OPTIONS=--max_old_space_size=4096 pnpm test
```

2. Split large test suites into smaller files.

3. Use `beforeAll` and `afterAll` for expensive setup/teardown operations.

## Conclusion

Following these setup guides will ensure a consistent testing environment across all stages of development.
For more detailed information on specific testing patterns, refer to the
[Test Patterns Documentation](/docs/api/test-patterns).

For any issues not covered in this guide, please refer to the
[Troubleshooting Guide](/docs/testing/debugging) or open an issue on GitHub.
