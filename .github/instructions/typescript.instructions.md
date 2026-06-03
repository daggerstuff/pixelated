---
description: TypeScript and frontend coding standards
applyTo: 'src/**/*.{ts,tsx,js,jsx}'
---

# TypeScript Instructions

## Style

- Strict TypeScript. No `any` unless unavoidable (external API boundaries).
- Prefer `const` over `let`. Avoid `var`.
- Use named exports. No default exports for components.
- Error boundaries around all async component trees.

## Patterns

- React Server Components where possible; `"use client"` only when needed.
- Astro islands for interactive UI. Keep islands small.
- Colocate tests next to source files.

## Linting

- All lint/format errors must be fixed. No suppressed rules without comment.
- Run `pnpm lint && pnpm format` before committing.
