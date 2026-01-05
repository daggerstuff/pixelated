---
title: 'Debugging Tests'
description: 'Guide to debugging tests in Pixelated'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

# Debugging Tests

This guide covers strategies and tools for debugging tests in Pixelated.

## Common Issues

### Test Failures

1. **Async Operation Timing**

```typescript
// ❌ Wrong: Race condition
it('should update user', async () => {
  service.updateUser(userId, data)
  const user = await db.getUser(userId)
  expect(user.name).toBe(data.name)
})

// ✅ Correct: Wait for operation
it('should update user', async () => {
  await service.updateUser(userId, data)
  const user = await db.getUser(userId)
  expect(user.name).toBe(data.name)
})
```

2. **Database State**

```typescript
// ❌ Wrong: Missing cleanup
it('should create user', async () => {
  const user = await createUser()
  expect(user).toBeDefined()
})

// ✅ Correct: With cleanup
it('should create user', async () => {
  const user = await createUser()
  expect(user).toBeDefined()
  await cleanupUser(user.id)
})
```

3. **Mock Reset**

```typescript
// ❌ Wrong: Mock state bleeds
const spy = .spyOn(service, 'call')
it('test1', () => {
  service.call()
  expect(spy).toHaveBeenCalled()
})
it('test2', () => {
  expect(spy).not.toHaveBeenCalled() // Fails!
})

// ✅ Correct: Reset between tests
beforeEach(() => {
  .clearAllMocks()
})
```

## Debugging Tools

### Console Debugging

```typescript
// Add debug points
it('should process data', async () => {
  console.log('Input:', data);
  const result = await process(data);
  console.log('Output:', result);
  expect(result).toBeDefined();
});

// Run with debug output
npm test -- --verbose
```

### Node Inspector

1. Start debugger:

```bash
npm test -- --inspect-brk
```

2. Add breakpoints:

```typescript
it('should handle complex flow', async () => {
  debugger // Breakpoint
  const result = await complexOperation()
  debugger // Breakpoint
  expect(result).toBeDefined()
})
```

3. Use Chrome DevTools (chrome://inspect)

### VS Code Debugging

1. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

2. Set breakpoints in VS Code
3. Run "Debug Tests" configuration

## Test Environment

### Database Debugging

1. Enable query logging:

```typescript
beforeAll(() => {
  db.on('query', (data) => {
    console.log('Query:', data.sql)
    console.log('Params:', data.bindings)
  })
})
```

2. Inspect database state:

```typescript
it('should handle transaction', async () => {
  await db.transaction(async (trx) => {
    await operation(trx)
    const state = await trx.select().from('table')
    console.log('DB State:', state)
  })
})
```

### Network Debugging

1. Log HTTP requests:

```typescript

const server = setupServer(
  rest.post('/api/*', async (req, rest, ctx) => {
    console.log('Request:', {
      url: req.url.toString(),
      body: await req.json(),
      headers: Object.fromEntries(req.headers),
    })
    return rest(ctx.json({ success: true }))
  }),
)
```

2. Debug WebSocket:

```typescript
it('should handle messages', (done) => {
  const ws = new WebSocket('ws://localhost:3000')

  ws.onopen = () => console.log('Connected')
  ws.onclose = () => console.log('Disconnected')
  ws.onerror = (error) => console.error('Error:', error)
  ws.onmessage = (event) => {
    console.log('Message:', event.data)
    done()
  }
})
```

## Performance Issues

### Slow Tests

1. Use test timer:

```bash
npm test -- --verbose --timing
```

2. Profile specific test:

```typescript
console.time('operation')
await longOperation()
console.timeEnd('operation')
```

### Memory Leaks

1. Watch memory usage:

```typescript
beforeEach(() => {
  const used = process.memoryUsage()
  console.log('Memory:', {
    heapTotal: used.heapTotal / 1024 / 1024,
    heapUsed: used.heapUsed / 1024 / 1024,
  })
})
```

2. Clean up resources:

```typescript
describe('Resource Tests', () => {
  const resources = []

  afterEach(async () => {
    await Promise.all(resources.map((r) => r.cleanup()))
    resources.length = 0
  })
})
```

## Best Practices

1. **Isolate Tests**
   - Use unique test data
   - Clean up after each test
   - Reset mocks and spies

2. **Meaningful Errors**
   - Use custom matchers
   - Add context to assertions
   - Log relevant state

3. **Maintainable Tests**
   - Follow AAA pattern
   - Use helper functions
   - Keep tests focused

For more information about specific testing areas, refer to:

- [Test Patterns](/testing/patterns)
- [Test Execution](/testing/execution)
- [Coverage Requirements](/testing/coverage)
