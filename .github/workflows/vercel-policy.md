# Vercel Deployment Policy

Vercel is the **warm standby** for pixelatedempathy.com: production serves from
Cloudflare Workers (`deploy-cloudflare.yml`), which owns the production custom
domain. Vercel keeps a current build at its `*.vercel.app` URL and keeps
issuing the `www.pixelatedempathy.com` redirect. The former AWS EKS deployment
has been retired. Vercel provides:

- Standby production builds from staging (path-filtered)
- Preview URLs on PRs targeting staging (fast feedback)
- The `www` redirect target and an origin to fail back to

## Branch Roles

| Branch      | Role                | Vercel?                            | Images?                    |
| ----------- | ------------------- | ---------------------------------- | -------------------------- |
| `staging`   | **The main branch** | Yes (standby build, path-filtered) | Yes (auto-publish from CI) |
| `feature/*` | Feature development | No                                 | No                         |
| `agent/*`   | Agent work          | No                                 | No                         |

## Trigger Rules

| Event                    | Vercel Build?                          | Notes                                       |
| ------------------------ | -------------------------------------- | ------------------------------------------- |
| Push to `staging`        | Yes, **only on frontend path changes** | Image publishes cover backend/agent changes |
| PR to `staging`          | Yes (preview)                          | Only when frontend files change             |
| Push to feature branches | No                                     | Use `staging` for previews                  |
| Manual dispatch          | Yes                                    | `workflow_dispatch` always allowed          |

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
  ├─ Deploy to Cloudflare Workers   → .github/workflows/deploy-cloudflare.yml (production origin, after CI)
  └─ Vercel standby (frontend only) → .github/workflows/vercel.yml (path-filtered)
```

The Cloudflare deploy (production), the image publishes, and the Vercel
standby build all fire on staging pushes, each only on its relevant paths or
gates — no overlap, no wasted builds.

## Failing back to Vercel

Detach the Workers custom domain (remove the `routes` block from
`wrangler.jsonc`, redeploy), then restore the zone's apex records to Vercel
(`A 76.76.21.21` / `CNAME cname.vercel-dns.com` per Vercel's recommendation)
and re-run the Vercel alias step. Vercel builds stayed warm throughout the
cutover, so the standby serves immediately.
