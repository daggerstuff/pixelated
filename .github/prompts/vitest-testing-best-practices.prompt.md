# JavaScript/TypeScript Vitest Testing Best Practices

## Purpose
This prompt provides actionable guidance for writing, reviewing, and improving tests using Vitest in JavaScript/TypeScript projects. It covers test structure, assertion patterns, mocking, coverage, and error handling, with a focus on maintainability and reliability.

## Instructions
- Use Vitest for all unit and integration tests.
- Prefer `describe`, `it`, and `expect` for test organization and assertions.
- Use `vi.mock` for mocking modules and dependencies.
- Structure tests for clarity: setup, execution, assertion, teardown.
- Always check for edge cases and error handling.
- Use coverage reports to identify untested code paths.
- Avoid global state and side effects in tests.
- Document complex test logic with comments.
- Use `beforeEach` and `afterEach` for setup/teardown.
- Prefer explicit assertions over implicit ones.
- Test asynchronous code with `await` and proper assertions.
- Validate error messages and thrown exceptions.
- Use snapshot testing for complex outputs when appropriate.
- Ensure tests are fast, isolated, and repeatable.

## Output Format
- Provide actionable feedback for improving test coverage, reliability, and maintainability.
- Suggest refactoring opportunities for test code.
- Highlight missing edge case tests and error handling.
- Recommend best practices for mocking and isolation.
- Identify anti-patterns and suggest corrections.

## Example
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myFunction } from '../src/myModule';

describe('myFunction', () => {
  beforeEach(() => {
    // Setup code
  });

  it('should return expected value for valid input', () => {
    expect(myFunction('input')).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    expect(() => myFunction(null)).toThrow('Invalid input');
  });
});
```
