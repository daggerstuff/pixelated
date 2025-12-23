---
inclusion: fileMatch
fileMatchPattern: '**/*.test.{ts,js,tsx,jsx,py}'
---

# Testing & Quality Standards

## Testing Philosophy

- **70%+ coverage** on critical paths (auth, AI, data handling)
- **Test behavior, not implementation** - focus on outcomes
- **Fast, isolated, deterministic** - no flaky tests

## Vitest Patterns

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Component', () => {
  it('should handle edge case', () => {
    const mock = vi.fn()
    // Test implementation
    expect(mock).toHaveBeenCalled()
  })
})
```

## Python Testing (pytest)

```bash
# Run tests
uv run pytest tests/

# With coverage
uv run pytest --cov=src/my_project
```

## Test Structure

- **Arrange-Act-Assert** pattern
- **Descriptive test names** explaining the scenario
- **Mock external dependencies** in unit tests
- **Test data factories** for consistent setup

## Quality Commands

```bash
# Full quality check
pnpm check:all              # Lint + format + typecheck

# Individual checks
pnpm typecheck              # Type checking
pnpm lint:fix               # Auto-fix linting
pnpm test:all               # Run all tests
```

## Don't

- Change code to make it easier to test
- Test implementation details
- Write tests without clear assertions
- Skip edge cases and error conditions
