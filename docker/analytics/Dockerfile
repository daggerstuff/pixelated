# Analytics and Monitoring Service
FROM node:22-slim AS base

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
ARG PNPM_VERSION=10.12.3
RUN npm install -g pnpm@$PNPM_VERSION

WORKDIR /app

# Build stage
FROM base AS build

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Copy analytics source code
COPY src/lib/ai/analytics.ts ./src/lib/ai/
COPY src/lib/ai/performance ./src/lib/ai/performance
COPY src/lib/analytics ./src/lib/analytics
COPY src/types ./src/types
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm tsc --project tsconfig.json --outDir dist

# Production stage
FROM base AS production

RUN addgroup --system --gid 1001 analytics && \
    adduser --system --uid 1001 analytics

# Copy built application
COPY --from=build --chown=analytics:analytics /app/dist ./dist
COPY --from=build --chown=analytics:analytics /app/node_modules ./node_modules

# Create data directory
RUN mkdir -p /app/data && chown analytics:analytics /app/data

USER analytics

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

CMD ["node", "dist/lib/analytics/server.js"]
