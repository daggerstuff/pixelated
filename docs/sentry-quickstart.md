# Sentry quickstart (build & runtime checks)

This page explains the small runtime checks and Docker build args added to help confirm Sentry is configured correctly.

What I changed
- `start-server.mjs`: prints redacted startup checks for `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `SENTRY_RELEASE`, and whether `SENTRY_AUTH_TOKEN` is provided. This is safe (DSNs are redacted) and non-fatal.
- `Dockerfile`: accepts build args for `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_RELEASE`, and `PUBLIC_SENTRY_DSN` and forwards them into build/runtime stages so build-time Sentry plugins (source map upload, etc.) can run.

Why this helps
- Many Sentry problems are caused by missing environment variables at build or runtime (for example, missing `SENTRY_AUTH_TOKEN` prevents source map upload; missing `SENTRY_RELEASE` can cause events/sessions to be discarded).
- The startup logs make it quick to verify whether the container has the expected values without exposing secrets.

How to build the Docker image with Sentry build args

Example build command (replace placeholders):

```bash
docker build \
  --tag pixelated:latest \
  --build-arg SENTRY_DSN="https://<key>@oXXX.ingest.sentry.io/YYY" \
  --build-arg SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN}" \
  --build-arg SENTRY_RELEASE="my-app@$(git rev-parse --short HEAD)" \
  --build-arg PUBLIC_SENTRY_DSN="https://<public>@oXXX.ingest.sentry.io/YYY" \
  .
```

How to run the container and provide runtime envs (recommended)

```bash
docker run --rm -e SENTRY_DSN="https://<key>@oXXX.ingest.sentry.io/YYY" \
  -e SENTRY_RELEASE="my-app@$(git rev-parse --short HEAD)" \
  -e PUBLIC_SENTRY_DSN="https://<public>@oXXX.ingest.sentry.io/YYY" \
  -p 4321:4321 pixelated:latest
```

Local test script

You can run the included script to send a test exception through the SDK (it flushes before exit):

```bash
# Locally (requires SENTRY_DSN in your environment)
SENTRY_DSN="https://<key>@oXXX.ingest.sentry.io/YYY" node scripts/test-sentry.mjs

# With SDK debug logs
SENTRY_DEBUG=1 SENTRY_DSN="https://<key>@oXXX.ingest.sentry.io/YYY" node scripts/test-sentry.mjs
```

Notes & next steps
- Ensure your CI sets `SENTRY_AUTH_TOKEN` and `SENTRY_RELEASE` when building so the source map upload plugin can attach releases correctly.
- The SDK will warn about a missing or non-string `SENTRY_RELEASE` in debug logs — setting a stable release (package version or git sha) usually fixes session/release-related drops.
- If events still don't appear, check the Sentry project's Inbound Filters and Rate Limits in the Sentry UI.

CI integration notes

If you use GitHub Actions, add the following secrets to the repository (Settings → Secrets):

- `SENTRY_AUTH_TOKEN` — token with `project:releases` and `org:read` permissions for uploading releases and source maps.
- `SENTRY_DSN` — optional, used to test builds and server side (you may prefer to set runtime envs in your deployment instead of build-time DSN).
- `PUBLIC_SENTRY_DSN` — optional client-side DSN if your app uses client error tracking.
- `SENTRY_ORG` and `SENTRY_PROJECT` — used by `sentry-cli` when uploading source maps.

I added a sample GitHub Actions workflow at `.github/workflows/sentry-build.yml` that builds the site, creates a Sentry release using the current commit SHA, and uploads source maps when `SENTRY_AUTH_TOKEN` is present.

GitLab CI

For GitLab CI, add these CI/CD variables in your project (Settings → CI/CD → Variables):

- `SENTRY_AUTH_TOKEN` — token for `sentry-cli` (required to upload source maps/releases)
- `SENTRY_DSN` — optional
- `PUBLIC_SENTRY_DSN` — optional

I added a sample `.gitlab-ci.yml` which uses `CI_COMMIT_SHORT_SHA` as the `SENTRY_RELEASE`, runs `pnpm build`, and uploads source maps when `SENTRY_AUTH_TOKEN` is present. The pipeline also builds a Docker image passing the Sentry build args.

If you'd like, I can add a gated `/api/_sentry-test` endpoint (protected by a token) you can hit from staging to verify events from deployed runtimes. 
