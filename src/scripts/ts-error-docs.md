# TypeScript Error Fixing Guide

This document outlines common TypeScript errors found in the project and how they're addressed by the `fix-ts-errors.ts` script.

## Common Error Patterns

### 1. Underscore Variable Pattern

**Problem:** Variables are defined with an underscore prefix (`_variable`) but then used without the underscore (`variable`).

**Example:**

```typescript
// Error:
const user = await getUser()
console.log(user.name) // Error: 'user' is not defined

// Fixed:
const user = await getUser()
console.log(user.name) // Correctly using user
```

### 2. Missing Properties in AIMessage Interface

**Problem:** The `AIMessage` interface requires a `name` property, but it's often omitted.

**Example:**

```typescript
// Error:
const message: AIMessage = {
  role: 'user',
  content: 'Hello',
} // Error: Property 'name' is missing

// Fixed:
const message: AIMessage = {
  role: 'user',
  content: 'Hello',
  name: '', // Added required property
}
```

### 3. Nullable Property Access

**Problem:** Accessing properties on objects that could be null or undefined without optional chaining.

**Example:**

```typescript
// Error:
const name = error.message // Error if error is null or undefined

// Fixed:
const name = error?.message // Safely accesses message if error exists
```

## Using the TypeScript Error Fixer

The `fix-ts-errors.ts` script automates the process of fixing these common errors. Here's how to use it:

### Prerequisites

1. Make sure you're in the correct conda environment:

   ```bash
   conda activate pixelated
   ```

2. Run the script from the project root directory.

### Commands

1. **List files with TypeScript errors:**

   ```bash
   ./src/scripts/fix-ts-errors.sh --list
   ```

2. **Fix all TypeScript errors:**

   ```bash
   ./src/scripts/fix-ts-errors.sh
   ```

3. **Preview fixes without making changes:**

   ```bash
   ./src/scripts/fix-ts-errors.sh --dry-run
   ```

4. **Fix errors in a specific file:**

   ```bash
   ./src/scripts/fix-ts-errors.sh --fix-file src/components/demo/ChatDemo.tsx
   ```

5. **Get detailed logs during fixing:**
   ```bash
   ./src/scripts/fix-ts-errors.sh --verbose
   ```

## Manual Fixes

Some TypeScript errors require manual intervention because they involve complex logic or project-specific knowledge. Here are some tips for common manual fixes:

### 1. Type Assertion When Needed

```typescript
// Error:
const id = someFunction() // Type 'unknown' is not assignable to type 'string'

// Fixed using type assertion:
const id = someFunction() as string
```

### 2. Properly Typing React Components

```typescript
// Error:
function MyComponent(props) {
  /* ... */
} // 'props' implicitly has 'any' type

// Fixed:
interface MyComponentProps {
  name: string
  age?: number
}

function MyComponent(props: MyComponentProps) {
  /* ... */
}
```

### 3. Adding Type Guards

```typescript
// Error:
function processData(data: any) {
  return data.value // Unsafe property access
}

// Fixed with type guard:
function processData(data: unknown) {
  if (data && typeof data === 'object' && 'value' in data) {
    return data.value
  }
  return undefined
}
```

## Troubleshooting

If you encounter issues with the automatic fixer:

1. Try running TypeScript compiler to see detailed error messages:

   ```bash
   npx tsc --noEmit
   ```

2. Fix one file at a time using the `--fix-file` option.

3. Some complex errors may require manual fixing. Use the error messages from the TypeScript compiler as guidance.

---

For more information, contact the development team or refer to the TypeScript documentation.
