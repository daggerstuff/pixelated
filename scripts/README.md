# Scripts Directory

Operational utilities, deployment helpers, and developer workflows for Pixelated Empathy.

## Organization

| Subdirectory | Purpose |
|---|---|
| `ci/` | CI/CD pipeline helpers — linting, building, changed-file detection |
| `testing/` | Test runners (Playwright docker setup, local vitest wrapper) |
| `devops/` | Security scans, git hooks, Copilot-safe-run, NIM setup |
| `memory/` | Foresight MCP server launcher and config |
| `auth0/` | Auth0 integration helpers |
| `backup/` | Database backup and restore utilities |
| `deploy/` | Release and rollback scripts |
| `training/` | Model training orchestration |
| `research/` | Dataset sourcing and academic pull automation |
| `content/` | Blog publishing and post scheduling |
| `migration/` | Database migration helpers |
| `infrastructure/` | Deploy targets (staging/production), K8s secret rendering |
| `qa/` | Quality assurance scripts |
| `governance/` | Compliance and audit tooling |
| `utils/` | General-purpose helpers (no-fail wrapper, credential scanner) |

## Notable Top-Level Scripts

| Script | What it does |
|---|---|
| `setup-dev.sh` | **One-command local setup** — installs deps, starts Docker databases, copies `.env` |
| `redis.sh` | Redis service management — start, ping, health, switch local/remote |
| `check-redis-hardening.sh` | Security audit for Redis configuration |
| `consolidated-test.js` | Multi-suite test runner (HIPAA, crypto, backup, security) |

## Adding New Scripts

1. Place category-specific scripts in the matching subdirectory
2. Expose via `package.json` scripts if used regularly by developers
3. Keep shell scripts POSIX-compatible; Node/TS scripts should use `tsx` or `node`
