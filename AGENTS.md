# Pixelated Empathy - Development Guide

## IMPORTANT FIRST NOTES
- **All** python commands and calls are to use uv. Not anaconda or venv. Use uv for everything.
    - `uv install` to install dependencies from pyproject.toml
    - `uv run <command>` to run commands like `python script.py` or `pytest tests/`
    - `uv shell` to spawn a shell with the virtual environment activated
- **All** node commands and calls are to use pnpm. Not npm or yarn. Use pnpm for everything.
- **Always** start every new chat or task by referring to your mcp tool, openmemory.
    - It has the full context of the project, and will help you avoid mistakes.
    - Always log a new memory at the end of your work, summarizing what you did. To help further grow the memory base.
    - Always update your memory if you encounter issues that you can't solve on your own.
- **All** research must be reviewed by the end of the day. Any deviation from the project's goals will result in a review.

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