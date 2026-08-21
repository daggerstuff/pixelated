/**
 * EHR REST API v1 catch-all route.
 *
 * Handles all requests to /api/ehr/v1/* by:
 * 1. Parsing the catch-all path to determine endpoint group and resource ID
 * 2. Extracting APIRequestContext from headers
 * 3. Looking up the endpoint definition from ENDPOINT_GROUPS
 * 4. Checking RBAC permission via checkPermission()
 * 5. If denied: returning 403 JSON + logging via logEHRAccess()
 * 6. If granted: building FHIRRequest, delegating to routeFHIRRequest(), logging audit, returning response
 *
 * Content-Type is application/json (NOT application/fhir+json — this is the
 * EHR REST API, not raw FHIR).
 *
 * Path patterns:
 * - GET    /api/ehr/v1/{group}          → search
 * - POST   /api/ehr/v1/{group}          → create
 * - GET    /api/ehr/v1/{group}/{id}     → read
 * - PUT    /api/ehr/v1/{group}/{id}     → update
 * - DELETE /api/ehr/v1/{group}/{id}     → delete
 */

import type { APIRoute } from 'astro'
import { processEHRRequest } from '@/lib/ehr-native/api/handler.js'

export const prerender = false

const handler: APIRoute = async ({ request, url, params }) => {
  const pathParam = params['path']

  if (pathParam === undefined || pathParam === null || pathParam === '') {
    return new Response(
      JSON.stringify({ error: 'not_found', message: 'No path provided' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parts = pathParam.split('/').filter((p) => p.length > 0)
  const group = parts[0] ?? ''
  const resourceId = parts.length > 1 ? parts[1] : null

  // Parse body for POST/PUT
  let body: unknown = null
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'invalid_request', message: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  const baseUrl = `${url.origin}/api/fhir/r4`
  const response = await processEHRRequest(
    request.method,
    group,
    resourceId,
    body,
    url.searchParams,
    request.headers,
    baseUrl,
  )

  // 204 No Content has no body
  if (response.status === 204) {
    return new Response(null, { status: response.status, headers: response.headers })
  }

  return new Response(JSON.stringify(response.body), {
    status: response.status,
    headers: response.headers,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
