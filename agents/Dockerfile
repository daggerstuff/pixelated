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

COPY ${AGENT_DIR}/package.json ${AGENT_DIR}/pnpm-workspace.yaml ./
RUN pnpm install --no-frozen-lockfile

COPY ${AGENT_DIR}/ ./
 # Shared agent libs are copied to /lib so relative imports such as
 # ../../../lib/channels/eve.js and ../../lib/instrumentation.js resolve to
 # /lib/... exactly as they resolve against agents/lib during local `eve dev`.
 COPY agents/lib/ /lib/
 # Keep the app startup-profiler implementation available for legacy imports
 # that resolve through /lib/context/startup-profiler.js.
 COPY apps/web/src/lib/context/ /lib/context/
 # tsconfig aliases resolve @/lib/* against /src/lib/* for generated eve
 # authored-modules that still use @/lib imports.
 COPY apps/web/src/lib/context/ /src/lib/context/
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
