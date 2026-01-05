---
title: 'Test Patterns'
description: 'Common test patterns and best practices used in Pixelated'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

# Test Patterns

This guide outlines the common test patterns and best practices used throughout Pixelated Healths test suite.

## Test Organization

### AAA Pattern

We follow the Arrange-Act-Assert pattern:

```typescript
describe('UserService', () => {
  it('should create a new user', async () => {
    // Arrange
    const userData = {
      email: 'test@example.com',
      password: 'securePassword123',
    }

    // Act
    const user = await userService.create(userData)

    // Assert
    expect(user).toBeDefined()
    expect(user.email).toBe(userData.email)
  })
})
```

### Test Grouping

Group related tests using descriptive `describe` blocks:

```typescript
describe('AuthenticationService', () => {
  describe('login', () => {
    it('should authenticate valid credentials')
    it('should reject invalid credentials')
    it('should handle rate limiting')
  })

  describe('logout', () => {
    it('should clear session')
    it('should revoke tokens')
  })
})
```

## Mocking Patterns

### External Services

Use MSW for mocking HTTP requests:

```typescript

const server = setupServer(
  rest.post('/api/analytics', (req, rest, ctx) => {
    return rest(ctx.json({ success: true }))
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Database Operations

Use test containers and transactions:

```typescript
describe('Database Operations', () => {
  let transaction: Transaction

  beforeEach(async () => {
    transaction = await db.transaction()
  })

  afterEach(async () => {
    await transaction.rollback()
  })

  it('should create record in transaction', async () => {
    const result = await db.create({ trx: transaction })
    expect(result).toBeDefined()
  })
})
```

## Async Testing

### Promise Handling

Always use async/await for cleaner test code:

```typescript
it('should handle async operations', async () => {
  await expect(asyncOperation()).resolves.toBeDefined()
  await expect(failingOperation()).rejects.toThrow()
})
```

### WebSocket Testing

Test real-time communication:

```typescript
describe('WebSocket', () => {
  let ws: WebSocket

  beforeEach(() => {
    ws = new WebSocket('ws://localhost:3000')
  })

  afterEach(() => {
    ws.close()
  })

  it('should receive messages', (done) => {
    ws.onmessage = (event) => {
      expect(JSON.parse(event.data)).toEqual({
        type: 'message',
        content: 'test',
      })
      done()
    }

    ws.send(JSON.stringify({ type: 'echo', content: 'test' }))
  })
})
```

## Error Handling

### Expected Errors

Test both success and error cases:

```typescript
describe('Error Handling', () => {
  it('should handle expected errors', async () => {
    const error = new ValidationError('Invalid input')
    await expect(service.process({ invalid: true })).rejects.toThrow(error)
  })

  it('should handle unexpected errors', async () => {
    const spy = vi.spyOn(logger, 'error')
    await service.process({ trigger: 'unexpected' })
    expect(spy).toHaveBeenCalled()
  })
})
```

## Test Data Management

### Factories

Use factories for test data:

```typescript

describe('User Sessions', () => {
  it('should link session to user', async () => {
    const user = await createUser()
    const session = await createSession({ userId: user.id })

    expect(session.userId).toBe(user.id)
  })
})
```

### Data Cleanup

Always clean up test data:

```typescript
describe('File Operations', () => {
  const testFiles: string[] = []

  afterEach(async () => {
    await Promise.all(testFiles.map((file) => fs.unlink(file)))
    testFiles.length = 0
  })

  it('should create file', async () => {
    const file = await createFile()
    testFiles.push(file.path)
    expect(await fs.exists(file.path)).toBe(true)
  })
})
```

## Coverage Requirements

- Minimum 90% overall coverage
- 100% coverage for critical paths
- All error conditions must be tested
- All API endpoints must have integration tests
- All UI components must have snapshot tests

For more information about specific testing areas, refer to:

- [Test Execution](/testing/execution)
- [Debugging Tests](/testing/debugging)
- [Coverage Requirements](/testing/coverage)
