# syntax=docker/dockerfile:1
ARG BUILDKIT_INLINE_CACHE=1
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base

# Labels
LABEL org.opencontainers.image.description="Astro"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential=12.9 \
    python3=3.11.2-1+b1 \
    make=4.3-4.1 \
    g++=4:12.2.0-3 \
    git=1:2.39.5-0+deb12u2 \
    curl=7.88.1-10+deb12u14 \
    tini=0.19.0-1+b3 \
    ca-certificates=20230311+deb12u1 && \
    rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=10.17.1
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN npm config set registry https://registry.npm.org/ && \
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

  WORKDIR /app
ARG SENTRY_DSN=""
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
    # Create group/user for Alpine Linux
    addgroup -g 1001 -S astro && \
    adduser -S astro -u 1001 -G astro

FROM base AS deps

COPY --chown=astro:astro package.json ./
COPY --chown=astro:astro pnpm-lock.yaml ./

RUN pnpm config set store-dir /pnpm/.pnpm-store && \
    pnpm install --no-frozen-lockfile && \
    pnpm audit --audit-level moderate || true

FROM base AS build

ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV PUBLIC_SENTRY_DSN=${PUBLIC_SENTRY_DSN}

COPY --from=deps --chown=astro:astro /app/node_modules ./node_modules
COPY --chown=astro:astro package.json ./
COPY --chown=astro:astro pnpm-lock.yaml ./

COPY --chown=astro:astro src ./src
COPY --chown=astro:astro public ./public
COPY --chown=astro:astro astro.config.mjs ./
COPY --chown=astro:astro tsconfig.json ./
COPY --chown=astro:astro uno.config.ts ./
COPY --chown=astro:astro scripts ./scripts
COPY --chown=astro:astro instrument.mjs ./

COPY --chown=astro:astro astro ./astro

<<<<<<< Updated upstream
COPY --chown=astro:astro *.config.* ./
=======
# Copy any additional config files that might be needed (optional)
# Docker's COPY does not accept shell operators like "|| true" — that becomes
# part of the destination path and breaks builds under BuildKit. Instead
# explicitly copy the known, safe files that exist in the repo. We include
# .env.example (do NOT commit secrets) so local builds can still use an
# example env. Any other optional configs are listed explicitly.
COPY --chown=astro:astro .env.example ./
COPY --chown=astro:astro postcss.config.cjs eslint.config.js sentry.client.config.js sentry.server.config.js ./
>>>>>>> Stashed changes

RUN mkdir -p /tmp/.astro /app/node_modules/.astro && \
    chmod -R 755 /tmp/.astro /app/node_modules/.astro && \
    chown -R astro:astro /tmp/.astro /app/node_modules/.astro

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=secret,id=sentry_auth_token \
    sh -c 'export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)"; \
    echo "Starting pnpm build..."; \
    pnpm build --verbose || (echo "Build failed, checking for common issues..." && \
    ls -la src/ && \
    ls -la public/ && \
    echo "Node version: $(node --version)" && \
    echo "pnpm version: $(pnpm --version)" && \
    echo "Available memory (from /proc/meminfo):" && \
    cat /proc/meminfo && \
    exit 1)'

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

COPY --from=build --chown=astro:astro /app/dist ./dist
COPY --from=build --chown=astro:astro /app/node_modules ./node_modules
COPY --from=build --chown=astro:astro /app/package.json ./
COPY --from=build --chown=astro:astro /app/scripts ./scripts
COPY --from=build --chown=astro:astro /app/instrument.mjs ./

RUN mkdir -p /tmp/.astro && \
    chmod -R 755 /tmp/.astro

ENTRYPOINT ["tini", "--", "node", "dist/server/entry.mjs"]
