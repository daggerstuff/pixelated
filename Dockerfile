# Root-level development Dockerfile for Pixelated Empathy
# Production builds: use infra/Dockerfile (multi-stage, optimized)
# This file enables quick local development with Docker and docker-compose

FROM node:24-bookworm-slim

WORKDIR /app

# Install system dependencies for development
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    python3 \
    make \
    g++ \
    curl \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm
ARG PNPM_VERSION=12.18.0
RUN npm install -g pnpm@$PNPM_VERSION

# Copy package manifests for dependency installation
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY patches ./patches
# The root postinstall (scripts/fix-astro-vercel-nft.mjs) runs during
# pnpm install and needs scripts/ present
COPY scripts ./scripts
COPY config/package/.npmrc ./.npmrc
COPY packages/pixelated-sdk/package.json ./packages/pixelated-sdk/package.json
COPY packages/memory-schema/package.json ./packages/memory-schema/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Copy source code
COPY . .
RUN chown -R node:node /app

ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=8192"

EXPOSE 5173

USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://localhost:5173/ || exit 1

# Development server with hot reload
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
