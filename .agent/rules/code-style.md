---
trigger: always_on
---

# Code Style & Best Practices

## TypeScript/JavaScript

### Imports
```typescript
import type { User } from '@/types/user'
import { getLogger } from '@/utils/logger'
```

### Formatting
- 2 spaces indentation
- No semicolons
- Single quotes
- Trailing commas

### Types
- Strict mode enabled
- Use branded types for critical values
- Never use `any` without justification

### Naming
- **PascalCase**: Components, interfaces, types
- **camelCase**: Variables, functions, methods
- **UPPER_SNAKE_CASE**: Constants

### Error Handling
```typescript
try {
  await riskyOperation()
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle specific error
  }
  throw error
}
```

## Testing

### Vitest Patterns
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

### Coverage
- Aim for 80%+ coverage on critical paths
- Mock external dependencies with `vi.mock()`
- Test edge cases and error conditions

## Logging

```typescript
import { getLogger } from '@/utils/logger'

const logger = getLogger('module-name')

logger.debug('Detailed info')
logger.info('General info')
logger.warn('Warning condition')
logger.error('Error occurred', { error })
```

## Accessibility

- Use semantic HTML5 elements
- Strict ARIA props validation
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance

## Performance

- Code splitting for large components
- Lazy loading for routes
- Debounced handlers for frequent events
- Memoization for expensive computations

## Quality Checklist

- [ ] Types properly defined (no `any`)
- [ ] Tests written/updated
- [ ] Accessibility maintained
- [ ] Error handling robust
- [ ] Logging appropriate
- [ ] Documentation updated
- [ ] No console.log in production code
