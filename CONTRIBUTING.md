# Contributing to Pixelated Empathy

Thank you for contributing. This is a clinical AI platform handling sensitive
therapeutic data — quality and security matter.

## Getting Started

1. Fork and clone the repository
2. Run `./scripts/setup-dev.sh` to install dependencies and start local
   databases
3. Verify: `pnpm dev` should start the app on http://localhost:5173

See [WALKTHROUGH.md](WALKTHROUGH.md) for the full developer guide.

## Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation
- `chore/short-description` — maintenance, config changes
- `refactor/short-description` — code restructuring

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add emotion timeline visualization
fix: resolve race condition in session save
docs: update WALKTHROUGH with troubleshooting section
chore: bump pnpm to 11.12.0
```

## Before Pushing

```bash
pnpm lint         # oxlint (type-aware)
pnpm format:check # formatting
```

> **Do not use** `astro check`, `pnpm typecheck`, or `tsc` — they cause OOM failures.
> Use `pnpm lint` (type-aware oxlint) instead.

Git hooks run automatically on commit (installed via
`scripts/devops/pnpm-install-with-fallback.sh`).

## Testing

```bash
pnpm test:unit          # unit tests
pnpm test:integration   # integration tests
pnpm e2e                # end-to-end (Playwright)
pnpm e2e:ui             # interactive E2E
```

**Redis test note**: Override `REDIS_URL` and `UPSTASH_REDIS_REST_URL` to
`redis://localhost:6379/0` when running tests against local Docker. See
[WALKTHROUGH.md](WALKTHROUGH.md) for details.

## Python Code

All Python work lives in `ai/` and `tests/`. Use `uv` for dependency management:

```bash
uv run pytest           # run Python tests
uv run ruff check .     # lint Python code
uv run ruff format .    # format Python code
```

## Security

- **Never** commit credentials, API keys, or patient data
- **Never** use `@ts-ignore`, `# noqa`, or `# type: ignore` to suppress issues
- Report vulnerabilities to
  [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)

## AI Assistant Instructions

This repo includes `AGENTS.md` with detailed instructions for AI coding
assistants. If you're using an AI tool, it should pick up those conventions
automatically.
