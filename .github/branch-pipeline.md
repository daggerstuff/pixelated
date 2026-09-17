# Branch Pipeline Policy

## Branches

| Branch | Purpose | Vercel? | EKS? |
|--------|---------|---------|------|
| `staging` | **The main branch** | Yes (prod, path-filtered) | Yes (auto-deploy from CI) |
| `feature/*` | Feature development | No | No |
| `agent/*` | Agent work | No | No |

## Pipeline Flow

```
feature branch
    ↓ PR / merge to staging (the main branch)
staging
    ├─ CI workflow (lint, test, docker build, security scan)   → .github/workflows/ci.yml
    ├─ Deploy to AWS EKS (auto, via deploy-aws.yml)            → infra/backend/config changes
    └─ Vercel (frontend only, path-filtered)                   → apps/web, packages/ui/** changes

Both EKS and Vercel fire on staging pushes, but each only on their
relevant paths — no overlap, no wasted builds.
```

## Why Vercel is Throttled

- EKS handles all real deployment work (backend, frontend, agents)
- Vercel is only for quick frontend preview/prod verification
- Every unnecessary Vercel build wastes money and slows feedback
- Path filtering ensures Vercel only builds when frontend actually changes

## Rules

1. **Vercel only builds on frontend path changes** — see vercel.yml path filter.
2. **No Vercel build on feature branches.** Use staging for previews.
3. **EKS is the source of truth** for running the app. Vercel is not.
4. **Manual dispatch is always allowed** for emergency production verification.
