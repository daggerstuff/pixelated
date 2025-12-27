---
inclusion: manual
---

# Clean Code Principles

## Core Philosophy

- **Readability over cleverness**: Code is read 10x more than written
- **Simplicity over complexity**: Simple code is easier to maintain
- **Consistency**: Follow established patterns
- **Self-documenting**: Let code explain itself

## Function Design

```typescript
// ❌ Too many responsibilities
function processUserData(userData) {
  // validate, transform, save, notify - too much!
}

// ✅ Single responsibility
function validateUserData(userData) { /* validation */ }
function transformUserData(validData) { /* transformation */ }
function saveUserData(transformedData) { /* storage */ }
function notifyUserProcessed(userId) { /* notification */ }
```

**Rules:**
- Keep functions under 20 lines
- One function, one responsibility
- Use descriptive verb names
- Place related functions together

## Control Flow

```typescript
// ❌ Deep nesting
function getInsuranceAmount(person) {
  if (person) {
    if (person.insurance) {
      if (person.insurance.coverage) {
        return person.insurance.coverage.amount
      }
    }
  }
  return 0
}

// ✅ Early returns and optional chaining
function getInsuranceAmount(person) {
  if (!person) return 0
  return person.insurance?.coverage?.amount || 0
}
```

**Rules:**
- Avoid nesting beyond 2-3 levels
- Use early returns
- Prefer guard clauses

## Variables and State

```typescript
// ✅ Minimize mutable state
const MILLISECONDS_PER_DAY = 86400000

// ✅ Use const by default
const userId = getUserId()

// ✅ Let only when necessary
let retryCount = 0
```

**Rules:**
- Use `const` by default
- Use `let` when mutation needed
- Never use `var`
- Keep scope limited
- Define variables close to usage

## Comments

```typescript
// ❌ Redundant comment
// Calculate the sum of two numbers
function add(a, b) {
  return a + b
}

// ✅ Explain why, not what
function calculateAdjustedPrice(basePrice: number): number {
  // Apply 15% markup for wholesale orders per policy #127
  return basePrice * 1.15
}
```

**Rules:**
- Write self-documenting code first
- Comment the "why", not the "what"
- Document public APIs
- Keep comments up-to-date

## Error Handling

```typescript
// ✅ Proper error handling
try {
  await riskyOperation()
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { error })
    return handleValidationError(error)
  }
  logger.error('Unexpected error', { error })
  throw error
}
```

**Rules:**
- Handle errors at appropriate level
- Use specific error types
- Provide meaningful messages
- Never swallow errors silently
