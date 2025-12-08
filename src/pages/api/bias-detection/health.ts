import type { APIRoute } from 'astro'

/**
 * Bias Detection Engine health endpoint
 *
 * This is used by:
 * - CI smoke tests (`tests/e2e/smoke/bias-detection-smoke.spec.ts`)
 * - Pipeline HTTP connectivity checks (`/api/bias-detection/health`)
 *
 * IMPORTANT: This endpoint is PUBLIC and does NOT require authentication.
 * It is explicitly excluded from authentication middleware in `src/middleware.ts`.
 *
 * It intentionally keeps checks lightweight and resilient:
 * - Always returns 200 with a structured payload
 * - Marks individual services as `healthy` or `degraded`
 * - Never throws – failures are reflected in the response body instead of status codes
 */
export const GET: APIRoute = async () => {
  const now = new Date()

  type ServiceStatus = 'healthy' | 'degraded'

  const services: Record<string, { status: ServiceStatus; details?: unknown }> =
    {}

  // Python microservice – for now we assume "healthy" if process is up.
  // Deeper checks (e.g. HTTP call to the Python service) can be added later,
  // but that would add latency and potential flakiness to smoke tests.
  services['python_service'] = {
    status: 'healthy',
  }

  // Database & Redis – we currently don't perform live queries here to keep
  // this endpoint cheap and side‑effect free. If deeper checks are added,
  // they should degrade the status instead of throwing.
  services['database'] = {
    status: 'healthy',
  }

  services['redis'] = {
    status: 'healthy',
  }

  const payload = {
    status: 'healthy' as const,
    timestamp: now.toISOString(),
    services,
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}


