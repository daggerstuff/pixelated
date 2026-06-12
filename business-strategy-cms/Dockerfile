FROM node:24.16.0-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
COPY scripts/devops/pnpm-install-with-fallback.sh /tmp/pnpm-install-with-fallback.sh
RUN chmod +x /tmp/pnpm-install-with-fallback.sh && \
    /tmp/pnpm-install-with-fallback.sh && \
    rm /tmp/pnpm-install-with-fallback.sh

# Copy source code
COPY . .

# Build the application
RUN pnpm build

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app --shell /bin/bash app && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["pnpm", "start"]