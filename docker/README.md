# Docker Build Options for Pixelated Empathy

This project provides multiple Dockerfile options for different build environments.

## Dockerfiles

### `Dockerfile` (Primary - BuildKit Required)
- **Use Case**: Local development, GitLab CI, Azure DevOps, or any environment with BuildKit support
- **Features**:
  - Uses `--mount=type=secret` for secure secret handling
  - Secrets are mounted at build time and NOT stored in image layers
  - Multi-stage build with optimized caching
  - Requires BuildKit enabled
- **Build Command**:
  ```bash
  DOCKER_BUILDKIT=1 docker build \
    --secret id=sentry_dsn,env=SENTRY_DSN \
    --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    --secret id=better_auth_secret,env=BETTER_AUTH_SECRET \
    -t pixelated-empathy .
  ```

### `Dockerfile.cloudbuild` (Google Cloud Build Compatible)
- **Use Case**: Google Cloud Build (no BuildKit support)
- **Features**:
  - Compatible with standard Docker builder
  - Secrets passed as build arguments (less secure but compatible)
  - Same multi-stage optimization as primary Dockerfile
  - No BuildKit features required
- **Build Command**:
  ```bash
  docker build -f Dockerfile.cloudbuild \
    --build-arg SENTRY_DSN="$SENTRY_DSN" \
    --build-arg SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" \
    --build-arg BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
    -t pixelated-empathy .
  ```


## Cloud Build Configuration

### `cloudbuild.yaml`
Google Cloud Build configuration that:
- Uses `Dockerfile.cloudbuild` for maximum compatibility
- Reads secrets from Google Secret Manager
- Pushes to Google Container Registry (GCR)
- Uses E2_HIGHCPU_8 machine for faster builds

**Required Secrets in Google Secret Manager:**
- `sentry-dsn`
- `sentry-auth-token`
- `better-auth-secret`

**Trigger Build:**
```bash
gcloud builds submit --config=cloudbuild.yaml .
```

## Security Notes

⚠️ **Important**: The `Dockerfile.cloudbuild` passes secrets as build arguments, which means they will be visible in:
- Docker image history (`docker history <image>`)
- Build logs

For maximum security, use the primary `Dockerfile` with BuildKit-enabled environments. Only use `Dockerfile.cloudbuild` when BuildKit is not available.

## Local Development

For local development with docker-compose:
```bash
# Uses Dockerfile by default
docker-compose up --build
```

## CI/CD Recommendations

- **GitLab CI**: Use `Dockerfile` with `DOCKER_BUILDKIT=1`
- **Azure DevOps**: Use `Dockerfile` with `DOCKER_BUILDKIT=1`
- **GitHub Actions**: Use `Dockerfile` with docker/build-push-action@v5
- **Google Cloud Build**: Use `cloudbuild.yaml` with `Dockerfile.cloudbuild`
- **AWS CodeBuild**: Use `Dockerfile` with privileged mode and BuildKit
