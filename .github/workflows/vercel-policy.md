# Vercel Deployment Policy

Vercel is the **warm standby** for pixelatedempathy.com: production serves
from Cloudflare Workers (`deploy-cloudflare.yml`), which takes the apex traffic
via a Workers zone route. Vercel keeps a current build at its `*.vercel.app`
URL, keeps its proxied apex records in place, and keeps issuing the
`www.pixelatedempathy.com` redirect. The former AWS EKS deployment has been
retired. Vercel provides:

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
| PR to `staging`          | Yes (preview)                          | Only when frontend files change, and never for Dependabot PRs |
| Push to feature branches | No                                     | Use `staging` for previews                  |
| Manual dispatch          | Only from `staging`                     | The preview job is gated on `pull_request`; a dispatch elsewhere runs no job |

## One Deployer Only

`vercel.json` sets `git.deploymentEnabled: false`. Vercel's own GitHub Git
integration used to build a deployment for **every** push and PR, ignoring the
path filters below, which burned the account build quota and surfaced as
`Deployment rate limited` checks on unrelated PRs (Dependabot bumps included).
It is off, so the only deployer is `.github/workflows/vercel.yml`, which
path-filters and skips Dependabot previews. Re-enable the integration only if
the workflow is retired.

## Known Trade-offs (Git integration off)

- **Fork PRs get no preview.** Vercel's approval-based fork authorization ships
  with the GitHub integration, and GitHub withholds the token the workflow
  needs on a fork pull request. A manual dispatch run does **not** help: the
  preview job is gated on the `pull_request` event, so a dispatch only reaches
  the production job. To preview fork work, push its commits to a same-repo
  branch and open a pull request from it, or re-enable the integration.
- **Vercel may still post a status.** The `Vercel Deployments - <project>`
  context can appear on a PR even when no build is created; it is not evidence
  a deployment ran, and it is not a required check.
- **Workspace packages are part of the build.** The path filters cover
  `packages/**` because the web build imports workspace sources
  (`@pixelated/memory-schema`), so a package-only change must still refresh the
  standby.

## Path Filtering

Vercel builds only fire when frontend-relevant files change. All other pushes
(infra, backend, config, docs) are handled by other workflows — never by
Vercel.

### Frontend-relevant paths (Vercel):

```
apps/web/**
astro.config.*
packages/**
vercel.json
.vercelignore
package.json
pnpm-lock.yaml
.github/workflows/vercel.yml
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

Remove the Workers zone route (the `routes` block in `wrangler.jsonc`) and
redeploy: the zone's proxied apex records still point at Vercel, so it resumes
serving immediately. Re-run the Vercel alias step if the project alias ever
drifted. Vercel builds stayed warm throughout the cutover.
