/**
 * FHIR R4 API catch-all route.
 *
 * Handles all requests to /api/fhir/r4/* by delegating to the FHIR R4 server.
 *
 * Path patterns:
 * - GET    /api/fhir/r4/metadata → CapabilityStatement
 * - GET    /api/fhir/r4/{ResourceType} → search
 * - POST   /api/fhir/r4/{ResourceType} → create
 * - GET    /api/fhir/r4/{ResourceType}/{id} → read
 * - PUT    /api/fhir/r4/{ResourceType}/{id} → update
 * - DELETE /api/fhir/r4/{ResourceType}/{id} → soft delete
 * - GET    /api/fhir/r4/{ResourceType}/{id}/_history → version history
 */

import type { APIRoute } from 'astro'

export const prerender = false

const ALL_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const

/**
 * Convert a FHIRResponse to a standard Response.
 */
function toResponse(fhirResponse: {
  status: number
  headers: Record<string, string>
  body: unknown
}): Response {
  const { status, headers, body } = fhirResponse

  // 204 No Content has no body
  if (status === 204) {
    return new Response(null, { status, headers })
  }

  return new Response(JSON.stringify(body), { status, headers })
}

/**
 * Combined handler for all HTTP methods.
 */
const handler: APIRoute = async ({ request, url, params }) => {
  // Extract the catch-all path parameter
  const pathParam = params['path']

  if (pathParam === undefined || pathParam === null) {
    return toResponse({
      status: 404,
      headers: { 'Content-Type': 'application/fhir+json' },
      body: {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-found',
            diagnostics: 'No path provided',
          },
        ],
      },
    })
  }

  // Build the base URL for the FHIR server
  const baseUrl = `${url.origin}/api/fhir/r4`

  // Parse body for POST/PUT
  let body: unknown = null
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      body = await request.json()
    } catch {
      return toResponse({
        status: 400,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'invalid',
              diagnostics: 'Invalid JSON body',
            },
          ],
        },
      })
    }
  }

  // Build headers object (only pass through needed headers)
  const headers = new Headers()
  const passThroughHeaders = [
    'x-tenant-id',
    'x-user-id',
    'x-user-role',
    'x-break-glass',
    'authorization',
    'if-match',
    'content-type',
    'accept',
  ]
  for (const h of passThroughHeaders) {
    const value = request.headers.get(h)
    if (value !== null) {
      headers.set(h, value)
    }
  }

  // Delegate to FHIR R4 server
  const { handleFHIRRequest } = await import('@/lib/ehr-native/fhir/server.js')

  const fhirResponse = await handleFHIRRequest(
    request.method,
    pathParam,
    url.searchParams,
    headers,
    body,
    baseUrl,
  )

  return toResponse(fhirResponse)
}

// Export handlers for each method (Astro requires individual exports)
export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
