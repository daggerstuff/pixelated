# Code Style Guide

> **Reference**: See also `.github/instructions/code-guidelines.instructions.md` and `.github/instructions/clean-code.instructions.md`

## TypeScript/JavaScript

### Formatting
- **Indentation**: 2 spaces (never tabs)
- **Semicolons**: None (except where required by ASI)
- **Quotes**: Single quotes for strings
- **Trailing commas**: Always in multi-line structures
- **Line length**: Prefer 80-100 characters, max 120

### Imports
- **Type-first imports**: Import types separately when possible
- **Absolute paths**: Use `@/` aliases for internal imports
- **Organization**: Group imports: built-in → external → internal

```typescript
// ✅ Good
import type { User } from '@/types/user'
import { useState } from 'react'
import { validateEmail } from '@/utils/validation'
```

### Naming Conventions
- **Components/Interfaces**: PascalCase (`UserProfile`, `ApiResponse<T>`)
- **Variables/Functions**: camelCase (`userData`, `calculateTotal`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Files**: 
  - Components: PascalCase (`UserProfile.tsx`)
  - Utilities: camelCase (`formatDate.ts`)
  - Pages: kebab-case (`user-settings.astro`)

### Type Safety
- **Strict mode**: Always enabled
- **No `any`**: Use `unknown` or proper types
- **Branded types**: For critical values (IDs, tokens)
- **Explicit return types**: Required for public functions

```typescript
// ✅ Good
type UserId = string & { readonly __brand: unique symbol }

function getUserById(id: UserId): Promise<User> {
  // ...
}
```

### Function Design
- **Size**: Keep functions under 20 lines
- **Single responsibility**: One purpose per function
- **Parameters**: Maximum 4 parameters (use objects for more)
- **Early returns**: Prefer guard clauses over nesting

## Python

### Formatting
- **Style**: Follow PEP 8 strictly
- **Line length**: 88 characters (Black default)
- **Type hints**: Required for all function signatures
- **Docstrings**: Google or NumPy style

### Package Management
- **Tool**: `uv` ONLY (never pip/conda/venv)
- **Dependencies**: Pin versions in `requirements/` or `pyproject.toml`

### Naming
- **Functions/Variables**: snake_case (`calculate_total`, `user_data`)
- **Classes**: PascalCase (`UserProfile`, `ApiClient`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Private**: Prefix with `_` (`_internal_method`)

### Code Organization
- **Imports**: Standard library → third-party → local
- **Functions**: Small, pure functions where possible
- **Classes**: Single responsibility principle

## Common Errors

### TypeScript
1. Using `any` instead of `unknown` or proper types
2. Missing return type annotations
3. Inconsistent import organization
4. Not using branded types for critical values
5. Ignoring type errors with `@ts-ignore`

### Python
1. Missing type hints
2. Using `pip` instead of `uv`
3. Not following PEP 8
4. Missing docstrings for public APIs
5. Inconsistent error handling

## Best Practices

1. **Consistency**: Follow existing patterns in the codebase
2. **Readability**: Code is read 10x more than written
3. **Simplicity**: Prefer simple solutions over clever ones
4. **Documentation**: Self-documenting code with minimal comments
5. **Testing**: Write tests alongside code

## Testing

- **Coverage**: 70%+ for general code, 90%+ for critical logic
- **Naming**: Descriptive test names explaining scenario
- **Isolation**: Each test runs independently
- **Pattern**: Arrange-Act-Assert

## Code Style Tools

- **TypeScript**: ESLint + Prettier (via `pnpm check:all`)
- **Python**: Black + mypy + ruff (via `uv run lint`)
- **Format**: Run `pnpm format` before committing
