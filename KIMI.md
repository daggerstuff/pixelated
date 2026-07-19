# KIMI.md — Pixelated Empathy

> Comprehensive project context for AI agents and future maintainers.
> Last updated: 2026-07-16

---

## 1. Project

**Pixelated Empathy** is a clinical AI platform that bridges mental health practice with advanced, safety-aligned AI.
It provides high-stakes, human-centered environments where clinical teams can practice, analyze, and evolve emotional
intelligence before real-world deployment.

- **Primary language / runtime:** TypeScript / Node.js 24 (ES2022)
- **Key frameworks:** Astro 5 (SSG/SSR), React 19, Express.js, Vite
- **Data stores:** PostgreSQL 17, Redis, MongoDB
- **Auth:** Auth0
- **Observability:** Sentry, OpenTelemetry
- **Infra:** Docker, Kubernetes (Helm), AWS/Vercel/Cloudflare

---

## 2. Build / Test / Run

All commands use **pnpm**.

| Command | Purpose | Notes |
|---------|---------|-------|
| `pnpm install` | Install deps | Uses pnpm 11.x; postinstall patches Astro/Vercel NFT |
| `./scripts/setup-dev.sh` | Full local setup | Starts DBs, installs deps, seeds data |
| `pnpm dev` | Dev server | Astro dev, host 0.0.0.0, port 5173, 8GB heap |
| `pnpm dev:all-services` | All microservices | Concurrently runs frontend + bias-detection + ai-service + analytics + worker + training + websocket + academic-sourcing |
| `pnpm build` | Production build | Astro build; outputs to `dist/` |
| `pnpm preview` | Preview production build | Uses custom start-server script |
| `pnpm start` | Production start | Node server with clustering |
| `pnpm test` | Run all tests | Vitest; unit + integration (10m timeout in CI) |
| `pnpm test:unit` | Unit tests only | Fast, no external services |
| `pnpm test:integration` | Integration tests | Needs Redis/Auth0; skipped in CI |
| `pnpm test:e2e` | Playwright E2E | Browser automation tests |
| `pnpm typecheck` | Type check | `astro check && tsc --noEmit` (8GB heap) |
| `pnpm lint` | Lint | oxlint + custom no-suppressions check |
| `pnpm lint:fix` | Auto-fix lint | oxlint --fix-dangerously |
| `pnpm format` | Format | oxfmt + prettier for `.astro` files |
| `pnpm format:check` | Check formatting | CI uses `format:check:changed` for speed |
| `pnpm docker:up` | Start Docker stack | Full local stack via docker-compose |

**Slow / special-setup commands:**
- `pnpm dev:all-services` — spins up 9 processes; very memory-heavy.
- `pnpm typecheck` / `pnpm build` — need 8GB Node heap; may OOM without `NODE_OPTIONS`.
- Integration tests require live Redis, Auth0, and sometimes PostgreSQL.

---

## 3. Layout

| Directory | Rationale |
|-----------|-----------|
| `src/pages/` | Astro file-based routing. `.astro` = pages, `.ts` = API routes (Express handlers). |
| `src/api/` | Express.js server, middleware, and route mounts. Separated from Astro pages for clarity. |
| `src/lib/` | Core business logic: DB clients, auth, AI services, security, audit, logging. |
| `src/components/` | React and Astro UI components. React islands hydrate where interactivity is needed. |
| `src/middleware/` | Astro middleware (security headers, CSP, request sanitization). |
| `src/styles/` | Global CSS, design tokens, research-specific stylesheets. |
| `src/types/` | Shared TypeScript type definitions. |
| `src/workers/` | Background worker processes (notifications, analytics, email, dreams). |
| `packages/` | Monorepo packages consumed by the app and external tools. |
| `packages/memory-schema/` | Canonical Zod schemas, runtime guards, and types for the memory system. |
| `packages/pixelated-sdk/` | External SDK (Foresight MCP) for third-party integrations. |
| `tests/` | Top-level integration, e2e, and auth0 tests. Keeps heavy tests separate from src. |
| `agents/` | AI pipeline agents with their own test suites (training, evaluation, promotion). |
| `scripts/` | Build, deploy, CI, database migration, and utility scripts. |
| `docker/` | Dockerfiles and compose stacks for local dev and production. |
| `k8s/` | Kubernetes manifests and Helm charts. |
| `ai/` | Python FastAPI services (academic sourcing, bias detection helpers). |
| `config/` | Shared config files (vitest configs, instrument files). |

---

## 4. Conventions

### Naming
- **Files:** kebab-case for utilities, PascalCase for components/classes, camelCase for functions.
- **Tests:** Suffix `.test.ts` (unit) or `.spec.ts` (API/integration). Co-located `__tests__/` dirs are also used.
- **Types:** PascalCase interfaces/types; avoid `I` / `T` prefixes.

### Import style
- ES modules only (`"type": "module"`).
- Path aliases (tsconfig):
  - `@/*` and `~/*` → `./src/*`
  - `@lib/*`, `@components/*`, `@layouts/*`, `@utils/*`, `@types/*`
  - `@pixelated/memory-schema` → `packages/memory-schema/src`
- Prefer `node:` prefix for built-ins (`node:path`, `node:fs/promises`).
- Never import from internal `./types` or `./guards` inside `packages/memory-schema`; use the package index.

### File organization
- Colocate related logic: a feature lives in `src/lib/<feature>/` with its types, tests, and utilities.
- API routes in `src/pages/api/` follow Astro convention but delegate to `src/api/` for business logic.

### Commit & branch style
- **Branches:** `feat/short-desc`, `fix/short-desc`, `docs/short-desc`, `chore/short-desc`, `refactor/short-desc`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Target branch for CI/PRs: `staging`.

### TypeScript strictness
- `strict: true`, `noImplicitAny: false` (legacy allowance).
- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`.
- `jsx: react-jsx`, `jsxImportSource: react`.
- `isolatedModules: true`, `noEmit: true`.
- Prefer `as unknown as T` over `as any` when accessing runtime-only properties.

### Testing conventions
- **Framework:** Vitest (node + jsdom environments).
- **Unit:** Fast, no external services. Located in `__tests__/` or sibling `.test.ts`.
- **Integration:** Require Redis/Auth0/DB. Excluded in CI via `ciNodeTestGlobs`.
- **E2E:** Playwright in `tests/e2e/`.
- **Coverage:** Enabled locally by default; disabled in CI via `VITEST_COVERAGE_ENABLED=false`.
- CPU-bound load/perf tests are excluded from default runs; run explicitly with `VITEST_TARGET_TESTS`.

### Surprising / non-obvious
- `astro.config.mjs` forces the **Node adapter** even when building on Vercel (ECS Fargate requirement).
- `postinstall` patches Astro/Vercel NFT to fix a known bundling bug.
- `src/lib/logging/build-safe-logger.ts` must be used everywhere to prevent secret leakage in logs.
- Security middleware applies strict CSP, HSTS, and HIPAA-compliant headers globally.

---

## 5. Dependencies

- **Package manager:** pnpm 11.x
- **Install:** `pnpm install` (lockfile is `pnpm-lock.yaml`)
- **Dev vs runtime:** Most build/test tools are devDependencies. Runtime deps include Astro, React, Express, DB drivers, Auth0 SDK, AWS SDKs.
- **Native deps:** `pg`, `bcrypt`, `sharp` may require native compilation; CI installs `python3 build-essential node-gyp`.
- **Version policy:** Many deps are pinned to `latest` in package.json (not ideal). Prefer explicit versions for stability. Do not upgrade `latest` tags blindly.
- **Python side:** Uses `uv` for the FastAPI academic-sourcing service (`ai/sourcing/academic/api/main:app`).

---

## 6. Do / Don't

1. **Never commit secrets.** Use `.env` files (ignored). Run `pnpm security:check` to scan.
2. **Never use `console.log` in production code.** Use `createBuildSafeLogger` from `@/lib/logging/build-safe-logger`.
3. **Never import from `packages/memory-schema/src/*` directly.** Always use `@pixelated/memory-schema`.
4. **Don't use `as any`.** Use `as unknown as T` with a comment if unavoidable.
5. **Don't bundle server-only modules into client bundles.** Astro/Vite should tree-shake, but verify with `pnpm build`.
6. **Don't run integration tests in CI without Redis/Auth0.** They are excluded by default.
7. **Don't modify `pnpm-lock.yaml` manually.**
8. **Don't ignore TypeScript errors.** `noEmit` means errors block nothing at runtime, but `pnpm typecheck` will catch them.
9. **Always run `pnpm lint:ci:imports` after adding new files** to catch unresolved imports early.
10. **HIPAA compliance is real.** PHI detection, audit logging, and encryption are enforced in code; bypassing them is a security incident.

---

## 7. Debugging & Troubleshooting

| Issue | Fix |
|-------|-----|
| Build OOM / heap out of memory | `export NODE_OPTIONS='--max-old-space-size=8192'` (already in scripts) |
| TypeScript resolution errors | Run `pnpm ts:debug` or `pnpm ts:debug:verbose` |
| Redis not available | `pnpm redis:start` or `docker-compose up redis` |
| Database not initialized | `pnpm db:migrate` or run `./scripts/setup-dev.sh` |
| Import alias not resolving | Check `tsconfig.json` paths and restart the dev server |
| Lint failures on unchanged files | CI uses changed-file linting; run `pnpm lint:ci` locally |
| Astro dev toolbar clutter | `pnpm toolbar:off` |
| Clean everything | `pnpm docker:reset` or `rm -rf node_modules dist .astro && pnpm install` |

**Logs:**
- Application logs go through the build-safe logger (pino-based).
- Docker logs: `pnpm docker:logs`
- Server logs: stdout/stderr from `pnpm dev` or `pnpm start`

---

## 8. Architecture Notes

### Key abstractions
- **Astro frontend:** Static + server-rendered pages with React islands for interactivity.
- **Express API server:** Mounted inside Astro via `src/api/server.ts`. Handles REST routes, middleware, auth, rate limiting.
- **Database layer:** `src/lib/db/index.ts` provides a pooled PostgreSQL client with migrations, transactions, and health checks.
- **Memory system:** Governed by `packages/memory-schema`. Memories have scopes (session → arc → trait → fact) and retention policies.
- **AI services:** Bias detection, patient response generation, training orchestration, and academic sourcing (Python FastAPI).
- **Security:** Centralized in `src/middleware/security.ts` — CSP, HSTS, input validation, PHI detection, rate limiting.
- **Audit:** Immutable audit logs with chain validation for compliance.
- **Workers:** Background processes for notifications, analytics, and dream processing.

### Data flow
1. User → Astro page (SSR/SSG) or API route.
2. API routes → Express middleware (auth, rate limit, version) → business logic in `src/lib/`.
3. Business logic → PostgreSQL (primary), Redis (cache/sessions), MongoDB (optional telemetry).
4. AI features → dedicated microservices (Node or Python) via internal HTTP/WebSocket.
5. Background jobs → Redis-backed workers.

### External integrations
- **Auth0:** Identity, RBAC, social login.
- **Sentry:** Error tracking and performance monitoring.
- **OpenTelemetry:** Distributed tracing (OTLP HTTP/gRPC exporters).
- **AWS:** S3, DynamoDB, EC2, EKS, RDS, KMS.
- **Azure:** Blob storage.
- **Google Cloud:** Storage.
- **Cloudflare:** Workers, AI chat, shell/think APIs.

### State management
- Server state: PostgreSQL + Redis.
- Client state: React hooks and context (no global state library like Redux).
- Real-time: WebSocket server for notifications and analytics streaming.

### Monorepo
- Managed via **pnpm workspaces** (`pnpm-workspace.yaml` includes `packages/*`).
- Two published packages: `@pixelated/memory-schema` and `pixelated-sdk`.
- No Turborepo or Nx; build orchestration is script-based.

---

<!-- End of KIMI.md -->