# Bias Detection Service - TypeScript + Python
FROM node:24-slim AS node-base

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

ARG PNPM_VERSION=10.17.1
RUN npm install -g pnpm@$PNPM_VERSION

WORKDIR /app

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY src/lib/ai/bias-detection/requirements.txt ./requirements.txt
RUN python3 -m pip install --no-cache-dir uv || true
RUN if command -v uv >/dev/null 2>&1; then \
            uv pip install --no-cache-dir -r requirements.txt; \
        else \
            pip install --no-cache-dir -r requirements.txt; \
        fi

RUN if command -v uv >/dev/null 2>&1; then \
            uv pip install --no-cache-dir \
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
                shap; \
        else \
            pip install --no-cache-dir \
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
                shap; \
        fi

FROM node-base AS build

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --no-frozen-lockfile

COPY src/lib/ai/bias-detection ./src/lib/ai/bias-detection
COPY src/lib/ai/types ./src/lib/ai/types
COPY src/lib/ai/error-handling.ts ./src/lib/ai/
COPY src/lib/ai/providers.ts ./src/lib/ai/
COPY tsconfig.json ./

RUN pnpm tsc --project tsconfig.json --outDir dist

FROM node-base AS production

RUN groupadd -g 1001 biasdetection || true && \
    useradd -u 1001 -g 1001 -s /bin/sh -M -N -r biasdetection || true

COPY --from=build --chown=biasdetection:biasdetection /app/dist ./dist
COPY --from=build --chown=biasdetection:biasdetection /app/node_modules ./node_modules
COPY --from=build --chown=biasdetection:biasdetection /app/src/lib/ai/bias-detection/python ./python
RUN mkdir -p /app/cache && chown biasdetection:biasdetection /app/cache

USER biasdetection

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["node", "dist/lib/ai/bias-detection/server.js"]
