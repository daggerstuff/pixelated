# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Pixelated Empathy is a clinical AI platform built with
Astro 6 + React 19 (TypeScript) for the frontend/SSR,
with Express/FastAPI/Flask backend services.
See `README.md` for the full description.

### Runtime versions

- **Node.js**: 24.14.1 (see `.nvmrc`)
- **pnpm**: 11.1.1 (see `packageManager` in `package.json`)
- **Python**: 3.13 (see `.python-version`, `pyproject.toml`)
- **uv**: used for Python dependency management

### Required services (local dev)

| Service    | Command              | Port  | Notes                  |
| ---------- | -------------------- | ----- | ---------------------- |
| Astro dev  | `pnpm dev`           | 5173  | Main app               |
| MongoDB    | Docker `mongo:6`     | 27017 | No auth needed locally |
| Redis      | Docker `redis:7`     | 6379  | No auth needed locally |
| PostgreSQL | Docker `postgres:15` | 5432  | User/pass: see `.env`  |

Start databases with Docker before running `pnpm dev`.
See `docker/docker-compose.local-mongo.yml` and
`docker/docker-compose.db.yml` for reference compose files.

### Key commands

- **Lint**: `pnpm lint` (oxlint; pre-existing warnings/errors expected)
- **Tests**: `pnpm vitest run -c config/vitest.config.ts`
- **Dev server**: `pnpm dev` (Astro on port 5173)
- **Build**: `pnpm build`
- **Typecheck**: `pnpm typecheck`
- **All services**: `pnpm dev:all-services`

### Gotchas

- The full vitest suite can hang because some integration tests
  attempt to connect to an external Upstash Redis instance.
  When running tests locally, prefer targeted test runs using
  the `VITEST_TARGET_TESTS` environment variable.
- Vite 8 is in `package.json` but Astro 6 expects Vite 7;
  the dev server still works but logs a warning.
- The `.env` file is created from `.env.example`. For local dev,
  set `MONGODB_URI=mongodb://localhost:27017/pixelated_empathy`
  and configure `DATABASE_URL` for local PostgreSQL.
- Docker must be installed and running for database containers.
  In Cloud Agent VMs, use `fuse-overlayfs` storage driver and
  `iptables-legacy`.
- The `prepare` script installs git hooks on `pnpm install`.
