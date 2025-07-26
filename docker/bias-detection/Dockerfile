# Bias Detection Service - TypeScript + Python
FROM node:22-slim AS node-base

# Install Python and system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    pkg-config \
    curl \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
ARG PNPM_VERSION=10.12.3
RUN npm install -g pnpm@$PNPM_VERSION

WORKDIR /app

# Create Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies for bias detection
COPY src/lib/ai/bias-detection/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install specific ML/AI libraries for bias detection
RUN pip install --no-cache-dir \
    torch \
    transformers \
    scikit-learn \
    pandas \
    numpy \
    matplotlib \
    seaborn \
    fairlearn \
    aif360 \
    lime \
    shap

# Build stage
FROM node-base AS build

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install Node dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY src/lib/ai/bias-detection ./src/lib/ai/bias-detection
COPY src/lib/ai/types ./src/lib/ai/types
COPY src/lib/ai/error-handling.ts ./src/lib/ai/
COPY src/lib/ai/providers.ts ./src/lib/ai/
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm tsc --project tsconfig.json --outDir dist

# Production stage
FROM node-base AS production

RUN addgroup --system --gid 1001 biasdetection && \
    adduser --system --uid 1001 biasdetection

# Copy built application
COPY --from=build --chown=biasdetection:biasdetection /app/dist ./dist
COPY --from=build --chown=biasdetection:biasdetection /app/node_modules ./node_modules
COPY --from=build --chown=biasdetection:biasdetection /app/python ./python

# Create cache directory
RUN mkdir -p /app/cache && chown biasdetection:biasdetection /app/cache

USER biasdetection

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["node", "dist/lib/ai/bias-detection/server.js"]
