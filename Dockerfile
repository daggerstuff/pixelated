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
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV="production"
ENV ASTRO_TELEMETRY_DISABLED=1
ENV ASTRO_CACHE_DIR=/tmp/.astro
ENV VITE_CACHE_DIR=/tmp/.vite
ENV PORT=4321

RUN groupadd --gid 1001 astro && \
    useradd --uid 1001 --gid astro --shell /bin/bash --create-home astro

RUN mkdir -p /app && chown -R astro:astro /app

FROM base AS build

COPY --chown=astro:astro package.json pnpm-lock.yaml ./

# Copy all source files first to ensure proper dependency resolution
COPY --chown=astro:astro . .

RUN mkdir -p /tmp/.astro /app/node_modules/.astro && \
    chmod -R 755 /tmp/.astro /app/node_modules/.astro && \
    pnpm install --no-frozen-lockfile --prod=false && \
    pnpm build && \
    pnpm prune --prod

FROM base

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4321/api/health/simple || exit 1

USER astro

COPY --from=build --chown=astro:astro /app /app

RUN mkdir -p /app/node_modules/.astro /tmp/.astro && \
    chown -R astro:astro /app/node_modules /tmp/.astro && \
    chmod -R 755 /app/node_modules /tmp/.astro

EXPOSE 4321

CMD ["node", "scripts/start-server.js"]