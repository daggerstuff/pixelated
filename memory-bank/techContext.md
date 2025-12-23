# Technical Context

## Technology Stack

### Frontend
- Astro 5.x with React 19 integration
- TypeScript 5.x
- Accessibility: WCAG 2.1 AA

### Backend
- Node.js 24+ with TypeScript
- REST APIs and (where applicable) WebSockets for real-time flows

### Python / AI Tooling
- Python 3.11+ using `uv` for dependency management and execution
- Dataset pipelines, validation, and traceability tooling live under `ai/` and related directories

### Infrastructure & IaC
- Terraform for infrastructure as code, using a GitLab HTTP remote backend configured in `terraform/backend.config` for `pixelated-azure-infrastructure`. The backend authenticates as `gitlab-ci-token` and requires `TF_HTTP_PASSWORD` to be provided via environment or pipeline variables (never hard-coded).

## Package Management (Strict)
- Node.js: `pnpm` only (never npm/yarn)
- Python: `uv` only (never pip/conda)

## Common Commands
```bash
pnpm install
pnpm dev
pnpm dev:all-services
pnpm check:all
pnpm test:all

uv install
uv run pytest
```

## Repo Layout Notes
- `.memory/`: source-of-truth memory bank files (00–70)
- `memory-bank/`: mirrored/secondary memory bank files used for session continuity
- `ai/`: Python AI services and research pipelines (large)
- `ai/training_ready/`: training data + configs + manifests for training workflows (including platform sync scripts like `platforms/ovh/sync-datasets.sh`)

## Current Repo State (Dec 2025)
- `ai/` and `ai/training_ready/` exist in the working tree and are currently untracked in git; resolve whether they should be committed or ignored.
