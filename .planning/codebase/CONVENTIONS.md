# Coding Conventions

**Analysis Date:** 2025-02-17

## Naming Patterns

**Files:**

- React components: PascalCase (e.g., `UserProfile.tsx`, `Button.tsx`)
- TypeScript files: camelCase (e.g., `useAuth.ts`, `formatDate.ts`)
- Astro pages: kebab-case (e.g., `user-dashboard.astro`, `admin-panel.astro`)
- CSS modules: camelCase with .module.css suffix (e.g., `button.module.css`)

**Functions:**

- React components: PascalCase (e.g., `function UserProfile()`)
- Utility functions: camelCase (e.g., `function formatDate()`)
- Hook functions: camelCase with 'use' prefix (e.g., `function useAuth()`)
- Async functions: camelCase with 'Async' suffix (e.g., `function fetchUserAsync()`)

**Variables:**

- Constants: SCREAMING_SNAKE_CASE (e.g., `API_ENDPOINT`, `MAX_RETRY_COUNT`)
- Regular variables: camelCase (e.g., `userData`, `isLoading`)
- Boolean variables: camelCase with 'is'/'has' prefix (e.g., `isAuthenticated`, `hasPermission`)

**Types:**

- Interfaces: PascalCase with 'I' prefix (e.g., `IUser`, `IApiResponse`)
- Type aliases: PascalCase (e.g., `UserRole`, `ApiResponse`)
- Enums: PascalCase with singular names (e.g., `enum UserStatus`)

## Code Style

**Formatting:**

- Tool: Oxc (oxlint) and Prettier
- Indentation: 2 spaces
- Semicolons: Enabled
- Quotes: Single quotes for strings
- Trailing commas: ES5 style
- Line length: 80 characters

**Linting:**

- Tool: Oxc (oxlint)
- Rules: Strict TypeScript rules
- Key rules: `no-unused-vars`, `@typescript-eslint/no-explicit-any`, `prefer-const`

## Import Organization

**Order:**

1. Built-in Node.js modules
2. Third-party dependencies
3. Internal absolute imports (@/ paths)
4. Internal relative imports
5. Type imports
6. Style imports

**Path Aliases:**

- `@/*` → `./src/*`
- `@lib/*` → `./src/lib/*`
- `@components/*` → `./src/components/*`
- `@utils/*` → `./src/utils/*`
- `@types/*` → `./src/types/*`

Example:

```typescript
import { useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatDate } from '../utils/date'

import type { User } from '@types/user'
import styles from './UserCard.module.css'
```

## Error Handling

**Patterns:**

- Use try-catch blocks for async operations
- Create custom error classes for domain-specific errors
- Always handle errors at the service layer
- Provide meaningful error messages to users

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Usage
try {
  const user = await fetchUser(userId)
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.statusCode}: ${error.message}`)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Logging

**Framework:** Winston with structured logging

**Patterns:**

- Use appropriate log levels (error, warn, info, debug)
- Include context in log messages
- Log security events at warn/error level
- Avoid logging sensitive information

```typescript
import { logger } from '@/lib/logger'

// Good
logger.info('User login attempt', { userId, ip: request.ip })
logger.error('Database connection failed', { error: error.message })

// Bad
logger.info(`User ${password} logged in`) // Never log passwords
```

## Comments

**When to Comment:**

- Complex business logic
- Security considerations
- Performance optimizations
- External API integrations
- TODO/FIXME comments for known issues

**JSDoc/TSDoc:**

- Required for all public functions and classes
- Include parameter and return type descriptions
- Document side effects and error conditions

```typescript
/**
 * Validates user authentication token
 * @param token - JWT token string
 * @returns Decoded user payload or null if invalid
 * @throws {TokenExpiredError} When token has expired
 */
function validateToken(token: string): UserPayload | null {
  // Implementation
}
```

## Function Design

**Size:**

- Maximum 20-30 lines for simple functions
- Maximum 50-60 lines for complex functions
- Extract complex logic into smaller helper functions

**Parameters:**

- Maximum 3-4 parameters (use object for more)
- Use destructuring for object parameters
- Provide default values where appropriate

```typescript
// Good
interface CreateUserOptions {
  email: string
  name: string
  role?: UserRole
  sendWelcomeEmail?: boolean
}

function createUser(options: CreateUserOptions) {
  const { email, name, role = UserRole.USER, sendWelcomeEmail = true } = options
  // Implementation
}

// Bad
function createUser(
  email: string,
  name: string,
  role: UserRole = UserRole.USER,
  sendWelcomeEmail: boolean = true,
) {
  // Implementation
}
```

**Return Values:**

- Always return consistent types
- Use Result types for operations that can fail
- Avoid returning null/undefined when possible

## Module Design

**Exports:**

- Use named exports for clarity
- Export types separately from implementations
- Use barrel files for clean imports

```typescript
// Good
export { Button } from './Button'
export type { ButtonProps } from './Button.types'

// Bad
export default Button
```

**Barrel Files:**

- Use index.ts files for component directories
- Export all public APIs from a feature
- Keep barrel files flat and simple

---

_Convention analysis: 2025-02-17_
