# Developer Walkthrough

A step-by-step guide to setting up and working in the Pixelated Empathy codebase.

---

## 1. Prerequisites

### Required Software

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 24 | `nvm install 24` or [nodejs.org](https://nodejs.org) |
| pnpm | 11.24.0 | `npm install -g pnpm@11.24.0` |
| Python | 3.12+ | [python.org](https://www.python.org/downloads/) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| PostgreSQL | 17+ | [postgresql.org](https://www.postgresql.org/download/) |
| Redis | 7+ | [redis.io](https://redis.io/docs/getting-started/) |
| Docker | latest | [docker.com](https://www.docker.com/get-started) |

### Environment Variables

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string (default: `redis://localhost:6379/0`)
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL (use `redis://localhost:6379/0` for local)
- `AUTH_SECRET` — JWT signing secret
- `PHI_ENCRYPTION_KEY` — AES-256 key for PHI encryption (required in production)

---

## 2. Initial Setup

### Clone with Submodules

```bash
git clone --recursive https://github.com/daggerstuff/pixelated.git
cd pixelated
```

If already cloned without `--recursive`:

```bash
git submodule update --init --recursive
```

### Run Setup Script

```bash
./scripts/setup-dev.sh
```

This script:
1. Verifies Node.js, pnpm, Python, and uv are installed
2. Syncs git submodules (`ai/`, `foresight/`, `docs/`)
3. Installs Node.js dependencies (`pnpm install`)
4. Installs Python dependencies (`uv sync` in `ai/` and `foresight/`)
5. Starts local PostgreSQL and Redis via Docker (if available)
6. Runs database migrations
7. Seeds the development database

### Verify Setup

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). You should see the Pixelated Empathy landing page.

---

## 3. Development Workflow

### Frontend Only

```bash
pnpm dev
```

Runs the Astro dev server on port 5173 with hot module replacement.

### All Services

```bash
pnpm dev:all-services
```

Starts concurrently:
- Web app (port 5173)
- Bias detection service
- AI inference service
- Analytics service
- Background worker
- Training server
- WebSocket server
- Academic sourcing service
- Python bias detection

### Python Services (ai/ submodule)

```bash
cd ai/
uv sync
uv run python -m inference.server   # Start AI inference server
```

### Foresight MCP (foresight/ submodule)

```bash
cd foresight/
uv sync
uv run python -m foresight.server    # Start Foresight MCP server
```

---

## 4. Testing

### JavaScript / TypeScript

```bash
pnpm test:unit              # Unit tests (Vitest)
pnpm test:integration       # Integration tests
pnpm e2e                    # End-to-end tests (Playwright)
pnpm e2e:ui                 # Interactive E2E (headed browser)
```

### Python

```bash
cd ai/
uv run pytest               # Run all Python tests
uv run pytest tests/test_inference.py  # Specific test file
uv run pytest -k "test_name"           # By test name pattern
```

### Redis Test Override

When running tests against local Docker Redis, override:

```bash
export REDIS_URL="redis://localhost:6379/0"
export UPSTASH_REDIS_REST_URL="redis://localhost:6379/0"
```

---

## 5. Linting & Formatting

### JavaScript / TypeScript

```bash
pnpm lint                   # Type-aware linting (oxlint)
pnpm format                 # Auto-format (oxfmt + prettier)
pnpm format:check           # Check formatting without changes
```

> **Do not use** `astro check`, `pnpm typecheck`, or `tsc` — they cause OOM failures.
> Use `pnpm lint` (type-aware oxlint) instead.

### Python

```bash
cd ai/
uv run ruff check .          # Lint Python
uv run ruff format .         # Format Python
```

---

## 6. Building

```bash
pnpm build                  # Production build
```

Output goes to `apps/web/dist/`.

---

## 7. Submodule Management

This repo uses three git submodules:

| Submodule | Path | Remote |
|---|---|---|
| AI inference engine | `ai/` | `daggerstuff/ai.git` (branch: `staging`) |
| Foresight MCP | `foresight/` | `daggerstuff/foresight.git` (branch: `master`) |
| Documentation | `docs/` | `daggerstuff/docs.git` (branch: `master`) |

### After Pulling

```bash
git submodule update --init --recursive
# Or:
pnpm submodules:sync
```

### Making Changes in a Submodule

```bash
cd ai/
git checkout staging
# Make changes, commit, push
cd ..
git add ai/
git commit -m "chore: update ai submodule"
```

---

## 8. Project Architecture

### Monorepo Layout

- **`apps/web/`** — Main Astro 6 + React 19 application (SSR, API routes)
- **`apps/business-strategy-cms/`** — Business strategy content management
- **`agents/`** — AI agent packages (advisor, content, eve, intake, pipeline)
- **`packages/`** — Shared workspace packages
- **`ai/`** — Python AI inference and training (submodule)
- **`foresight/`** — Foresight MCP memory server (submodule)

### API Surface

- **Astro API routes** (`apps/web/src/pages/api/`) — 270+ endpoints
- **Express routes** — 15 endpoints (bias detection, analytics)
- **GraphQL** — Query layer for research data

### Data Layer

- **PostgreSQL 17 + pgvector** — Primary database with vector embeddings
- **MongoDB** — Document store for clinical sessions
- **Redis** — Caching and session state

### State Management

- **Zustand** — Client-side state stores
- **React Context** — Theme and auth context

---

## 9. Troubleshooting

### Submodules Are Empty

```bash
git submodule update --init --recursive
```

### Port 5173 Already in Use

```bash
lsof -ti:5173 | xargs kill -9
pnpm dev
```

### Database Connection Failed

1. Check PostgreSQL is running: `pg_isready`
2. Verify `DATABASE_URL` in `.env`
3. Run migrations: `pnpm db:migrate`

### Redis Connection Failed

1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` in `.env`
3. Start local Redis: `docker run -d -p 6379:6379 redis:7`

### OOM During Build or Lint

Do **not** use `astro check`, `pnpm typecheck`, or `tsc`. Use `pnpm lint` (oxlint) instead.

### pnpm Install Fails

```bash
rm -rf node_modules
pnpm store prune
pnpm install
```

---

## 10. Security Guidelines

- **Never** commit credentials, API keys, or patient data
- **Never** use `@ts-ignore`, `@ts-nocheck`, or `# type: ignore`
- **Always** validate API input with Zod schemas
- **Always** use parameterized SQL queries (never interpolate user input)
- Report vulnerabilities to [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com)

---

## 11. AI Assistant Instructions

This repo includes `AGENTS.md` with detailed instructions for AI coding assistants.
If you're using an AI tool (Cursor, Copilot, Claude Code, etc.), it should pick up
those conventions automatically.

See also: [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming and commit conventions.
