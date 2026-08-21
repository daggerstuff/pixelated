/**
 * OpenAPI 3.1 JSON endpoint.
 *
 * Serves the generated OpenAPI 3.1 specification at /api/ehr/v1/openapi.json.
 */

import type { APIRoute } from 'astro'
import { OPENAPI_JSON } from '@/lib/ehr-native/api/openapi.js'

export const prerender = false

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(OPENAPI_JSON), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
