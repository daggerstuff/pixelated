# Pixelated Monorepo Reorg — File Move Map

> Baseline captured 2026-08-25. HEAD `8387a5625` on `staging`.
> Working tree at start: 0 staged, 168 modified tracked, 231 untracked.
> Submodules (`gitlink` mode 160000): `ai` (staging), `foresight` (master).
> `docs/` is NO LONGER a gitlink (de-submoduled): 2 tracked blobs, rest untracked,
> stale `.git/modules/docs` present.

## Fixed invariants

- `ai/` and `foresight/` stay git submodules at their current paths.
- `docs/` treated as content dir (not a submodule); no relocation planned.
- Anti-suppression: no `@ts-ignore` / `# noqa` / `# type: ignore`.
- Every phase verified with `pnpm typecheck`, `pnpm lint`, `uv run ruff check .`,
  `uv run pytest`, `pnpm build`.

## Move map (source → target)

### Phase 1 — prune (delete or gitignore)

| Source | Action | Note |
| --- | --- | --- |
| `.agent/ .eve/ .commandcode/ .codegraph/ .kimiflare/ .opencode/ .mastracode/ .lavish/ .impeccable/ .junie/ .omc/ .omo/ .px/ .astro/ .ruff_cache/ .hypothesis/ .baselines/` | gitignore | agent dotfiles → `~/.<agent>` |
| `frontend/` | relocate 6 analytics files → `apps/web/src/lib/analytics/`, then delete | orphan app |
| `agent/` | delete | 0 tracked files |
| `ai-services/` | delete | only `api.pid` |
| `artifacts/ scan-out/ html-report/ logs/ research-reports/` | gitignore/delete | generated |
| `infra/sinker/run_*.json` | delete | generated |
| root `omp-session-*.html`, `*.egg-info/`, `.tsbuildinfo`, `memory.db-shm` | delete/gitignore | generated |
| `google-workspace-cli-*.sha256`, `settings.local.json`, `.auth_state.json`, `.autoswitch_venv`, `.nim-proxy.pid` | delete/gitignore | stray |

### Phase 2 — infra consolidation

| Source | Target |
| --- | --- |
| `docker/` | `infra/docker/` |
| `deploy/` | `infra/deploy/` |
| `k8s/` | `infra/k8s/` |
| `monitoring/` | `infra/monitoring/` |
| `metoro-exporter/` | `infra/metoro-exporter/` |
| `infra/sinker/` | `infra/sinker/` (unchanged) |
| root `docker-compose*.yml`, root `Dockerfile` | `infra/` |

### Phase 3 — apps/web extraction

| Source | Target |
| --- | --- |
| `src/` | `apps/web/src/` |
| `public/` | `apps/web/public/` |
| `astro.config.mjs`, `astro-env.d.ts`, `vercel.json`, `sentry.*.config.ts`, `uno.config.ts`, `eslint.config.js`, `codegen.ts`, `playwright.config.ts`, `vitest.config.ts`, `knip.json`, `biome.json` | `apps/web/` |
| `business-strategy-cms/` | `apps/business-strategy-cms/` |
| `cli/px/` | `tools/px/` |

### Phase 4 — src/lib consolidation

| Source | Canonical |
| --- | --- |
| `src/lib/database` + `src/lib/db` | `src/lib/db` |
| `src/lib/rate-limit` + `src/lib/rate-limiting` | `src/lib/rate-limit` |
| `src/lib/ehr` + `src/lib/ehr-native` | `src/lib/ehr-native` |
| `src/lib/security` + `src/lib/threat-intelligence` + `src/lib/threat-detection` | `security/` + `threat/` |
| `src/services` + `src/lib/services` | `src/lib/services` |
| standalone `*server.ts` under `src/lib/ai/*/`, `src/lib/services/*/` | `services/` |

### Phase 5 — config + content

| Source | Target |
| --- | --- |
| `config/` + `astro/tsconfigs/` + root config | `config/` (consolidated) |
| `business-strategy/` | `content/business-strategy/` |
| `templates/` | `content/templates/` |
| `tokens/` | `apps/web/src/tokens/` |

## Risk checklist (must rewire)

- `package.json`, `pnpm-workspace.yaml`, `pyproject.toml`
- `astro.config.mjs`, `tsconfig.json` + `config/tsconfig*.json`, `vercel.json`
- `codegen.ts`, `vitest.config.ts`, `playwright.config.ts`, `uno.config.ts`, `eslint.config.js`, `biome.json`, `knip.json`
- `Dockerfile` + `docker/*.Dockerfile` + `docker-compose*.yml` + `agents/deploy/docker-compose.yaml`
- `.github/workflows/*`, `Makefile`, `Makefile.agents`, `.gitmodules`, `.gitignore`, `.dockerignore`, `.vercelignore`