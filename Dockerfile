# Single, clean multi-stage Dockerfile for building and running Pixelated

# Builder stage: install deps and run the static build
ARG PNPM_VERSION=10.23.0
FROM node:24-slim AS builder
ARG PNPM_VERSION
WORKDIR /app

# Install build-time tools and enable pnpm
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    python3 \
    make \
    g++ \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@$PNPM_VERSION && pnpm --version

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
FROM node:24-slim AS runtime
WORKDIR /app

# Install pnpm and build tools needed for native dependencies (like better-sqlite3)
ARG PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@$PNPM_VERSION && \
    pnpm --version

# Create non-root user
RUN groupadd -g 1001 astro && useradd -u 1001 -g astro -m astro

# Copy package files and install production dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies and clean up in a single layer
RUN pnpm install --prod --frozen-lockfile && \
    pnpm add class-variance-authority && \
    pnpm store prune && \
    # Remove unnecessary files to reduce layer size
    find node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type d -name "*.test.*" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type d -name "*.spec.*" -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type f -name "*.map" -delete && \
    find node_modules -type f -name "*.ts" ! -path "*/types/*" -delete && \
    find node_modules -name "*.tsx" ! -path "*/types/*" -delete && \
    find node_modules -name "README.md" -delete && \
    find node_modules -name "CHANGELOG*" -delete && \
    find node_modules -name "LICENSE*" -delete && \
    find node_modules -name ".github" -type d -exec rm -rf {} + 2>/dev/null || true && \
    # Remove build tools after native modules are built
    apt-get purge -y python3 make g++ git && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.npm /root/.cache

# Copy built output and public assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/start-server.mjs ./start-server.mjs
COPY --from=builder /app/instrument.mjs ./instrument.mjs

# Set ownership and drop to non-root (separate layer for smaller size)
RUN chown -R astro:astro /app && chmod -R g+rX /app
USER astro

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const http=require('http');const opts={host:'127.0.0.1',port:4321,path:'/',timeout:5000};const req=http.request(opts,res=>{if(res.statusCode>=200&&res.statusCode<500){process.exit(0);}process.exit(1);});req.on('error',()=>process.exit(1));req.end();"

CMD ["node", "start-server.mjs"]
