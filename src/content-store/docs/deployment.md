---
title: "Deployment Guide"
description: "Deployment Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Deployment Guide

This guide covers how to deploy the Astro application to various environments.

## Prerequisites

Before deploying, ensure:

1. All tests pass (`pnpm test`)
2. The build completes successfully (`pnpm build`)
3. Required environment variables are set
4. Database and external services are configured

## Environment Variables

The following environment variables should be set in your deployment environment:

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

## Deployment Options

### 1. Static Hosting (Recommended)

Astro supports static generation, which is the recommended approach for deploying this application.

#### Build for Static Hosting

```bash
pnpm build
```

This will generate a static site in the `dist/` directory, which can be deployed to any static hosting service.

#### Deploy to Vercel

```bash
vercel --prod
```

#### Deploy to Netlify

```bash
netlify deploy --prod
```

#### Deploy to GitHub Pages

```bash
pnpm deploy
```

This runs a script that pushes the `dist/` directory to the `gh-pages` branch.

### 2. Server-Side Rendering (SSR)

For dynamic content that needs to be generated at request time, use SSR deployment.

#### Build for SSR

Update `astro.config.mjs` to use the appropriate adapter:

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
});
```

Then build the application:

```bash
pnpm build
```

#### Deploy to Vercel with SSR

Add a `vercel.json` file:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/dist/server/entry.mjs"
    }
  ]
}
```

Then deploy:

```bash
vercel --prod
```

#### Deploy to Netlify with SSR

Create a `netlify.toml` file:

```toml
[build]
  command = "pnpm build"
  publish = "dist/"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/entry"
  status = 200

[functions]
  node_bundler = "esbuild"
```

Then deploy:

```bash
netlify deploy --prod
```

### 3. Docker Deployment

For containerized environments, use Docker:

#### Build the Docker Image

```bash
docker build -t your-app-name .
```

#### Run the Docker Container

```bash
docker run -p 3000:3000 \
  -e POSTGRES_URL=your-database-url \
  -e SUPABASE_URL=your-supabase-url \
  -e SUPABASE_ANON_KEY=your-supabase-anon-key \
  -e AUTH_SECRET=your-auth-secret \
  -e AUTH_TRUST_HOST=true \
  -e PUBLIC_SITE_URL=https://your-site-url.com \
  -e OPENAI_API_KEY=your-openai-key \
  your-app-name
```

#### Deploying with Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - POSTGRES_URL=your-database-url
      - SUPABASE_URL=your-supabase-url
      - SUPABASE_ANON_KEY=your-supabase-anon-key
      - AUTH_SECRET=your-auth-secret
      - AUTH_TRUST_HOST=true
      - PUBLIC_SITE_URL=https://your-site-url.com
      - OPENAI_API_KEY=your-openai-key
```

Then run:

```bash
docker-compose up -d
```

## Database Setup

Before deploying the frontend, ensure your database is set up:

1. Set up your PostgreSQL database (or use Supabase)
2. Run database migrations if applicable
3. Configure connection strings in your environment variables
4. Test database connectivity

## Continuous Integration/Continuous Deployment (CI/CD)

### GitHub Actions

Create a `.github/workflows/deploy.yml` file:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '22'

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Post-Deployment Verification

After deploying, perform these checks:

1. Verify all pages load correctly
2. Test authentication flow
3. Check that database connections are working
4. Verify all interactive components function properly
5. Test responsiveness on different devices
6. Run Lighthouse audit for performance and accessibility

## Rollback Procedure

If issues are encountered after deployment:

1. For Vercel/Netlify: Use their dashboard to roll back to the previous deployment
2. For Docker: Restart the container with the previous image version
3. For database changes: Have a rollback plan for schema migrations

## Performance Monitoring

Set up monitoring for your deployed application:

1. Add [Sentry](https://sentry.io/) for error tracking
2. Set up [LogRocket](https://logrocket.com/) for session replay
3. Configure [Vercel Analytics](https://vercel.com/analytics) or [Google Analytics](https://analytics.google.com/)

## Troubleshooting

### Common Issues

1. **Static assets not loading**: Check paths in the build output
2. **API calls failing**: Verify environment variables are set correctly
3. **Authentication issues**: Check Auth settings and secret keys
4. **SSR rendering errors**: Look for server logs in your hosting provider

### Getting Help

If you encounter issues not covered here:

1. Check the [Astro documentation](https://docs.astro.build/en/guides/deploy/)
2. Post in the [Astro Discord](https://astro.build/chat)
3. Search for similar issues in the [Astro GitHub repository](https://github.com/withastro/astro/issues)
