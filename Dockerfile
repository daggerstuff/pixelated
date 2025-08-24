# syntax = docker/dockerfile:1

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim AS base

LABEL org.opencontainers.image.description="Astro"

ARG PNPM_VERSION=10.15.0
RUN npm install -g pnpm@$PNPM_VERSION

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential=12.* \
    node-gyp=* \
    pkg-config=* \
    python-is-python3=* \
    git=* \
    curl=* \
    ca-certificates=* && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

ENV NODE_ENV="production"
ENV ASTRO_TELEMETRY_DISABLED=1
ENV ASTRO_CACHE_DIR=/tmp/.astro
ENV VITE_CACHE_DIR=/tmp/.vite
ENV PORT=4321
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN groupadd --gid 1001 astro && \
    useradd --uid 1001 --gid astro --shell /bin/bash --create-home astro

FROM base AS deps

# Copy package files first for better layer caching
COPY --chown=astro:astro package.json pnpm-lock.yaml ./

# Install dependencies with optimizations
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prod=false

FROM base AS build

# Copy dependencies from deps stage
COPY --from=deps --chown=astro:astro /app/node_modules ./node_modules
COPY --chown=astro:astro package.json pnpm-lock.yaml ./

# Copy source files
COPY --chown=astro:astro src ./src
COPY --chown=astro:astro public ./public
COPY --chown=astro:astro astro.config.mjs ./
COPY --chown=astro:astro tsconfig.json ./
COPY --chown=astro:astro tailwind.config.ts ./
COPY --chown=astro:astro uno.config.ts ./
COPY --chown=astro:astro scripts ./scripts

# Copy the astro directory needed for tsconfig extends
COPY --chown=astro:astro astro ./astro

# Copy any additional config files that might be needed
COPY --chown=astro:astro .env* ./
COPY --chown=astro:astro *.config.* ./

# Build the application
RUN mkdir -p /tmp/.astro /app/node_modules/.astro && \
    chmod -R 755 /tmp/.astro /app/node_modules/.astro && \
    chown -R astro:astro /tmp/.astro /app/node_modules/.astro

# Set memory limits and build with verbose output
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN echo "Starting pnpm build..." && \
    pnpm build --verbose || (echo "Build failed, checking for common issues..." && \
    ls -la src/ && \
    ls -la public/ && \
    echo "Node version: $(node --version)" && \
    echo "pnpm version: $(pnpm --version)" && \
    echo "Available memory:" && \
    free -h && \
    exit 1)

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4321/api/health/simple || exit 1

USER astro

# Copy only production files
COPY --from=build --chown=astro:astro /app/dist ./dist
COPY --from=build --chown=astro:astro /app/node_modules ./node_modules
COPY --from=build --chown=astro:astro /app/package.json ./
COPY --from=build --chown=astro:astro /app/scripts ./scripts

RUN mkdir -p /tmp/.astro && \
    chmod -R 755 /tmp/.astro

EXPOSE 4321

CMD ["node", "scripts/start-server.js"]