---
title: "Development Environment Setup"
description: "Development Environment Setup documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Development Environment Setup

This document provides detailed instructions for setting up your development environment for the Pixelated Empathy project.

## Prerequisites

- **Node.js:** v18.x or later (v22.x recommended)
- **Package Manager:** pnpm 10.11.0+ (required)
- **Git:** Latest version

## Initial Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/gradiant.git
cd gradiant
```

1. Install dependencies:

```bash
pnpm install --no-frozen-lockfile
```

1. Setup your environment variables:

```bash
cp .env.example .env.local
```

1. Edit the `.env.local` file with your specific configuration values.

2. Run the setup script to ensure all configurations are correct:

```bash
pnpm run setup:env
```

## Running in Development Mode

Start the development server:

```bash
pnpm dev
```

This will start the Astro development server on <http://localhost:3000>.

## Building for Production

```bash
pnpm build
```

## Error Tracking with Sentry

The project uses Sentry for error tracking and monitoring. To fully set up Sentry for your development environment:

1. Create an account on [Sentry](https://sentry.io) if you don't have one.

2. Create a new project in Sentry for your Astro application.

3. Add the following environment variables to your `.env.local` file:

```bash
PUBLIC_SENTRY_DSN=your_project_dsn
PUBLIC_SENTRY_ENVIRONMENT=development
PUBLIC_SENTRY_RELEASE=1.0.0
SENTRY_AUTH_TOKEN=your_auth_token
```

1. To generate a `SENTRY_AUTH_TOKEN`:
   - Go to [Sentry Auth Tokens](https://sentry.io/settings/account/api/auth-tokens/)
   - Create a new token with `project:releases` and `project:read` scopes
   - Copy the token to your `.env.local` file

> **Note:** Source maps will only be uploaded to Sentry when:
>
> - The `SENTRY_AUTH_TOKEN` is properly configured
> - You're building for production (`NODE_ENV=production`)
> - You're running a full build (not a development server)

### Disabling Sentry in Development

If you don't need Sentry integration during development, you can:

1. Leave the `SENTRY_AUTH_TOKEN` empty in your `.env.local` file
2. The build process will automatically disable source map uploads when no token is present

## Troubleshooting

If you encounter any issues:

1. Run the diagnostics tool:

```bash
pnpm run diagnostics
```

1. Ensure all environment variables are correctly set.

2. Check that you're using the correct Node.js version.

3. For Sentry-specific issues, verify your DSN and auth token are correct.

4. Consult the [Troubleshooting Guide](./TROUBLESHOOTING.md) for more detailed issue resolution.

## Additional Development Tools

- **Code Linting**: `pnpm lint`
- **Type Checking**: `pnpm typecheck`
- **Testing**: `pnpm test`
- **Formatting**: `pnpm format`
