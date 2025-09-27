# syntax=docker/dockerfile:1
ARG BUILDKIT_INLINE_CACHE=1
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS base

# Labels
LABEL org.opencontainers.image.description="Astro"

# Install build tools, curl, and ca-certificates first so pnpm fallback always works
# Use Alpine package manager since base image is an Alpine variant
RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    g++ \
    git \
    curl \
    tini \
    ca-certificates

# Install pnpm with retries and fallbacks (no DNS modification needed)
ARG PNPM_VERSION=10.16.0
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-timeout 300000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    (npm install -g pnpm@$PNPM_VERSION || \
     npm install -g pnpm@$PNPM_VERSION --registry=https://registry.npmmirror.com || \
     (curl -fsSL https://get.pnpm.io/install.sh | sh - && \
      mv ~/.local/share/pnpm/pnpm /usr/local/bin/))

LABEL org.opencontainers.image.authors="Vivi <vivi@pixelatedempathy.com>"
LABEL org.opencontainers.image.title="Pixelated Empathy Node"
LABEL org.opencontainers.image.description="Secure Node.js app using a minimal base image for reduced vulnerabilities."

# Set working directory
WORKDIR /app
ARG SENTRY_DSN=""
# NOTE: Do NOT pass sensitive secrets like SENTRY_AUTH_TOKEN via ARG or ENV.
# Use BuildKit secrets at build-time (see example below) and runtime secrets
# (Kubernetes secrets / Docker secrets / environment injection) instead.
# Example build (BuildKit enabled):
#   DOCKER_BUILDKIT=1 docker build \
#     --secret id=sentry_auth_token,src=./sentry_auth_token.txt \
#     -t myapp:latest .
ARG SENTRY_RELEASE=""
ARG PUBLIC_SENTRY_DSN=""

ENV NODE_ENV="production"
ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV PUBLIC_SENTRY_DSN=${PUBLIC_SENTRY_DSN}
ENV ASTRO_TELEMETRY_DISABLED=1
ENV ASTRO_CACHE_DIR=/tmp/.astro
ENV VITE_CACHE_DIR=/tmp/.vite
ENV PORT=4321
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

RUN set -eux; \
    # Create group/user in a portable way (works on Debian/Alpine). Use fallbacks to avoid failing if already present.
    (groupadd -g 1001 astro || true) && \
    (useradd -u 1001 -g astro -s /bin/sh -M astro || true)

FROM base AS deps

# Copy package files first for better layer caching
COPY --chown=astro:astro package.json ./
COPY --chown=astro:astro pnpm-lock.yaml ./

# Install dependencies with optimizations
RUN pnpm config set store-dir /pnpm/.pnpm-store && \
    pnpm install --no-frozen-lockfile && \
    pnpm audit --audit-level moderate || true

FROM base AS build

# Forward build-time Sentry args into the build stage environment so plugins
# (like source map upload) can run during `pnpm build` when args are provided.
# NOTE: SENTRY_AUTH_TOKEN is intentionally NOT set via ENV here. If a build-time
# Sentry auth token is required (for source map upload etc.), provide it using
# a BuildKit secret and mount it during the specific RUN that needs it.
ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV PUBLIC_SENTRY_DSN=${PUBLIC_SENTRY_DSN}

# Copy dependencies from deps stage
COPY --from=deps --chown=astro:astro /app/node_modules ./node_modules
COPY --chown=astro:astro package.json ./
COPY --chown=astro:astro pnpm-lock.yaml ./

# Copy source files
COPY --chown=astro:astro src ./src
COPY --chown=astro:astro public ./public
COPY --chown=astro:astro astro.config.mjs ./
COPY --chown=astro:astro tsconfig.json ./
COPY --chown=astro:astro uno.config.ts ./
COPY --chown=astro:astro scripts ./scripts
COPY --chown=astro:astro instrument.mjs ./

# Copy the astro directory needed for tsconfig extends
COPY --chown=astro:astro astro ./astro

# Copy any additional config files that might be needed (optional)
# NOTE: Dockerfile COPY is not a shell command; remove shell operators like '|| true'.
# If files are optional, ensure they exist before building or provide them via build context.
COPY --chown=astro:astro .env* ./
COPY --chown=astro:astro *.config.* ./

# Build the application
RUN mkdir -p /tmp/.astro /app/node_modules/.astro && \
    chmod -R 755 /tmp/.astro /app/node_modules/.astro && \
    chown -R astro:astro /tmp/.astro /app/node_modules/.astro

# Set memory limits and build with verbose output
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=secret,id=sentry_auth_token \
    sh -lc 'if [ -f /run/secrets/sentry_auth_token ]; then export SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token); fi; echo "Starting pnpm build..." && pnpm build --verbose || (echo "Build failed, checking for common issues..." && ls -la src/ && ls -la public/ && echo "Node version: $(node --version)" && echo "pnpm version: $(pnpm --version)" && echo "Available memory (from /proc/meminfo):" && cat /proc/meminfo && exit 1)'

# Prune dev dependencies and clean up
RUN pnpm prune --prod && \
    rm -rf node_modules/.cache && \
    rm -rf /tmp/.astro && \
    rm -rf /root/.npm && \
    rm -rf /root/.pnpm-store && \
    find node_modules -name "*.ts" -type f -delete && \
    find node_modules -name "*.map" -type f -delete && \
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "*.md" -type f -delete 2>/dev/null || true

FROM base AS runtime

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4321/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))" || exit 1

USER astro

# Copy only production files
COPY --from=build --chown=astro:astro /app/dist ./dist
COPY --from=build --chown=astro:astro /app/node_modules ./node_modules
COPY --from=build --chown=astro:astro /app/package.json ./
COPY --from=build --chown=astro:astro /app/scripts ./scripts
COPY --from=build --chown=astro:astro /app/instrument.mjs ./

RUN mkdir -p /tmp/.astro && \
    chmod -R 755 /tmp/.astro

# Use tini to handle signals and zombie processes
ENTRYPOINT ["tini", "--", "node", "dist/server/entry.mjs"]
