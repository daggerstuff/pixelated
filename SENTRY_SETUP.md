# Sentry Configuration for Pixelated Empathy Platform

This document outlines the Sentry setup for error monitoring and performance tracking.

## Configuration Files

### 1. `instrument.mjs` - Main Instrumentation
The primary Sentry configuration file that must be imported before any other modules:
- Sets up error tracking, performance monitoring, and profiling
- Configures environment-specific settings
- Handles PII (Personally Identifiable Information) collection
- Includes error filtering for health checks and monitoring bots

### 2. Server Configuration
- **Astro Integration**: Configured in `astro.config.mjs` with sourcemap upload
- **Middleware**: Imported at the top of `src/middleware.ts` for SSR applications
- **Microservices**: Individual imports in bias detection and AI services servers

## Environment Variables

Set these in your environment or `.env` file:

```bash
# Required - Sentry Data Source Name
SENTRY_DSN="https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032"

# Optional - for sourcemap uploads
SENTRY_ORG="pixelated-empathy-dq"
SENTRY_PROJECT="pixel-astro"
SENTRY_AUTH_TOKEN="your-auth-token-here"

# Environment
NODE_ENV="development" # or "production"
```

## Usage

### Development
```bash
pnpm dev
```
Sentry will run in debug mode with full tracing and profiling.

### Production
```bash
# Build first
pnpm build

# Start with standard Astro preview
pnpm start

# OR start with custom Node.js server (includes Sentry instrumentation)
pnpm start:sentry
```

### Microservices
```bash
# Start individual services (already instrumented)
pnpm dev:bias-detection
pnpm dev:ai-service
```

## Features Enabled

1. **Error Tracking**: Automatic exception capture
2. **Performance Monitoring**: Request tracing (10% sampling in production)
3. **Profiling**: CPU profiling (10% sampling in production)
4. **Release Tracking**: Automatic version detection
5. **Environment Tagging**: Development vs production
6. **Error Filtering**: Health checks and bot traffic excluded
7. **PII Collection**: IP addresses and user context (when enabled)

## Integration Points

- **Astro SSR**: Full server-side error tracking
- **React Components**: Client-side error boundaries (via sentry.client.config.js)
- **API Routes**: Automatic API error capture
- **Microservices**: Individual service instrumentation
- **Build Process**: Sourcemap upload for better error context

## Verification

After deployment, verify Sentry is working:
1. Check the Sentry dashboard for incoming events
2. Trigger a test error in development
3. Monitor performance data in production

## Security Notes

- PII collection is enabled for better debugging
- Error filtering prevents noise from health checks
- Auth token should be kept secure and not committed to version control
- DSN is safe to expose in client-side code but sensitive in server logs
