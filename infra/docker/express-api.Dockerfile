# Pixelated Empathy — Express API Server
# Serves the business-strategy API routes on port 5000

FROM node:24-bookworm-slim AS base

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.12.0

WORKDIR /app

# Copy package manifests for layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY patches ./patches
COPY tsconfig.json ./

# Install dependencies (production + tsx)
RUN pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null || \
    pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source
COPY apps/web/src/ ./src/
COPY config/ ./config/
COPY types/ ./types/

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -sf http://localhost:5000/api/health || exit 1

EXPOSE 5000

CMD ["npx", "tsx", "apps/web/src/api/server.ts"]
