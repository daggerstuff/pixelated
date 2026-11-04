# Vercel Deployment Policy

Vercel is the **production origin** for pixelatedempathy.com. Production is
deployed off AWS; the former AWS EKS deployment has been retired. Vercel
provides:

- Production deploys from staging (path-filtered)
- Preview URLs on PRs targeting staging (fast feedback)

## Branch Roles

| Branch      | Role                | Vercel?                          | Images?                    |
| ----------- | ------------------- | -------------------------------- | -------------------------- |
| `staging`   | **The main branch** | Yes (prod deploy, path-filtered) | Yes (auto-publish from CI) |
| `feature/*` | Feature development | No                               | No                         |
| `agent/*`   | Agent work          | No                               | No                         |

## Trigger Rules

| Event                    | Vercel Build?                                 | Notes                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------- |
| Push to `staging`        | Yes (prod), **only on frontend path changes** | Image publishes cover backend/agent changes |
| PR to `staging`          | Yes (preview)                                 | Only when frontend files change             |
| Push to feature branches | No                                            | Use `staging` for previews                  |
| Manual dispatch          | Yes                                           | `workflow_dispatch` always allowed          |

## Path Filtering

Vercel builds only fire when frontend-relevant files change. All other pushes
(infra, backend, config, docs) are handled by other workflows — never by
Vercel.

### Frontend-relevant paths (Vercel):

```
apps/web/src/**
apps/web/public/**
astro.config.*
apps/web/tailwind.config.*
packages/ui/**
packages/components/**
vercel.json
.vercelignore
```

### NOT Vercel paths (handled elsewhere):

- `ai/**` — Python ML (submodule, typecheck/ratchet gates)
- `infra/**` — local/VPS infrastructure (docker-compose)
- `scripts/**` — tooling and CI scripts
- `docs/**` — static content (docs-deploy.yml)
- `agents/**` — agent code (Docker images via build-images.yml)

## Cost Control

- All Vercel jobs use `concurrency` group to cancel stale runs
- `continue-on-error: true` on preview deploys (don't block PRs)
- Vercel only builds on frontend path changes — no wasted builds on staging
- `workflow_dispatch` is the only way to force a Vercel build on demand

## Pipeline on staging pushes

```
git push to staging
  ├─ CI (lint/test/build)          → .github/workflows/ci.yml
  ├─ Build and Publish Images       → .github/workflows/build-images.yml (app + agents → Docker Hub)
  ├─ Deploy to Cloudflare Workers   → .github/workflows/deploy-cloudflare.yml (migration target, credential-gated)
  └─ Vercel production (frontend only) → .github/workflows/vercel.yml (path-filtered)
```

The Vercel production deploy, the image publishes, and the Cloudflare bundle
all fire on staging pushes, each only on their relevant paths or gates — no
overlap, no wasted builds.
