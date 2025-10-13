# Build stage - optimized for security and performance
FROM node:24-alpine AS builder

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user for build
RUN addgroup -g 1001 -S nodejs && \
    adduser -S pixelated -u 1001 -G nodejs

# Enable pnpm
RUN corepack enable pnpm

# Set working directory
WORKDIR /app

# Copy package files with proper ownership
COPY --chown=pixelated:nodejs package.json pnpm-lock.yaml ./

# Switch to non-root user for dependency installation
USER pixelated

# Install dependencies with optimized caching
RUN --mount=type=cache,target=/home/pixelated/.local/share/pnpm/store,uid=1001,gid=1001 \
    pnpm config set store-dir /home/pixelated/.local/share/pnpm/store && \
    pnpm install --frozen-lockfile --prefer-offline

# Copy source files
COPY --chown=pixelated:nodejs . .

# Build the application with resource limits
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=SENTRY_DSN \
    --mount=type=secret,id=PUBLIC_SENTRY_DSN \
    export SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN 2>/dev/null || echo "") && \
    export SENTRY_DSN=$(cat /run/secrets/SENTRY_DSN 2>/dev/null || echo "") && \
    export PUBLIC_SENTRY_DSN=$(cat /run/secrets/PUBLIC_SENTRY_DSN 2>/dev/null || echo "") && \
    NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# Runtime stage - minimal and secure
FROM node:24-alpine AS runtime

# Install security updates and dumb-init
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S pixelated -u 1001 -G nodejs

# Enable pnpm
RUN corepack enable pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=pixelated:nodejs package.json pnpm-lock.yaml ./

# Switch to non-root user
USER pixelated

# Install production dependencies only with caching
RUN --mount=type=cache,target=/home/pixelated/.local/share/pnpm/store,uid=1001,gid=1001 \
    pnpm config set store-dir /home/pixelated/.local/share/pnpm/store && \
    pnpm install --prod --frozen-lockfile --prefer-offline

# Copy built application from builder
COPY --from=builder --chown=pixelated:nodejs /app/dist ./dist

# Create necessary directories with proper permissions
RUN mkdir -p /tmp/pixelated && \
    chown pixelated:nodejs /tmp/pixelated

# Security and performance settings
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV ASTRO_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4321/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Expose port
EXPOSE 4321

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["pnpm", "start"]