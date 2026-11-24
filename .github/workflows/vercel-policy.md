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
| Manual dispatch          | Yes                                    | `workflow_dispatch` always allowed          |

## One Deployer Only

`vercel.json` sets `git.deploymentEnabled: false`. Vercel's own GitHub Git
integration used to build a deployment for **every** push and PR, ignoring the
path filters below, which burned the account build quota and surfaced as
`Deployment rate limited` checks on unrelated PRs (Dependabot bumps included).
It is off, so the only deployer is `.github/workflows/vercel.yml`, which
path-filters and skips Dependabot previews. Re-enable the integration only if
the workflow is retired.

## Fork Pull Requests

Fork PRs get no Vercel preview. GitHub withholds repository secrets from
`pull_request` runs of fork branches, so `Deploy Preview` cannot
authenticate; the step is `continue-on-error: true`, so the run stays green
and CI's own build remains the check. Vercel's Git integration had an
approval-based fork preview, and re-enabling it would restore that path at
the cost of the quota burn this policy removed.

The Vercel GitHub App still posts a `Vercel Deployments – pixelthis` status
on PR heads. With the integration's builds off, that status does not imply
a build ran; only removing the app from the org stops the status.

## Path Filtering

Vercel builds only fire when frontend-relevant files change. All other pushes
(infra, backend, config, docs) are handled by other workflows — never by
Vercel.

### Frontend-relevant paths (Vercel):

Mirror of the `paths:` filters in `.github/workflows/vercel.yml` — change
both together.

```
apps/web/**
astro.config.*
packages/ui/**
packages/components/**
packages/memory-schema/**
vercel.json
.vercelignore
package.json
pnpm-lock.yaml
.github/workflows/vercel.yml
```

`packages/memory-schema/**` is on the list because the site imports it
through `TherapyGate` and the Memory API contract rules: a schema-only
change would otherwise leave the standby serving the old validation rules.

### NOT Vercel paths (handled elsewhere):

- `ai/**` — Python ML (submodule, typecheck/ratchet gates)
- `infra/**` — local/VPS infrastructure (docker-compose)
- `scripts/**` — tooling and CI scripts
- `docs/**` — static content (docs-deploy.yml)
- `agents/**` — agent code (Docker images via build-images.yml)

## Cost Control

- All Vercel jobs use `concurrency` group to cancel stale runs
- `continue-on-error: true` on preview deploys (don't block PRs)
- Previews deploy with `--no-prod`: the Vercel CLI reads `--prod=false` as
  `--prod` (66.6.0 prints `! --prod=false turns --prod on`), so the preview
  job used to publish a Production deployment of the PR head on the standby
  project (pixelated#7036, `pixelated-lfog1pnte-pixelthis.vercel.app`)
- The Dependabot skip keys on `github.event.pull_request.user.login`, not
  `github.actor`: a maintainer's amendment keeps the PR author, so the
  preview stays skipped
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
