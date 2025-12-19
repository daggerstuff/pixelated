# Single, clean multi-stage Dockerfile for building and running Pixelated

# Builder stage: install deps and run the static build
ARG PNPM_VERSION=10.26.0
FROM node:24.12.0-trixie-slim@sha256:9ad7e7db423b2ca7ddcc01568da872701ef6171505bd823978736247885c7eb4 AS builder
ARG PNPM_VERSION=10.26.0
WORKDIR /app

# Install build-time tools and enable pnpm
# Update all packages first to patch known vulnerabilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    python3 \
    make \
    g++ \
    curl \
    && corepack enable \
    && ( \
    PNPM_SUCCESS=0; \
    for i in 1 2 3 4 5; do \
    echo "Attempt $i: Preparing pnpm@$PNPM_VERSION..." && \
    if corepack prepare pnpm@$PNPM_VERSION --activate && pnpm --version; then \
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
    ) \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (dev + prod) required for build
RUN pnpm install --frozen-lockfile

# Copy source and run the build
COPY . .
RUN pnpm build

# Cleanup build artifacts to reduce layer size
RUN find /app/node_modules -type f -name "*.map" -delete && \
    find /app/dist -type f -name "*.map" -delete 2>/dev/null || true

# Runtime stage: minimal image with only production bits
FROM node:24.12.0-trixie-slim@sha256:9ad7e7db423b2ca7ddcc01568da872701ef6171505bd823978736247885c7eb4 AS runtime
WORKDIR /app

# Install pnpm and build tools needed for native dependencies (like better-sqlite3)
# Update all packages first to patch known vulnerabilities
ARG PNPM_VERSION=10.26.0
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    curl \
    && corepack enable \
    && ( \
    PNPM_SUCCESS=0; \
    for i in 1 2 3 4 5; do \
    echo "Attempt $i: Preparing pnpm@$PNPM_VERSION..." && \
    if corepack prepare pnpm@$PNPM_VERSION --activate && pnpm --version; then \
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
    ) \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 astro && useradd -u 1001 -g astro -m astro

# Copy package files and install production dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies and clean up in a single layer
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    # Remove unnecessary files to reduce layer size
    find node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type d -name "*.test.*" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type d -name "*.spec.*" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type f -name "*.map" -delete && \
    find node_modules -type f -name "*.ts" ! -path "*/types/*" -delete && \
    find node_modules -type f -name "*.tsx" ! -path "*/types/*" -delete && \
    find node_modules -name "README.md" -delete && \
    find node_modules -name "CHANGELOG*" -delete && \
    find node_modules -name "LICENSE*" -delete && \
    find node_modules -name ".github" -type d -exec rm -rf {} + 2>/dev/null || true && \
    # Remove build tools after native modules are built
    apt-get purge -y --auto-remove python3 make g++ git && \
    rm -rf /tmp/* /root/.npm /root/.cache

# Copy built output and public assets from builder
COPY --from=builder --chown=astro:astro /app/dist ./dist
COPY --from=builder --chown=astro:astro /app/public ./public
COPY --from=builder --chown=astro:astro /app/templates ./templates
COPY --from=builder --chown=astro:astro /app/start-server.mjs ./start-server.mjs
COPY --from=builder --chown=astro:astro /app/instrument.mjs ./instrument.mjs
USER astro

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const http=require('http');const opts={host:'127.0.0.1',port:4321,path:'/',timeout:5000};const req=http.request(opts,res=>{if(res.statusCode>=200&&res.statusCode<500){process.exit(0);}process.exit(1);});req.on('error',()=>process.exit(1));req.end();"

CMD ["node", "start-server.mjs"]
