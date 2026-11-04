import { astro, FetchState } from 'astro/fetch'

export default {
  async fetch(request: Request) {
    const state = new FetchState(request)

    // All /api/* endpoints are served by Astro API routes below, which go
    // through src/middleware.ts (the HIPAA Auth interceptor). The former
    // interceptor here proxied /api/ai, /api/v1/bias, /api/memory, and
    // /api/evaluation to a hardcoded local FastAPI at 127.0.0.1:8000. That
    // only worked in local dev; on Cloudflare Workers it pointed at the
    // Worker itself and broke production (Sentry PIXEL-ASTRO-Y).
    return astro(state)
  },
}
