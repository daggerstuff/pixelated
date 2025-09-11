# Professional Prompt Builder for Copilot (Vitest Edition)

## Purpose
This prompt guides you in creating high-quality, structured prompts for Copilot, specifically tailored for Vitest testing scenarios in JavaScript/TypeScript projects.

## Instructions
- Clearly state the testing goal and context.
- Specify Vitest as the required test framework.
- Use TypeScript syntax and idioms.
- Include setup, execution, assertion, and teardown phases.
- Request actionable feedback on test coverage, reliability, and maintainability.
- Ask for suggestions to improve edge case coverage and error handling.
- Require identification of anti-patterns and refactoring opportunities.
- Request output in markdown format for easy review.

## Output Format
- Structured markdown with sections for feedback, suggestions, and code examples.
- Highlight best practices and areas for improvement.

## Example
```markdown
## Feedback
- Test covers main logic but misses edge cases for null/undefined input.
- Error handling assertions could be more explicit.

## Suggestions
- Add tests for invalid input scenarios.
- Use `beforeEach` for setup to avoid code duplication.

## Example Code
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myModule';

describe('myFunction', () => {
  it('should handle null input', () => {
    expect(() => myFunction(null)).toThrow('Invalid input');
  });
});
```
```
