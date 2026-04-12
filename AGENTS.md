# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is **Pixelated Empathy**, an AI-powered therapeutic mental health
platform built with Astro 6 (SSR) + React 19 + UnoCSS. The main
application is a Node.js/TypeScript Astro project with companion
Python ML services.

### Prerequisites

- **Node.js 24** (set via `.nvmrc`; use `nvm use 24`)
- **pnpm 10.33.0** (managed via corepack: `corepack enable pnpm`)
- **Python 3.13** (managed via `uv`)
- **uv** for Python dependency management

### Key commands

- Install Node deps: `pnpm install --frozen-lockfile`
- Install Python deps: `UV_HTTP_TIMEOUT=300 uv sync --python 3.13`
- Dev server: `pnpm dev` (Astro on port 5173)
- Lint: `pnpm lint` (oxlint)
- Lint (CI, non-blocking): `pnpm lint:ci`
- Unit tests: `NODE_ENV=test npx vitest run -c config/vitest.config.ts`
- Custom test runner: `pnpm test`
- Build: `pnpm build`
- Type check: `pnpm typecheck`

### Non-obvious notes

- The `.env` file is not committed. Copy `.env.example` to `.env`
  before first run. The Astro dev server starts without valid
  external service credentials (Auth0, Redis, PostgreSQL, MongoDB)
  but some runtime features and tests will fail without them.
- `pnpm lint` uses **oxlint** and exits with code 1 due to
  pre-existing errors. Use `pnpm lint:ci` for non-blocking.
- The vitest config is at `config/vitest.config.ts` (not the
  default location). Auth0-dependent tests fail without credentials.
- Git hooks install automatically via `pnpm prepare`.
- The build uses `CI=true` wrapper at
  `scripts/ci/build-with-pipe-handling.mjs`.
- Python deps are heavy (PyTorch, transformers, etc.). Set
  `UV_HTTP_TIMEOUT=300` for slow connections.
- `business-strategy-cms/` is a separate Express.js sub-project
  not needed for core development.
