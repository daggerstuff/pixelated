# Single, clean multi-stage Dockerfile for building and running Pixelated

# Builder stage: install deps and run the static build
FROM node:24-alpine AS builder
WORKDIR /app

# Install build-time tools and enable pnpm
RUN apk add --no-cache bash git python3 make g++ && \
    corepack enable pnpm

# Copy package manifests first for better layer caching
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (dev + prod) required for build
RUN pnpm install --frozen-lockfile

# Copy source and run the build
COPY . .
RUN pnpm build

# Runtime stage: minimal image with only production bits
FROM node:24-alpine AS runtime
WORKDIR /app

# Install pnpm before creating user (install as root, then switch to non-root)
ARG PNPM_VERSION=10.20.0
RUN npm install -g pnpm@$PNPM_VERSION && \
    pnpm --version

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Copy package files and install production dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile && \
    pnpm add class-variance-authority && \
    pnpm store prune

# Copy built output and public assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/start-server.mjs ./start-server.mjs
COPY --from=builder /app/instrument.mjs ./instrument.mjs

# Set ownership and drop to non-root
RUN chown -R nextjs:nodejs /app && chmod -R g+rX /app
USER nextjs

EXPOSE 4321
CMD ["node", "start-server.mjs"]
