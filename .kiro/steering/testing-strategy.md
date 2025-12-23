---
inclusion: fileMatch
fileMatchPattern: '**/*.test.{ts,tsx,js,jsx,py}'
---

# Testing Strategy

## Test Philosophy

- Write tests for behavior, not implementation
- Focus on critical paths and edge cases
- Maintain 70%+ coverage for general code, 90%+ for critical business logic
- Tests should be fast, isolated, and deterministic

## Test Structure (Vitest)

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Component/Function Name', () => {
  it('should handle expected behavior', () => {
    // Arrange
    const input = setupTestData()
    
    // Act
    const result = functionUnderTest(input)
    
    // Assert
    expect(result).toBe(expectedValue)
  })
  
  it('should handle edge case', () => {
    // Test edge cases
  })
})
```

## Mocking Best Practices

```typescript
// Mock external dependencies
vi.mock('@/lib/api', () => ({
  fetchData: vi.fn(() => Promise.resolve(mockData))
}))

// Never change production code to make testing easier
// Instead, write tests that work with the code as-is
```

## Python Testing (pytest)

```python
import pytest

def test_function_behavior():
    # Arrange
    input_data = setup_test_data()
    
    # Act
    result = function_under_test(input_data)
    
    # Assert
    assert result == expected_value

def test_edge_case():
    with pytest.raises(ValueError):
        function_under_test(invalid_input)
```

## Test Commands

```bash
# Single test file
pnpm vitest run path/to/test.spec.ts

# All tests
pnpm test:all

# With coverage
pnpm vitest run --coverage

# Python tests
uv run pytest tests/
```

## What to Test

- [ ] Happy path scenarios
- [ ] Edge cases and boundary conditions
- [ ] Error handling and validation
- [ ] Security-critical logic
- [ ] Emotional intelligence calculations
- [ ] Conversation analysis algorithms
- [ ] Data sanitization and privacy protection
