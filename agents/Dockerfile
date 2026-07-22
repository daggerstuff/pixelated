FROM node:24.16.0-bookworm-slim AS builder

ARG AGENT_DIR
ARG PNPM_VERSION=11.12.0

ENV CI=true

WORKDIR /agent

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && npm install -g pnpm@${PNPM_VERSION} \
    && rm -rf /var/lib/apt/lists/*

COPY ${AGENT_DIR}/package.json ${AGENT_DIR}/pnpm-lock.yaml ${AGENT_DIR}/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

COPY ${AGENT_DIR}/ ./
# Copy src/lib/context into the image at the absolute path `/lib/context`
# so that `../../lib/context/...` imports in agents/<name>/agent/agent.ts
# resolve correctly. Relative to /agent/agent/agent.ts:
#   ../  -> /agent/
#   ../../  -> /      (container root)
#   ../../lib/context  -> /lib/context
# The earlier `COPY src/lib/context ./lib/context` landed at /agent/lib/context,
# which is one level too deep and caused `module not found` at eve build time.
# Local-dev time still uses the stub at agents/lib/context/startup-profiler.ts
# (relative-path resolution from agents/<name>/agent/ goes up two levels).
COPY src/lib/context /lib/context
# Also COPY src/lib to /src/lib for tsconfig "@/lib/*" path aliases which
# resolve to ../../src/lib/* from /agent/ → /src/lib/* at runtime.
# Without this, eve's authored-modules (which use @/lib/utils for Tailwind
# class merging) fail with "Cannot find package '@/lib'" during pnpm build.
COPY src/lib /src/lib
RUN pnpm build

FROM node:24.16.0-bookworm-slim AS runtime

WORKDIR /agent

RUN groupadd -g 1001 agent \
    && useradd -u 1001 -g agent -m agent

COPY --from=builder --chown=agent:agent /agent/.output ./.output

USER agent

ENV HOST=0.0.0.0
ENV PORT=2000
ENV NODE_ENV=production

EXPOSE 2000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const http=require('http');const req=http.request({host:'127.0.0.1',port:process.env.PORT||2000,path:'/eve/v1/health',timeout:5000},res=>process.exit(res.statusCode>=200&&res.statusCode<500?0:1));req.on('error',()=>process.exit(1));req.end();"

CMD ["node", ".output/server/index.mjs"]
