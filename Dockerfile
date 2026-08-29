# Single, clean multi-stage Dockerfile for building and running Pixelated

FROM node:24-bookworm-slim AS base

# Apply OS-level security updates to patch known vulnerabilities
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Builder stage: install deps and run the static build
FROM base AS builder
ENV NODE_ENV=production
ARG PNPM_VERSION=11.12.0
WORKDIR /app

# Install build-time tools and enable pnpm
# Upgrade existing packages, then install required ones
RUN apt-get update && apt-get upgrade -y --no-install-recommends && apt-get install -y --no-install-recommends \
    bash \
    git \
    python3 \
    make \
    g++ \
    curl \
    libvips-dev \
    && PNPM_SUCCESS=0; \
    for i in 1 2 3 4 5; do \
    echo "Attempt $i: Installing pnpm@$PNPM_VERSION..." && \
    if npm install -g pnpm@$PNPM_VERSION && pnpm --version; then \
    echo "✅ pnpm@$PNPM_VERSION installed successfully" && \
    PNPM_SUCCESS=1 && \
    break; \
    else \
    echo "❌ Attempt $i failed, waiting before retry..." && \
    sleep $((i * 2)); \
    fi; \
    done; \
    if [ "$PNPM_SUCCESS" -ne 1 ]; then \
    echo "❌ Failed to install pnpm after 5 attempts" && \
    exit 1; \
    fi \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./
COPY pnpm-workspace.yaml ./
# Include patch files and npm configuration required during installation
COPY patches ./patches
COPY config/package/.npmrc ./.npmrc
# Copy workspace member package.jsons so pnpm can resolve the workspace
COPY packages/pixelated-sdk/package.json ./packages/pixelated-sdk/package.json
COPY packages/memory-schema/package.json ./packages/memory-schema/package.json
COPY apps/business-strategy-cms/package.json ./apps/business-strategy-cms/package.json

# Install all dependencies (dev + prod) required for build
# Retry with --no-frozen-lockfile if --frozen-lockfile fails (lockfile drift in CI)
RUN pnpm install --frozen-lockfile --ignore-scripts || \
    pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source and run the build
COPY . .

# Ensure templates directory exists so it can be safely copied in the runtime phase
RUN mkdir -p /app/templates

# Copy required server and instrumentation files into builder context
COPY scripts/utils/start-server.mjs /app/start-server.mjs
COPY scripts/utils/start-server-config.mjs /app/start-server-config.mjs
COPY config/instrument.mjs /app/instrument.mjs
COPY config/sentry-event-filter.mjs /app/sentry-event-filter.mjs

# Limit Node.js memory usage to prevent OOM on small VPS
# Increased to 10GB for Docker builds (will be enforced by host)
ENV NODE_OPTIONS="--max-old-space-size=10240"
ENV DOCKER_BUILD="true"
RUN pnpm build

# Cleanup build artifacts to reduce layer size
RUN find /app/node_modules -type f -name "*.map" -delete && \
    find /app/dist -type f -name "*.map" -delete 2>/dev/null || true

# Runtime stage: minimal image with only production bits
FROM base AS runtime
WORKDIR /app

# Install only curl (needed for healthcheck)
RUN apt-get update && apt-get upgrade -y --no-install-recommends && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Copy all dependencies from builder (includes workspace packages)
COPY --from=builder /app/node_modules ./node_modules

# Copy built output and public assets from builder.
# Astro config uses publicDir './apps/web/public' (repo restructure 2026-08-26),
# so public assets live at /app/apps/web/public in the builder stage.
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/apps/web/public ./public
COPY --from=builder --chown=node:node /app/templates ./templates
COPY --from=builder --chown=node:node /app/start-server.mjs ./start-server.mjs
COPY --from=builder --chown=node:node /app/start-server-config.mjs ./start-server-config.mjs
COPY --from=builder --chown=node:node /app/instrument.mjs ./instrument.mjs
COPY --from=builder --chown=node:node /app/sentry-event-filter.mjs ./sentry-event-filter.mjs
USER node

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const http=require('http');const opts={host:'127.0.0.1',port:4321,path:'/health',timeout:5000};const req=http.request(opts,res=>{if(res.statusCode>=200&&res.statusCode<500){process.exit(0);}process.exit(1);});req.on('error',()=>process.exit(1));req.end();"

CMD ["node", "start-server.mjs"]
