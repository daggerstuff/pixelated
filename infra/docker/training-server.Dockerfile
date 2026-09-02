# Pixelated Empathy — Training Server (port 8004)

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

EXPOSE 8004

CMD ["npx", "tsx", "apps/web/src/lib/services/training/server.ts"]
