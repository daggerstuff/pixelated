# AI Services - LLM, Mental Arena, Emotions
FROM node:22-slim AS base

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    python3=3.11.2-1 \
    python3-pip=23.0.1+dfsg-1 \
    python3-venv=3.11.2-1 \
    curl=7.88.1-10+deb12u5 \
    ca-certificates=20230311 \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
ARG PNPM_VERSION=10.12.3
RUN npm install -g pnpm@$PNPM_VERSION

WORKDIR /app

# Create Python virtual environment for ML models
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python ML dependencies
COPY /src/lib/ai/bias-detection/requirements.txt .
RUN pip install --no-cache-dir --requirement requirements.txt

# Build stage
FROM base AS build

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Copy AI services source code
COPY src/lib/ai ./src/lib/ai
COPY src/types ./src/types
COPY ai ./ai
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm tsc --project tsconfig.json --outDir dist

# Production stage
FROM base AS production

RUN addgroup --system --gid 1001 aiservice && \
    adduser --system --uid 1001 aiservice

# Copy built application
COPY --from=build --chown=aiservice:aiservice /app/dist ./dist
COPY --from=build --chown=aiservice:aiservice /app/node_modules ./node_modules
COPY --from=build --chown=aiservice:aiservice /app/ai ./ai

USER aiservice

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

CMD ["node", "dist/lib/ai/services/server.js"]
