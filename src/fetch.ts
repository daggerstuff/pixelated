import { astro, FetchState } from 'astro/fetch'

export default {
  async fetch(request: Request) {
    const state = new FetchState(request)
    const url = state.url

    // API Gateway Interceptor
    // Forward AI and Python backend requests directly to FastAPI
    if (
      url.pathname.startsWith('/api/ai') ||
      url.pathname.startsWith('/api/v1/bias') ||
      url.pathname.startsWith('/api/memory') ||
      url.pathname.startsWith('/api/evaluation')
    ) {
      // Forward to FastAPI microservice (Phase 4 extraction)
      const backendUrl = new URL(
        url.pathname + url.search,
        'http://127.0.0.1:8000',
      )
      return fetch(new Request(backendUrl, request))
    }

    // Fallback to standard Astro pipeline
    // This includes src/middleware.ts which acts as our HIPAA Auth interceptor
    return astro(state)
  },
}
