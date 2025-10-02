# Project Purpose
Pixelated Empathy is an AI-powered training simulation platform for mental health professionals. It provides risk-free, realistic client simulations, bias detection, and analytics for therapeutic competency. The platform is designed to help professionals practice difficult conversations and master edge-case scenarios using advanced emotional intelligence engines.

# Tech Stack
- **Frontend**: Astro (TypeScript/React)
- **Backend**: Python (Flask, FastAPI, AI/ML services)
- **AI/ML**: Transformers, Fairlearn, SHAP, LIME, Torch, HuggingFace, spaCy, NLTK
- **Testing**: Vitest (JS/TS), Playwright (E2E), Pytest (Python)
- **Linting/Formatting**: ESLint, Prettier, Black, Ruff, isort, mypy, pyright
- **Deployment**: Docker, Azure Pipelines, Vercel
- **Other**: Redis, MongoDB, Sentry, NewRelic, Grafana

# Code Style & Conventions
- **JS/TS**: 2-space indent, single quotes (JS/TS), double quotes (JSX), no semicolons, trailing commas, kebab-case for components, camelCase for utilities, PascalCase for React/Astro components, UPPER_SNAKE_CASE for constants
- **Python**: 100-char line length, snake_case for variables, PascalCase for classes, type hints, docstrings, Black formatting, Ruff linting, mypy/pyright type checking
- **Testing**: Unit tests in `src/test` and `tests/unit`, integration in `tests/integration`, E2E in `tests/e2e`, Python tests in `tests/python`

# Directory Structure
- `src/` - Frontend source
- `ai/` - AI/ML pipeline
- `tests/` - All test types
- `infra/` - Infrastructure code
- `docs/` - Documentation
- `public/` - Static assets
- `config/` - Config files
- `scripts/` - Utility scripts

# Guidelines & Patterns
- Use conventional commits
- Branch strategy: main, develop, feature/*, hotfix/*
- Format on save, lint before commit
- Type checking required for all PRs
- Security: dependency updates, Sentry/NewRelic monitoring, Docker non-root user
- HIPAA compliance for all client data

# Entrypoints
- Frontend: `pnpm dev` (Astro)
- Backend: `uv pip install -e .` (Python), `pnpm dev:all-services` (all services)
- Docker: `pnpm docker:build`, `docker-compose up`
- Tests: `pnpm test`, `python -m pytest`
- Lint/Format: `pnpm lint`, `pnpm format`, `black .`, `ruff .`, `isort .`, `mypy .`, `pyright .`
- Typecheck: `pnpm typecheck`, `pyright .`, `mypy .`
- E2E: `pnpm e2e`, `playwright test`
- Coverage: `pnpm test:unit`, `pytest --cov=src`
- Security: `pnpm security:scan`, `pnpm security:check`
- Performance: `pnpm performance:test`

# Util Commands (Linux)
- `ls`, `cd`, `grep`, `find`, `cat`, `tail`, `head`, `wc -l`, `chmod`, `chown`, `ps`, `kill`, `docker`, `pnpm`, `python`, `pytest`, `git`

# Task Completion Checklist
- Format code
- Lint code
- Run unit/integration/E2E tests
- Check type safety
- Validate security
- Update documentation
- Ensure compliance (HIPAA, privacy)
- Push to develop/main
- Monitor CI/CD pipeline

# References
- See `README.md`, `package.json`, `pyproject.toml`, `vitest.config.ts`, `pytest.ini`, `eslint.config.js`, `pyrightconfig.json`, `mypy.ini`, `azure-pipelines.yml` for more details.
