# Testing Patterns

**Analysis Date:** 2025-02-17

## Test Framework

**Runner:**

- Vitest 3.x - Unit and integration testing
- Config: `config/vitest.config.ts`
- Coverage: Built-in coverage reporting

**Assertion Library:**

- Vitest built-in assertions
- React Testing Library for component testing
- Custom matchers for domain-specific tests

**Run Commands:**

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm e2e               # End-to-end tests (Playwright)
```

## Test File Organization

**Location:**

- Unit tests: Co-located with source files (`.test.ts` suffix)
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Component tests: `src/components/**/*.test.tsx`

**Naming:**

- Unit tests: `[filename].test.ts`
- Integration tests: `[feature].integration.test.ts`
- E2E tests: `[feature].e2e.test.ts`

**Structure:**

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
├── lib/
│   └── services/
│       ├── user.service.ts
│       └── user.service.test.ts
tests/
├── integration/
│   └── api.integration.test.ts
└── e2e/
    └── user-flow.e2e.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Test implementation
    })

    it('should throw error for invalid email', async () => {
      // Test implementation
    })
  })
})
```

**Patterns:**

- Setup: `beforeEach`/`beforeAll` for test setup
- Teardown: `afterEach`/`afterAll` for cleanup
- Assertion: Use descriptive test names and specific assertions

## Mocking

**Framework:** Vitest built-in mocking

**Patterns:**

```typescript
// Mocking external dependencies
vi.mock('@/lib/services/api', () => ({
  fetchUser: vi.fn(),
}))

// Mocking hooks
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true }),
}))

// Mocking timers
vi.useFakeTimers()
vi.setSystemTime(new Date('2024-01-01'))
```

**What to Mock:**

- External API calls
- Database operations
- Browser APIs (localStorage, fetch)
- Third-party services
- File system operations

**What NOT to Mock:**

- Internal utility functions
- Pure functions
- Type definitions
- Constants and configuration

## Fixtures and Factories

**Test Data:**

```typescript
// Factory functions for test data
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: new Date('2024-01-01'),
  ...overrides,
})

// Fixtures directory
// tests/fixtures/
// ├── users.json
// └── sessions.json
```

**Location:**

- Factory functions: `tests/factories/`
- Fixture data: `tests/fixtures/`
- Mock data: `__mocks__/` directories

## Coverage

**Requirements:**

- Minimum 80% coverage for new code
- 100% coverage for security-critical code
- Focus on business logic and user-facing features

**View Coverage:**

```bash
pnpm test:coverage
# Opens HTML report in browser
```

## Test Types

**Unit Tests:**

- Scope: Individual functions and components
- Location: Co-located with source files
- Focus: Business logic, edge cases, error handling

**Integration Tests:**

- Scope: API endpoints and service interactions
- Location: `tests/integration/`
- Focus: Database operations, external service calls

**E2E Tests:**

- Framework: Playwright
- Scope: Complete user workflows
- Location: `tests/e2e/`
- Focus: Critical user journeys, cross-browser compatibility

## Common Patterns

**Async Testing:**

```typescript
// Testing async operations
it('should fetch user data', async () => {
  const user = await fetchUser(userId)
  expect(user).toBeDefined()
  expect(user.email).toBe('test@example.com')
})

// Testing loading states
it('should show loading state', async () => {
  const { getByText } = render(<UserProfile userId={userId} />)
  expect(getByText('Loading...')).toBeInTheDocument()

  await waitFor(() => {
    expect(getByText('Test User')).toBeInTheDocument()
  })
})
```

**Error Testing:**

```typescript
// Testing error states
it('should handle API errors gracefully', async () => {
  server.use(
    rest.get('/api/user/:id', (req, res, ctx) => {
      return res(ctx.status(404), ctx.json({ error: 'User not found' }))
    })
  )

  await expect(fetchUser('invalid-id')).rejects.toThrow('User not found')
})

// Testing component error boundaries
it('should show error message when user fetch fails', async () => {
  const { getByText } = render(<UserProfile userId='invalid' />)

  await waitFor(() => {
    expect(getByText('Failed to load user')).toBeInTheDocument()
  })
})
```

**Component Testing:**

```typescript
// Testing React components
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('should call onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByText('Click me')).toBeDisabled()
  })
})
```

---

_Testing analysis: 2025-02-17_
