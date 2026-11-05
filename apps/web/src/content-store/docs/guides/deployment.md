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

> **Current platform:** Production serves from **Cloudflare Workers**
> ([REDACTED] via a Workers zone route). **Vercel** is the warm standby origin.
> App and agent images publish to **Docker Hub** after green staging CI. The
> former AWS EKS production path is retired.

This page previously described AWS Console, Terraform, ECS, and CodeDeploy flows.
Those steps are obsolete for production. Use the sources below instead.

## Where to deploy

| Audience | Document |
| -------- | -------- |
| All agents and contributors | [`AGENTS.md`](../../../../../../AGENTS.md) (CI/CD pipeline policy) |
| Release workflow and checks | [`CONTRIBUTING.md`](../../../../../../CONTRIBUTING.md) — *Releases and deploys* |
| Cloudflare Workers production | [`.github/workflows/deploy-cloudflare.yml`](../../../../../../.github/workflows/deploy-cloudflare.yml) |
| Vercel standby (path-filtered) | [`.github/workflows/vercel.yml`](../../../../../../.github/workflows/vercel.yml) |
| Docker image publish | [`.github/workflows/build-images.yml`](../../../../../../.github/workflows/build-images.yml) |

## Local and compose

- **`pnpm dev`** / **`pnpm dev:all-services`** — local development ([CONTRIBUTING.md](../../../../../../CONTRIBUTING.md)).
- **`pnpm deploy`** / **`pnpm deploy:prod`** — run `scripts/deploy/deploy.sh` for **local Docker Compose** stacks, not Cloudflare production.
- **`infra/docker/`** — compose files for services, training, and monitoring on a developer or lab host.

## Pre-deploy checklist (production)

1. CI green on the target revision (`staging` for production Workers deploy).
2. **`pnpm build`** and targeted tests pass on that revision.
3. Runtime secrets synced via repository `CF_WORKER_*` secrets (see workflow), not checked into the repo.

For rollback and incident response, follow operations runbooks in the `docs/`
submodule (`docs/operations/`) when initialized, and the workflows above for
platform rollback.
