# Pixelated Empathy: Developer Walkthrough

Welcome to **Pixelated Empathy**. This guide covers architecture, local setup,
and workflows so you can contribute confidently.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Astro 6 + React 19 (SSR)               │
│         Port 5173 · Node.js 24 · TypeScript          │
└──┬──────────┬───────────┬──────────┬────────────────┘
   │          │           │          │
   ▼          ▼           ▼          ▼
┌──────┐  ┌────────┐  ┌─────────┐  ┌──────────────┐
│MongoDB│  │Postgres│  │ Redis   │  │  AI Services  │
│ :27017│  │ :5432  │  │ :6379   │  │  :8001-8002   │
└──────┘  └────────┘  └─────────┘  └──────────────┘
                                  FastAPI / Express
                                  Python 3.13 via uv
```

**Key technologies:**

| Layer             | Stack                                 |
| ----------------- | ------------------------------------- |
| Frontend & SSR    | Astro 6, React 19, TypeScript, UnoCSS |
| Backend services  | Express, FastAPI, Flask               |
| Databases         | MongoDB 6, PostgreSQL 15, Redis 7     |
| Package managers  | pnpm (JS/TS), uv (Python)             |
| Container runtime | Docker Compose                        |

---

## Local Setup

### Prerequisites

- Node.js ≥ 24 (see `.nvmrc`) — install via `nvm install`
- pnpm ≥ 11.5.2
- Python 3.13 + [uv](https://github.com/astral-sh/uv)
- Docker (must be running)

### One-command setup

```bash
./scripts/setup-dev.sh
```

This installs JS and Python dependencies, starts database containers via Docker,
and copies `.env.example → .env` if needed.

### Manual setup

```bash
chmod +x scripts/devops/pnpm-install-with-fallback.sh
scripts/devops/pnpm-install-with-fallback.sh
```

---

## Running the Application

### Full stack

```bash
pnpm dev:all-services
```

Starts the Astro frontend plus all background workers, WebSocket server, and
Python AI services concurrently.

| Service        | URL                   |
| -------------- | --------------------- |
| Main app       | http://localhost:5173 |
| Bias detection | http://localhost:8001 |
| AI inference   | http://localhost:8002 |

### Individual services

| Need                   | Command                      |
| ---------------------- | ---------------------------- |
| Frontend only          | `pnpm dev`                   |
| Bias detection service | `pnpm dev:bias-detection`    |
| AI inference service   | `pnpm dev:ai-service`        |
| Training server        | `pnpm dev:training-server`   |
| WebSocket server       | `pnpm dev:websocket`         |
| Academic sourcing API  | `pnpm dev:academic-sourcing` |
| Background worker      | `pnpm dev:worker`            |

---

## Testing & Quality

### Commands

| Task              | Command                 |
| ----------------- | ----------------------- |
| All tests         | `pnpm test`             |
| Unit tests        | `pnpm test:unit`        |
| Integration tests | `pnpm test:integration` |
| E2E tests         | `pnpm e2e`              |
| E2E UI mode       | `pnpm e2e:ui`           |
| Lint              | `pnpm lint`             |
| Format check      | `pnpm format:check`     |
| Typecheck         | `pnpm typecheck`        |
| Check all         | `pnpm check:all`        |

### Redis test gotcha

Cloud Agent VMs inject Upstash connection URLs. Tests against the local Docker
Redis container will hang without overriding these:

```bash
REDIS_URL=redis://localhost:6379/0 \
UPSTASH_REDIS_REST_URL=redis://localhost:6379/0 \
pnpm vitest run -c config/vitest.config.ts
```

For a shortcut: `pnpm test:redis:local:integration`

### Known test suite quirks

- The full `pnpm test` suite may hang due to one CPU-intensive test. Use
  `VITEST_TARGET_TESTS` to run targeted subsets.
- Vite 8 is in `package.json` but Astro 6 expects Vite 7; the dev server works
  but logs a warning. This is expected.

---

## Troubleshooting

### Port already in use

```bash
# Kill whatever is holding the port
lsof -i :5173 -t | xargs kill 2>/dev/null
# or pick a fresh port
PORT=3000 pnpm dev
```

### Database containers won't start

```bash
docker compose -f docker/docker-compose.db.yml down --remove-orphans
docker compose -f docker/docker-compose.db.yml up -d
```

Verify they're healthy:

```bash
docker ps --filter "name=mongo" --filter "name=postgres" --filter "name=redis"
```

### Module not found after pulling main

```bash
pnpm install    # rebuild native deps after dependency changes
uv sync         # rebuild Python venv
```

### TypeScript errors after upgrade

```bash
pnpm typecheck
# If stuck with stale cache:
rm -rf node_modules/.vite .tsbuildinfo && pnpm install
```

### Python tests failing with import errors

```bash
uv run --python 3.13 pytest   # always run through uv for correct venv
```

---

## Branching & Commits

- Branch names: `feat/description`, `fix/description`, `docs/description`
- Commit messages follow conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Git hooks are installed automatically via `prepare` script
- Run `pnpm check:all` before pushing

---

## Where Things Live

| Directory          | What's here                                              |
| ------------------ | -------------------------------------------------------- |
| `src/`             | Astro pages, React components, API routes, middleware    |
| `ai/`              | Python ML models, training pipelines, inference services |
| `scripts/`         | Operational utilities, deployment helpers, test runners  |
| `config/`          | Vitest, Playwright, tsconfig overrides                   |
| `docker/`          | Dockerfiles, compose files, monitoring stacks            |
| `tests/`           | Integration, browser, security, and API tests            |
| `public/`          | Static assets, images, favicons                          |
| `.agent/internal/` | Private docs, plans, runbooks                            |

---

Stuck? Check `AGENTS.md` for internal AI instructions or reach out to the core
engineering team.
