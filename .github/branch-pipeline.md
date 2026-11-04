# Branch Pipeline Policy

Production is deployed **off AWS**: Cloudflare Workers serves
pixelatedempathy.com as the production origin (Vercel stays warm at its
`*.vercel.app` URL and still issues the `www` redirect), and app/agent images
publish to Docker Hub from green staging CI. The former AWS EKS deployment has
been retired.

## Branches

| Branch      | Purpose             | Cloudflare?          | Vercel?       | Images?                    |
| ----------- | ------------------- | -------------------- | ------------- | -------------------------- |
| `staging`   | **The main branch** | Yes (prod, after CI) | Yes (standby) | Yes (auto-publish from CI) |
| `feature/*` | Feature development | No                   | No            | No                         |
| `agent/*`   | Agent work          | No                   | No            | No                         |

## Pipeline Flow

```
feature branch
    ↓ PR / merge to staging (the main branch)
staging
    ├─ CI workflow (lint, test, security)                      → .github/workflows/ci.yml
    ├─ Build and Publish Images (app + agents → Docker Hub)    → .github/workflows/build-images.yml
    ├─ Deploy to Cloudflare Workers (production origin)        → .github/workflows/deploy-cloudflare.yml
    └─ Vercel (warm standby, path-filtered)                    → .github/workflows/vercel.yml

The Cloudflare deploy follows a successful CI run; Vercel keeps building the
standby on frontend changes — no overlap, no wasted builds.
```

## Rules

1. **Production serves from Cloudflare Workers** — deploy-cloudflare.yml builds
   the `@astrojs/cloudflare` bundle, syncs the runtime env from the
   `CF_WORKER_*` repository secrets, and attaches `pixelatedempathy.com` as a
   Workers custom domain (wrangler.jsonc `routes`).
2. **Vercel stays warm**: it builds on staging pushes (path-filtered), but
   `pixelatedempathy.com` resolves to the Worker. Fail back by detaching the
   custom domain and re-pointing the zone records at Vercel.
3. **No Vercel build on feature branches.** Use staging for previews.
4. **Manual dispatch is always allowed** for emergency production verification.
