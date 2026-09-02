# Pixelated Empathy — WebSocket Server (port 4321)

FROM node:24-bookworm-slim AS base

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.12.0

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY patches ./patches
COPY tsconfig.json ./

RUN pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null || \
    pnpm install --no-frozen-lockfile --ignore-scripts

COPY apps/web/src/ ./src/
COPY config/ ./config/
COPY types/ ./types/

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s \
    CMD curl -sf http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["npx", "tsx", "apps/web/src/server.ts"]
