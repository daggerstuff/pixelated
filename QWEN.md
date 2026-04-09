# Qwen Code — Project Context

> This file is loaded automatically at session start. Keep it concise.

## Project Overview

**Pixelated** — Full-stack mental health AI platform.
- **Frontend**: Astro + React (TypeScript)
- **Backend**: TypeScript services/workers
- **AI**: Python inference, training, monitoring, safety, and pipelines (`ai/` submodule)
- **Infrastructure**: Docker, GitHub Actions, GitLab CI

## Key Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run main app on `:5173` |
| `pnpm build` | Production build |
| `pnpm lint` | Lint check |
| `pnpm format` | Format check |
| `pnpm test` | Run tests |
| `uv run pytest` | Run Python tests |
| `pnpm security:check` | Security audit |

## Architecture

- `src/` — Astro app, React UI, API routes, shared TS libs
- `ai/` — Python AI code (treat as submodule with own commit discipline)
- `tests/` — Integration, browser, perf, security, API tests
- `scripts/`, `docker/`, `config/`, `.github/workflows/` — Ops/deploy
- `public/` — Static assets
- `docs/` — **Public** documentation only
- `.agent/internal/` — **Private** internal plans (git-ignored)

## Working Rules

- Use `pnpm` for Node/TS. Use `uv run` for Python. **Never** raw `npm`, `pip`, `conda`.
- No stubs, placeholders, or suppressed lint/TS errors. Enterprise-grade code only.
- Synthetic test data only. No secrets or local credentials.
- No hedging language in commits or code comments.
- Verify commands. Do not guess.

## MCP Servers

- **Enabled**: context7 (docs), rube (500+ apps), linear (issues), hindsight (memory), brave-search (web), firecrawl (scraping)
- **Disabled**: sequential-thinking, github, playwright, sentry, e2b-sandbox (enable via `qwen mcp add` or settings.json when needed)

## Nvidia NIM Models

Configured via `modelProviders` in `.qwen/settings.json`. Switch with `/model`.
Primary: `z-ai/glm5`. Fast: `nvidia/llama-3.1-nemotron-nano-8b-v1`.
Requires `NVIDIA_API_KEY` env var.
