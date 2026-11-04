# Branch Pipeline Policy

Production is deployed **off AWS**: Vercel serves pixelatedempathy.com as the
production origin, Cloudflare Workers is the migration target, and app/agent
images publish to Docker Hub from green staging CI. The former AWS EKS
deployment has been retired.

## Branches

| Branch      | Purpose             | Vercel?                   | Images?                    |
| ----------- | ------------------- | ------------------------- | -------------------------- |
| `staging`   | **The main branch** | Yes (prod, path-filtered) | Yes (auto-publish from CI) |
| `feature/*` | Feature development | No                        | No                         |
| `agent/*`   | Agent work          | No                        | No                         |

## Pipeline Flow

```
feature branch
    ↓ PR / merge to staging (the main branch)
staging
    ├─ CI workflow (lint, test, security)                      → .github/workflows/ci.yml
    ├─ Build and Publish Images (app + agents → Docker Hub)    → .github/workflows/build-images.yml
    ├─ Deploy to Cloudflare Workers (migration target)         → .github/workflows/deploy-cloudflare.yml
    └─ Vercel (frontend production only, path-filtered)        → .github/workflows/vercel.yml

The Vercel production deploy and the Cloudflare bundle fire on their own
path/credential gates; image publishes follow a successful CI run — no
overlap, no wasted builds.
```

## Why Vercel is Throttled

- Vercel is the production origin; builds still only make sense when
  frontend files actually change
- Every unnecessary Vercel build wastes money and slows feedback
- Path filtering ensures Vercel only builds when frontend actually changes

## Rules

1. **Vercel only builds on frontend path changes** — see vercel.yml path filter.
2. **No Vercel build on feature branches.** Use staging for previews.
3. **Production serves from Vercel**; Cloudflare Workers is the migration
   target origin (deploy-cloudflare.yml).
4. **Manual dispatch is always allowed** for emergency production verification.
