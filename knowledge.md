# Project knowledge

Pixelated Empathy - AI-powered mental health training platform ("The Empathy Gym"). Provides risk-free practice environments for mental health professionals using AI personas.

## Quickstart
- Setup: `pnpm install` (requires pnpm 10.27.0+, Node.js >= 24)
- Dev: `pnpm dev` (runs on http://localhost:3000)
- Build: `pnpm build`
- Preview: `pnpm preview`

## Commands
- Test: `pnpm test` (local runner), `pnpm test:unit` (vitest with coverage), `pnpm e2e` (playwright)
- Lint: `pnpm lint` (oxlint), `pnpm lint:fix` (auto-fix)
- Format: `pnpm format` (oxc format + prettier for .astro/.mdx)
- Typecheck: `pnpm typecheck` (astro check + tsc --noEmit)
- Docker: `pnpm docker:up`, `pnpm docker:down`

## Architecture
- Tech stack: Astro 5.x, React 19, TypeScript 5.x, MongoDB, Redis
- Key directories:
  - `src/` - main application code
  - `src/lib/` - shared libraries (ai, auth, services)
  - `src/components/` - React/Astro components
  - `src/pages/` - Astro pages and API routes
  - `business-strategy-cms/` - CMS backend (Express)
  - `tests/` - test files (unit, integration, e2e)
  - `scripts/` - build, deploy, and utility scripts
  - `docker/` - Docker configurations
  - `config/` - ESLint, Vite, Playwright configs

## Conventions
- Package manager: pnpm (not npm/yarn)
- Formatting: oxc format + prettier (for .astro, .mdx files)
- Linting: oxlint (not ESLint for most files)
- Styling: UnoCSS (Tailwind-compatible)
- State: Zustand, Jotai
- Forms: react-hook-form + zod validation

## Things to avoid
- Don't use `npm` or `yarn` - use `pnpm`
- Don't cast as `any` type
- Don't install packages globally
- Don't add excessive code comments
