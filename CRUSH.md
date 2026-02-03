# Pixelated Empathy - Development Guide

## ⛔ ABSOLUTE PROHIBITION: No Stubs or Filler

**Every implementation MUST be complete and production-ready.**
- ❌ No `pass`, `...`, `TODO`, `NotImplementedError`, `# FIXME`
- ❌ No placeholder returns (`return True`, `return []`, hardcoded dummies)
- ❌ No mock implementations disguised as real code
- ✅ If it can't be fully implemented, it must not be committed

## Build/Lint/Test Commands
- **Development**: `pnpm dev` (or `pnpm dev:all-services` for full stack)
- **Single Test**: `pnpm vitest run src/path/to/test.spec.ts`
- **All Tests**: `pnpm test:all` or `pnpm check:all` (lint+format+typecheck)
- **Type Check**: `pnpm typecheck` (strict) or `pnpm check` (basic)
- **Lint**: `pnpm lint:fix` (auto-fix) or `pnpm lint` (check only)
- **Format**: `pnpm format:check` or `pnpm format`

## Code Style & Conventions

### TypeScript/JavaScript
- **Imports**: Use type-first imports, absolute `@/` aliases preferred
- **Formatting**: 2 spaces, no semicolons, single quotes, trailing commas
- **Types**: Strict mode enabled, branded types for critical values
- **Naming**: PascalCase for components/interfaces, camelCase for vars/functions
- **Error Handling**: Use `try/catch` with proper typing for errors

### Project Structure
- **Components**: Astro/React in `src/components/`, PascalCase
- **Utilities**: Helpers in `src/utils/`, camelCase
- **Types**: Centralized in `src/types/`, strict branded types
- **Services**: API/AI services in `src/lib/`

### Best Practices
- **Testing**: Vitest with coverage, use `vi.mock()` for dependencies
- **Logging**: Use `getLogger('prefix')` with proper levels
- **Accessibility**: Strict ARIA props, semantic HTML5
- **Performance**: Code splitting, lazy loading, debounced handlers
- **Security**: Input validation, sanitize user data, proper CORS

### Special Notes
- Node.js 24+ required with pnpm package manager
- Python 3.11+ for AI services with uv package manager
- Docker available for full stack development 
- Multi-environment support with proper dotenv configuration
