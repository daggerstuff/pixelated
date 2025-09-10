# Style and Conventions for Pixelated Empathy

## JavaScript/TypeScript
- Indentation: 2 spaces
- Quotes: Single for JS/TS, double for JSX
- Semicolons: Disabled
- Trailing commas: Always
- Naming: kebab-case for components, camelCase for utilities, PascalCase for React/Astro components, UPPER_SNAKE_CASE for constants
- ESLint: TypeScript recommended, React rules, no unused variables (underscore prefix exception)
- Prettier: 80-char line width, Astro files use prettier-plugin-astro

## Python
- Line length: 100 characters
- Naming: snake_case for variables, PascalCase for classes
- Type hints: Required
- Docstrings: Required for public functions/classes
- Formatting: Black
- Linting: Ruff
- Type checking: mypy, pyright
- Import sorting: isort

## Testing
- JS/TS: Vitest (unit), Playwright (E2E)
- Python: pytest (unit/integration)
- Coverage: V8 (JS/TS), pytest-cov (Python)

## Commit & Branching
- Conventional commits: feat, fix, docs, style, refactor, test, chore
- Branches: main, develop, feature/*, hotfix/*

## Security & Compliance
- HIPAA compliance for all client data
- Docker runs as non-root user
- Sentry/NewRelic monitoring

## References
- See `eslint.config.js`, `pyrightconfig.json`, `mypy.ini`, `pytest.ini`, `azure-pipelines.yml` for more details.
