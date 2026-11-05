---
description: Deployment Guide documentation
pubDate: '2024-01-15'
author: Pixelated Team
tags:
  - documentation
draft: false
toc: true
title: Deployment Guide
---

# Deployment Guide

## Production (Cloudflare Workers)

**[REDACTED]** is served from **Cloudflare Workers** after green CI on `staging`.
The deploy pipeline is [`.github/workflows/deploy-cloudflare.yml`](../../../../../.github/workflows/deploy-cloudflare.yml);
policy and triggers are summarized in [`AGENTS.md`](../../../../../AGENTS.md) and
[`CONTRIBUTING.md`](../../../../../CONTRIBUTING.md).

**Vercel** remains a **warm standby** origin (path-filtered deploy from
[`.github/workflows/vercel.yml`](../../../../../.github/workflows/vercel.yml)).
It is not the primary production surface for the public site.

**Docker Hub** receives app and agent images from
[`.github/workflows/build-images.yml`](../../../../../.github/workflows/build-images.yml)
when staging CI succeeds.

## Prerequisites (any target)

Before deploying, ensure:

1. All tests pass (`pnpm test`)
2. The build completes successfully (`pnpm build`)
3. Required environment variables are set
4. Database and external services are configured

## Environment Variables

The following environment variables should be set in your deployment
environment:

```bash
# Database
POSTGRES_URL=your-database-url
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Authentication
AUTH_SECRET=your-auth-secret
AUTH_TRUST_HOST=true

# Application
PUBLIC_SITE_URL=https://your-site-url.com

# APIs
OPENAI_API_KEY=your-openai-key
```

## Local development and Docker Compose

Use **`pnpm dev`** or **`pnpm dev:all-services`** for day-to-day work. Scripts
**`pnpm deploy`** / **`pnpm deploy:prod`** invoke `scripts/deploy/deploy.sh` for
**local Docker Compose** environments (`infra/docker/`), not Workers production.

### Docker image (lab / self-hosted)

```bash
docker build -f infra/Dockerfile -t your-app-name .
```

See `infra/docker/README.md` for compose variants.

## Vercel (standby / previews)

Vercel deploys are automated for **`staging`** (standby) and PR previews when
frontend paths change. Manual CLI deploy remains available:

```bash
vercel --prod
```

Treat Vercel as standby unless you are explicitly testing that origin.

## Other hosting (legacy notes)

The sections below describe generic Astro static/SSR and third-party hosts
(Netlify, GitHub Pages). They are retained for reference only and do not describe
the primary production path.

### Static hosting

```bash
pnpm build
```

Output is under `dist/` for static hosts.

### SSR adapters

For SSR experiments, configure an Astro adapter in `astro.config.mjs` and run
`pnpm build`. Production SSR for the public site is handled by the Workers
bundle, not the samples below.

<details>
<summary>Legacy SSR examples (Netlify, sample vercel.json)</summary>

See [Astro deploy docs](https://docs.astro.build/en/guides/deploy/) for
adapter-specific configuration.

</details>

## Database setup

Before deploying the frontend, ensure your database is set up:

1. Set up your PostgreSQL database (or use Supabase)
2. Run database migrations if applicable
3. Configure connection strings in your environment variables
4. Test database connectivity

## CI/CD

Production deploys are **not** driven by a root `deploy.yml` sample. Use:

- [`deploy-cloudflare.yml`](../../../../../.github/workflows/deploy-cloudflare.yml)
- [`vercel.yml`](../../../../../.github/workflows/vercel.yml)
- [`build-images.yml`](../../../../../.github/workflows/build-images.yml)

## Post-deployment verification

After deploying, perform these checks:

1. Verify all pages load correctly
2. Test authentication flow
3. Check that database connections are working
4. Verify all interactive components function properly
5. Test responsiveness on different devices

## Rollback

- **Workers:** use the Cloudflare dashboard or workflow rollback procedures for
  the active Worker revision.
- **Vercel standby:** roll back via the Vercel deployment history.
- **Docker Compose (local):** restart with the previous image tag.

## Troubleshooting

1. **Build failures:** run `pnpm build` locally on the same commit as CI.
2. **Missing env:** compare Worker/Vercel project env with `CONTRIBUTING.md`.
3. **Local stack:** see `infra/docker/README.md` and `pnpm docker:logs`.

For platform policy, see [`AGENTS.md`](../../../../../AGENTS.md).
