# Technology Stack

**Analysis Date:** 2025-02-17

## Languages

**Primary:**

- TypeScript 5.x - All frontend/backend code
- JavaScript (ES2022) - Build scripts and legacy files
- Python 3.11 - AI/ML services and academic sourcing

**Secondary:**

- Astro - Templating and content management
- MDX - Documentation and content
- CSS/SCSS - Styling (CSS Modules approach)

## Runtime

**Environment:**

- Node.js 20.x+ (via .nvmrc)
- Python 3.11 (via .python-version)

**Package Manager:**

- pnpm 9.x+ - Node.js dependencies
- uv - Python dependencies and virtual environments
- Lockfile: `pnpm-lock.yaml` (present), `uv.lock` (present)

## Frameworks

**Core:**

- Astro 5.x - Static site generator and SSR framework
- React 19.x - UI components and interactive features
- FastAPI - Python API framework for AI services

**Testing:**

- Vitest 3.x - Unit and integration testing
- React Testing Library - Component testing
- Playwright - End-to-end testing
- Pytest - Python testing

**Build/Dev:**

- Vite - Build tooling and dev server
- Oxc - Linting and formatting (oxlint)
- Biome - Additional linting/formatting

## Key Dependencies

**Critical:**

- `@astrojs/react` - React integration with Astro
- `react`/`react-dom` 19.x - React framework
- `zod` - Schema validation
- `zustand` - State management
- `react-query` - Data fetching
- `react-hook-form` - Form handling

**Infrastructure:**

- `mongodb` - Database client
- `redis` - Caching and session storage
- `axios` - HTTP client
- `date-fns` - Date manipulation
- `clsx`/`class-variance-authority` - CSS class utilities

## Configuration

**Environment:**

- `.env.local` - Local development environment (gitignored)
- `.env.example` - Template for required environment variables
- `.env.production` - Production environment variables
- `.env.staging` - Staging environment variables

**Build:**

- `astro.config.mjs` - Astro configuration
- `tsconfig.json` - TypeScript configuration (strict mode enabled)
- `vitest.config.ts` - Test configuration
- `biome.json` - Code formatting and linting

## Platform Requirements

**Development:**

- Node.js 20.x+
- Python 3.11+
- pnpm package manager
- uv for Python dependencies

**Production:**

- Docker containers (primary deployment)
- Cloudflare Workers (alternative deployment target)
- Railway, Heroku, Fly.io, Vercel (supported platforms)

---

_Stack analysis: 2025-02-17_
