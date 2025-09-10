# Suggested Commands for Pixelated Empathy

## Development
- `pnpm install` — Install Node.js dependencies
- `uv pip install -e .` — Install Python dependencies
- `pnpm dev` — Start Astro frontend dev server
- `pnpm dev:all-services` — Start all backend/AI services
- `pnpm build` — Build frontend
- `pnpm build:vercel` — Vercel-optimized build
- `pnpm docker:build` — Build Docker image
- `docker-compose up` — Start all services with Docker

## Testing
- `pnpm test` — Run JS/TS unit tests (Vitest)
- `pnpm test:unit` — Run unit tests with coverage
- `pnpm e2e` — Run Playwright E2E tests
- `python -m pytest` — Run Python tests
- `pytest --cov=src` — Python coverage
- `pnpm test:all` — Run all tests

## Linting & Formatting
- `pnpm lint` — Lint JS/TS code
- `pnpm lint:fix` — Auto-fix lint issues
- `pnpm format` — Format code
- `pnpm format:check` — Check formatting
- `black .` — Format Python code
- `ruff .` — Lint Python code
- `isort .` — Sort Python imports
- `mypy .` — Type check Python
- `pyright .` — Type check Python

## Type Checking
- `pnpm typecheck` — Type check JS/TS
- `pyright .` — Python type check
- `mypy .` — Python type check

## Security & Performance
- `pnpm security:scan` — Scan for vulnerabilities
- `pnpm security:check` — Security checks
- `pnpm performance:test` — Performance tests

## Utilities
- `ls`, `cd`, `grep`, `find`, `cat`, `tail`, `head`, `wc -l`, `chmod`, `chown`, `ps`, `kill`, `docker`, `pnpm`, `python`, `pytest`, `git`

## CI/CD
- Azure Pipelines: `azure-pipelines.yml` (see file for details)
- Vercel: `pnpm deploy:vercel`

## Entrypoints
- Frontend: `pnpm dev`
- Backend: `pnpm dev:all-services`, `uv pip install -e .`
- Docker: `pnpm docker:build`, `docker-compose up`

## References
- See `README.md`, `package.json`, `pyproject.toml`, `azure-pipelines.yml` for more details.
