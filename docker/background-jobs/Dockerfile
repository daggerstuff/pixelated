# Background Jobs Service
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

# Copy background jobs source code
COPY src/lib/jobs ./src/lib/jobs
COPY src/lib/ai ./src/lib/ai
COPY src/types ./src/types
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm tsc --project tsconfig.json --outDir dist

# Production stage
FROM base AS production

RUN addgroup --system --gid 1001 jobs && \
    adduser --system --uid 1001 jobs

# Copy built application
COPY --from=build --chown=jobs:jobs /app/dist ./dist
COPY --from=build --chown=jobs:jobs /app/node_modules ./node_modules

USER jobs

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "process.exit(0)"

CMD ["node", "dist/lib/jobs/worker.js"]
