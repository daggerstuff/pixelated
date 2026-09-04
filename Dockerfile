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
ARG PNPM_VERSION=11.12.0
RUN npm install -g pnpm@$PNPM_VERSION

# Copy package manifests for dependency installation
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY patches ./patches
COPY config/package/.npmrc ./.npmrc
COPY packages/pixelated-sdk/package.json ./packages/pixelated-sdk/package.json
COPY packages/memory-schema/package.json ./packages/memory-schema/package.json
COPY apps/business-strategy-cms/package.json ./apps/business-strategy-cms/package.json

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=8192"

EXPOSE 5173

# Development server with hot reload
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
