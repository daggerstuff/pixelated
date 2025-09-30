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
ARG PNPM_VERSION=10.17.1
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
RUN corepack enable pnpm

# Dependencies stage - optimized for caching
FROM base AS deps

# Switch to non-root user for dependency installation
USER astro

# Copy package files with proper ownership
COPY --chown=astro:astro package.json pnpm-lock.yaml ./

# Configure pnpm store and install dependencies with optimizations
RUN pnpm config set store-dir /app/.pnpm-store && \
    pnpm config set package-import-method copy && \
    pnpm config set frozen-lockfile true && \
    pnpm install --frozen-lockfile --prefer-offline && \
    pnpm audit --audit-level moderate || true

# Build stage - optimized for performance
FROM base AS build

# Build-time arguments for Sentry
ARG SENTRY_DSN=""
ARG SENTRY_AUTH_TOKEN=""
ARG SENTRY_RELEASE=""
ARG PUBLIC_SENTRY_DSN=""
ARG BETTER_AUTH_SECRET=""

# Set build environment variables
ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV PUBLIC_SENTRY_DSN=${PUBLIC_SENTRY_DSN}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}

# Switch to non-root user
USER astro

# Copy dependencies from deps stage
COPY --from=deps --chown=astro:astro /app/node_modules ./node_modules
COPY --from=deps --chown=astro:astro /app/.pnpm-store ./.pnpm-store
COPY --chown=astro:astro package.json pnpm-lock.yaml ./

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

# Create cache directories with proper permissions
RUN mkdir -p /tmp/.astro /app/node_modules/.astro && \
    chmod -R 755 /tmp/.astro /app/node_modules/.astro

# Build with optimized settings
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN echo "🏗️ Starting optimized build process..." && \
    pnpm build --verbose || (\
        echo "❌ Build failed, debugging..." && \
        ls -la src/ public/ && \
        echo "Node: $(node --version), pnpm: $(pnpm --version)" && \
        echo "Memory info:" && cat /proc/meminfo | head -5 && \
        exit 1\
    )

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