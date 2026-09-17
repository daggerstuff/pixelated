# Vercel Deployment Policy

Vercel is the **frontend test center**, not the production deployment.
EKS with Amazon is production and will remain so. Vercel exists for:

- Preview URLs on PRs targeting staging (fast feedback)
- Occasional manual production verification from staging

It is NOT the source of truth for running the app in production.

## Branch Roles

| Branch | Role | Vercel? | EKS? |
|--------|------|---------|------|
| `staging` | **The main branch** | Yes (prod deploy, path-filtered) | Yes (auto-deploy from CI) |
| `feature/*` | Feature development | No | No |
| `agent/*` | Agent work | No | No |

## Trigger Rules

| Event | Vercel Build? | Notes |
|-------|--------------|-------|
| Push to `staging` | Yes (prod), **only on frontend path changes** | EKS deploys non-frontend changes; Vercel handles frontend |
| PR to `staging` | Yes (preview) | Only when frontend files change |
| Push to feature branches | No | Use `staging` for previews |
| Manual dispatch | Yes | `workflow_dispatch` always allowed |

## Path Filtering

Vercel builds only fire when frontend-relevant files change.
All other pushes (infra, backend, config, docs) are handled by
EKS or other workflows — never by Vercel.

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

- `ai/**` — Python ML (EKS/K8s)
- `infra/**` — Terraform/K8s (EKS)
- `terraform/**` — AWS infra (EKS)
- `scripts/**` — deployment scripts (EKS)
- `docs/**` — static content (docs-deploy.yml)
- `agents/**` — agent code (EKS)

## Cost Control

- All Vercel jobs use `concurrency` group to cancel stale runs
- `continue-on-error: true` on preview deploys (don't block PRs)
- Vercel only builds on frontend path changes — no wasted builds on staging
- `workflow_dispatch` is the only way to force a Vercel build on demand

## Relationship to EKS Pipeline

```
git push to staging
  ├─ CI (lint/test/build)          → .github/workflows/ci.yml
  ├─ Deploy to AWS EKS             → .github/workflows/deploy-aws.yml
  └─ Vercel (frontend only)        → .github/workflows/vercel.yml (path-filtered)
```

Both EKS and Vercel fire on staging pushes, but each only on their
relevant paths — no overlap, no wasted builds.
