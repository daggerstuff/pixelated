FROM node:24-slim AS base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    python3=3.11.2-1 \
    python3-pip=23.0.1+dfsg-1 \
    python3-venv=3.11.2-1 \
    curl=7.88.1-10+deb12u5 \
    ca-certificates=20230311 \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=
RUN npm install -g pnpm@$PNPM_VERSION

RUN python3 -m pip install --no-cache-dir uv || true

WORKDIR /app

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY /src/lib/ai/bias-detection/requirements.txt .
RUN if command -v uv >/dev/null 2>&1; then \
            uv pip install --python /opt/venv/bin/python --no-cache-dir --requirement requirements.txt; \
        else \
            pip install --no-cache-dir --requirement requirements.txt; \
        fi

FROM base AS build

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

COPY src/lib/ai ./src/lib/ai
COPY src/types ./src/types
COPY ai ./ai
COPY tsconfig.json ./

RUN pnpm tsc --project tsconfig.json --outDir dist

FROM base AS production

RUN groupadd -g 1001 aiservice || true && \
    useradd -u 1001 -g 1001 -s /bin/sh -M -N -r aiservice || true

COPY --from=build --chown=aiservice:aiservice /app/dist ./dist
COPY --from=build --chown=aiservice:aiservice /app/node_modules ./node_modules
COPY --from=build --chown=aiservice:aiservice /app/ai ./ai

USER aiservice

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

CMD ["node", "dist/lib/ai/services/server.js"]
