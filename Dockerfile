# syntax=docker/dockerfile:1
ARG BUILDKIT_INLINE_CACHE=1
ARG NODE_VERSION=24

# Base stage with optimized package installation
FROM node:${NODE_VERSION}-alpine AS base

LABEL org.opencontainers.image.description="Pixelated Empathy - Secure Astro Application"
LABEL org.opencontainers.image.authors="Vivi <vivi@pixelatedempathy.com>"
LABEL org.opencontainers.image.title="Pixelated Empathy Node"
LABEL org.opencontainers.image.description="Secure Node.js app using a minimal base image for reduced vulnerabilities."

# Install system dependencies in a single layer with cleanup
RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    g++ \
    git \
    curl \
    tini \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Install pnpm with optimized configuration
ARG PNPM_VERSION=10.18.0
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-timeout 300000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install -g pnpm@$PNPM_VERSION && \
    npm cache clean --force

# Create non-root user early
RUN addgroup -g 1001 astro && \
    adduser -u 1001 -G astro -s /bin/sh -D astro

# Set working directory and ownership
WORKDIR /app
RUN chown astro:astro /app

# Environment variables for optimization
ENV NODE_ENV="production"
ENV ASTRO_TELEMETRY_DISABLED=1
ENV ASTRO_CACHE_DIR=/tmp/.astro
ENV VITE_CACHE_DIR=/tmp/.vite
ENV PORT=4321
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV XDG_CACHE_HOME=/tmp/.cache
RUN mkdir -p /tmp/.cache && \
    # ensure corepack and node cache dirs are writable by the non-root user we create
    mkdir -p /tmp/.cache/node/corepack/v1 && \
    chown -R 1001:1001 /tmp/.cache || true && \
    chmod -R 0777 /tmp/.cache || true && \
    corepack enable pnpm

# Dependencies stage - optimized for caching
FROM base AS deps

# Copy package files first (as root to ensure proper setup)
COPY --chown=astro:astro package.json pnpm-lock.yaml* ./

# Create cache directories with proper permissions for astro user
# Must be done as root before switching users
RUN mkdir -p /tmp/.cache/node/corepack/v1 /app/.pnpm-store && \
    # prefer numeric uid/gid to avoid name resolution issues in some builders
    chown -R 1001:1001 /tmp/.cache /app/.pnpm-store || true && \
    chmod -R 0777 /tmp/.cache || true && \
    chmod -R 0755 /app/.pnpm-store || true

# Switch to non-root user for dependency installation
USER astro

# Configure pnpm to use a smaller cache directory and install dependencies
# Use /tmp for corepack cache to avoid ENOSPC errors in user home
ENV XDG_CACHE_HOME=/tmp/.cache
RUN pnpm config set store-dir /app/.pnpm-store && \
    pnpm config set package-import-method copy && \
    pnpm config set registry https://registry.npmjs.org/ && \
    pnpm config set fetch-timeout 300000 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --prefer-offline --reporter=silent --ignore-scripts && \
    pnpm audit --audit-level moderate || true

# Build stage - optimized for performance
FROM base AS build

# Non-sensitive build arguments
ARG SENTRY_RELEASE=""
ARG PUBLIC_SENTRY_DSN=""

# Set non-sensitive environment variables
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV PUBLIC_SENTRY_DSN=${PUBLIC_SENTRY_DSN}

# Switch to non-root user
USER astro

# Copy dependencies and cache directories from deps stage (with proper permissions)
COPY --from=deps --chown=astro:astro /app/node_modules ./node_modules
COPY --from=deps --chown=astro:astro /app/.pnpm-store ./.pnpm-store
COPY --from=deps --chown=astro:astro /tmp/.cache /tmp/.cache
COPY --chown=astro:astro package.json ./
COPY --chown=astro:astro pnpm-lock.yaml* ./

# Copy source files in order of change frequency (least to most)
COPY --chown=astro:astro astro.config.mjs tsconfig.json uno.config.ts ./
COPY --chown=astro:astro instrument.mjs ./
COPY --chown=astro:astro astro ./astro
COPY --chown=astro:astro scripts ./scripts
COPY --chown=astro:astro public ./public
COPY --chown=astro:astro src ./src

# Copy environment and config files
COPY --chown=astro:astro .env* ./
COPY --chown=astro:astro *.config.* ./

# Create cache directories with proper permissions (including corepack cache)
# Note: /tmp/.cache is already copied with correct permissions from deps stage
RUN mkdir -p /tmp/.astro /app/node_modules/.astro /tmp/.cache/node/corepack/v1 && \
    chmod -R 755 /tmp/.astro /app/node_modules/.astro

# Build with optimized settings - disable experimental TypeScript stripping for Node 24 compatibility
# Secrets are mounted at build time and read from files (not exposed in image layers)
ENV NODE_OPTIONS="--max-old-space-size=4096 --no-experimental-strip-types"
RUN --mount=type=secret,id=sentry_dsn \
    --mount=type=secret,id=sentry_auth_token \
    --mount=type=secret,id=better_auth_secret \
    echo "🏗️ Starting optimized build process..." && \
    echo "Node: $(node --version), pnpm: $(pnpm --version)" && \
    echo "Memory available: $(cat /proc/meminfo | grep MemAvailable)" && \
    export SENTRY_DSN=$(cat /run/secrets/sentry_dsn 2>/dev/null || echo "") && \
    export SENTRY_AUTH_TOKEN=$(cat /run/secrets/sentry_auth_token 2>/dev/null || echo "") && \
    export BETTER_AUTH_SECRET=$(cat /run/secrets/better_auth_secret 2>/dev/null || echo "") && \
    pnpm build --verbose 2>&1 | tee /tmp/build.log && \
    echo "✅ Build completed successfully"

# Production cleanup - remove dev dependencies and unnecessary files
RUN echo "🧹 Cleaning up build artifacts..." && \
    pnpm prune --prod && \
    rm -rf node_modules/.cache \
           /tmp/.astro \
           /tmp/.vite \
           ~/.npm \
           ~/.pnpm-store \
           .pnpm-store && \
    find node_modules -name "*.ts" -type f -delete && \
    find node_modules -name "*.map" -type f -delete && \
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "*.md" -type f -delete 2>/dev/null || true && \
    find node_modules -name "*.txt" -type f -delete 2>/dev/null || true

# Runtime stage - minimal production image
FROM base AS runtime

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4321/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))" || exit 1

# Switch to non-root user
USER astro

# Copy only production files from build stage
COPY --from=build --chown=astro:astro /app/dist ./dist
COPY --from=build --chown=astro:astro /app/node_modules ./node_modules
COPY --from=build --chown=astro:astro /app/package.json ./
COPY --from=build --chown=astro:astro /app/scripts ./scripts
COPY --from=build --chown=astro:astro /app/instrument.mjs ./

# Create runtime cache directory
RUN mkdir -p /tmp/.astro && \
    chmod -R 755 /tmp/.astro

# Security: Use tini as init system and run as non-root
ENTRYPOINT ["tini", "--", "node", "dist/server/entry.mjs"]

# Expose port
EXPOSE 4321
