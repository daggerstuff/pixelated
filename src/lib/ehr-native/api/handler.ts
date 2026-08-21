/**
 * EHR REST API v1 — Request handler factory.
 *
 * Creates Astro-compatible APIRoute handlers that enforce RBAC, delegate
 * to the FHIR R4 CRUD layer, and emit audit events on every request.
 */

import { checkPermission, logEHRAccess } from '../auth/ehr-rbac.js'
import type { ClinicalRole } from '../auth/types.js'
import { routeFHIRRequest } from '../fhir/router.js'
import type {
  FHIRRequest,
  FHIRRequestContext,
  FHIRResourceType,
  FHIRResponse,
} from '../fhir/types.js'
import { ENDPOINT_GROUPS } from './endpoints.js'
import type { APIRequestContext, APIResponse, EndpointDefinition } from './types.js'

const VALID_ROLES: readonly ClinicalRole[] = [
  'physician',
  'nurse',
  'pharmacist',
  'medicalAssistant',
  'technician',
  'therapist',
  'socialWorker',
  'careCoordinator',
  'frontDesk',
  'billingSpecialist',
  'complianceOfficer',
  'healthInformationManager',
  'systemAdmin',
] as const

const VALID_GROUPS: readonly string[] = [
  'patients',
  'encounters',
  'appointments',
  'notes',
  'claims',
  'consents',
  'observations',
] as const

/**
 * Extract APIRequestContext from incoming HTTP request headers.
 *
 * Required headers: x-tenant-id, x-user-id, x-user-role
 * Optional headers: x-break-glass, x-patient-id, x-forwarded-for, user-agent, x-session-id
 *
 * Returns null if required headers are missing or role is invalid.
 */
export function extractAPIRequestContext(
  headers: Headers,
): APIRequestContext | null {
  const tenantId = headers.get('x-tenant-id')
  const userId = headers.get('x-user-id')
  const roleHeader = headers.get('x-user-role')

  if (tenantId === null || userId === null || roleHeader === null) {
    return null
  }

  if (!VALID_ROLES.includes(roleHeader as ClinicalRole)) {
    return null
  }

  const role = roleHeader as ClinicalRole
  const breakGlass = headers.get('x-break-glass') === 'true'
  const patientId = headers.get('x-patient-id') ?? undefined
  const ipAddress = headers.get('x-forwarded-for') ?? undefined
  const userAgent = headers.get('user-agent') ?? undefined
  const sessionId = headers.get('x-session-id') ?? undefined

  return {
    userId,
    role,
    tenantId,
    ...(patientId !== undefined ? { patientId } : {}),
    breakGlass,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  }
}

/**
 * Convert APIRequestContext to FHIRRequestContext.
 */
export function toFHIRRequestContext(
  ctx: APIRequestContext,
): FHIRRequestContext {
  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    role: ctx.role,
    breakGlass: ctx.breakGlass,
    jwtClaims: {
      sub: ctx.userId,
      role: ctx.role,
      break_glass: ctx.breakGlass,
      ...(ctx.patientId !== undefined ? { patientId: ctx.patientId } : {}),
    },
    ...(ctx.ipAddress !== undefined ? { ipAddress: ctx.ipAddress } : {}),
    ...(ctx.userAgent !== undefined ? { userAgent: ctx.userAgent } : {}),
    ...(ctx.sessionId !== undefined ? { sessionId: ctx.sessionId } : {}),
  }
}

/**
 * Build a FHIRRequest from the incoming HTTP request parameters.
 */
export function buildFHIRRequest(
  method: string,
  resourceType: FHIRResourceType,
  resourceId: string | null,
  body: unknown,
  context: FHIRRequestContext,
  searchParams: URLSearchParams,
): FHIRRequest {
  return {
    method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
    resourceType,
    resourceId,
    isHistory: false,
    isMetadata: false,
    searchParams,
    body,
    ifMatch: null,
    context,
  }
}

/**
 * Resolve the endpoint definition for a given group, method, and resource ID.
 *
 * @param group - The endpoint group name (e.g. 'patients')
 * @param method - HTTP method
 * @param hasResourceId - Whether a resource ID is present in the path
 * @returns The matching EndpointDefinition or null
 */
export function resolveEndpoint(
  group: string,
  method: string,
  hasResourceId: boolean,
): EndpointDefinition | null {
  if (!VALID_GROUPS.includes(group)) {
    return null
  }

  const endpoints = ENDPOINT_GROUPS[group as keyof typeof ENDPOINT_GROUPS]
  if (endpoints === undefined) {
    return null
  }

  // search and create → collection-level (no resource ID)
  // read, update, delete → instance-level (has resource ID)
  const isCollectionOperation = (op: string): boolean =>
    op === 'search' || op === 'create'

  return (
    endpoints.find(
      (e) =>
        e.method === method &&
        isCollectionOperation(e.operation) !== hasResourceId,
    ) ?? null
  )
}

/**
 * Convert a FHIRResponse to an APIResponse.
 * Overrides Content-Type to application/json (EHR REST API, not raw FHIR).
 */
function toAPIResponse(fhirResponse: FHIRResponse): APIResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  for (const [key, value] of Object.entries(fhirResponse.headers)) {
    if (key.toLowerCase() !== 'content-type') {
      headers[key] = value
    }
  }

  return {
    status: fhirResponse.status,
    headers,
    body: fhirResponse.body,
  }
}

/**
 * Create a JSON error response.
 */
function errorResponse(
  status: number,
  error: string,
  message: string,
): APIResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: { error, message },
  }
}

/**
 * Process an EHR REST API request end-to-end.
 *
 * 1. Extracts APIRequestContext from headers
 * 2. Checks RBAC permission
 * 3. If denied, returns 403 and logs audit
 * 4. If granted, delegates to FHIR router, logs audit, returns response
 */
export async function processEHRRequest(
  method: string,
  group: string,
  resourceId: string | null,
  body: unknown,
  searchParams: URLSearchParams,
  headers: Headers,
  baseUrl: string,
): Promise<APIResponse> {
  // Step 1: Extract context
  const ctx = extractAPIRequestContext(headers)
  if (ctx === null) {
    return errorResponse(401, 'unauthorized', 'Missing or invalid authentication headers')
  }

  // Step 2: Resolve endpoint definition
  const endpoint = resolveEndpoint(group, method, resourceId !== null)
  if (endpoint === null) {
    return errorResponse(404, 'not_found', `No endpoint found for ${method} /${group}`)
  }

  // Step 3: RBAC permission check
  const permissionResult = await checkPermission(
    ctx.role,
    endpoint.permission,
    ctx.patientId,
  )

  // Step 4: Log audit event (always — both granted and denied)
  await logEHRAccess({
    userId: ctx.userId,
    action: endpoint.operation,
    resource: endpoint.resourceType,
    role: ctx.role,
    permission: endpoint.permission,
    ...(ctx.patientId !== undefined ? { patientId: ctx.patientId } : {}),
    granted: permissionResult.granted,
    reason: permissionResult.reason,
  })

  // Step 5: If denied, return 403
  if (!permissionResult.granted) {
    return errorResponse(403, 'forbidden', permissionResult.reason)
  }

  // Step 6: Build FHIR request and delegate to FHIR router
  const fhirContext = toFHIRRequestContext(ctx)
  const fhirRequest = buildFHIRRequest(
    method,
    endpoint.resourceType,
    resourceId,
    body,
    fhirContext,
    searchParams,
  )

  const fhirResponse = await routeFHIRRequest(fhirRequest, baseUrl)

  // Step 7: Return as API response
  return toAPIResponse(fhirResponse)
}

/**
 * Create an Astro-compatible APIRoute handler for a specific endpoint definition.
 */
export function createEndpointHandler(
  _endpoint: EndpointDefinition,
): (args: {
  request: Request
  url: URL
  params: Record<string, string | undefined>
}) => Promise<Response> {
  return async ({ request, url, params }) => {
    const pathParam = params['path'] ?? ''
    const parts = pathParam.split('/').filter((p) => p.length > 0)

    const group = parts[0] ?? ''
    const resourceId = parts[1] ?? null

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

    if (response.status === 204) {
      return new Response(null, { status: response.status, headers: response.headers })
    }

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: response.headers,
    })
  }
}
