/**
 * FHIR R4 server — main entry point.
 *
 * Parses incoming HTTP requests into FHIRRequest objects and delegates
 * to the router for dispatch.
 *
 * @see https://hl7.org/fhir/R4/http.html
 */

import type { FHIRRequest, FHIRRequestContext, FHIRResourceType, FHIRResponse } from './types.js';
import { isSupportedResourceType } from './validation.js';
import { routeFHIRRequest } from './router.js';
import { badRequest, unauthorized } from './error.js';

/**
 * Extract FHIR request context from HTTP headers.
 *
 * Expects headers:
 * - X-Tenant-Id: UUID of the tenant
 * - X-User-Id: UUID of the authenticated user
 * - X-User-Role: ClinicalRole string
 * - Authorization: Bearer JWT (optional — JWT claims used for RLS)
 * - X-Break-Glass: 'true' if break-glass access is activated
 */
function extractContext(headers: Headers): FHIRRequestContext | null {
  const tenantId = headers.get('X-Tenant-Id');
  const userId = headers.get('X-User-Id');

  if (tenantId === null || userId === null) {
    return null;
  }

  const role = headers.get('X-User-Role') ?? 'systemAdmin';
  const breakGlass = headers.get('X-Break-Glass') === 'true';

  // Parse JWT claims from Authorization header (if present)
  let jwtClaims: Record<string, unknown> = { role, sub: userId, break_glass: breakGlass };
  const authHeader = headers.get('Authorization');
  if (authHeader !== null && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      // Decode JWT payload (no verification — that's done by middleware)
      const payload = token.split('.')[1];
      if (payload !== undefined) {
        const decoded = JSON.parse(
          Buffer.from(payload, 'base64').toString('utf-8'),
        ) as Record<string, unknown>;
        jwtClaims = { ...decoded, role, sub: userId, break_glass: breakGlass };
      }
    } catch {
      // Invalid JWT — use default claims
    }
  }

  return { tenantId, userId, role, breakGlass: breakGlass, jwtClaims };
}

/**
 * Parse the FHIR R4 path segments from a URL.
 *
 * Path patterns:
 * - /metadata → CapabilityStatement
 * - /{ResourceType} → search or create
 * - /{ResourceType}/{id} → read, update, delete
 * - /{ResourceType}/{id}/_history → version history
 */
function parsePath(
  path: string,
): {
  isMetadata: boolean;
  resourceType: string | null;
  resourceId: string | null;
  isHistory: boolean;
} {
  // Remove leading/trailing slashes
  const normalized = path.replace(/^\/+|\/+$/g, '');

  // Handle metadata
  if (normalized === 'metadata' || normalized === '$metadata') {
    return { isMetadata: true, resourceType: null, resourceId: null, isHistory: false };
  }

  const segments = normalized.split('/');

  // /{ResourceType}
  if (segments.length === 1) {
    return {
      isMetadata: false,
      resourceType: segments[0],
      resourceId: null,
      isHistory: false,
    };
  }

  // /{ResourceType}/{id}
  if (segments.length === 2) {
    return {
      isMetadata: false,
      resourceType: segments[0],
      resourceId: segments[1],
      isHistory: false,
    };
  }

  // /{ResourceType}/{id}/_history
  if (segments.length === 3 && segments[2] === '_history') {
    return {
      isMetadata: false,
      resourceType: segments[0],
      resourceId: segments[1],
      isHistory: true,
    };
  }

  // Unknown path pattern
  return {
    isMetadata: false,
    resourceType: segments[0] ?? null,
    resourceId: segments[1] ?? null,
    isHistory: false,
  };
}

/**
 * Main FHIR R4 server handler.
 *
 * @param method - HTTP method
 * @param path - Path after /fhir/r4/ prefix (e.g. "Patient", "Patient/123", "metadata")
 * @param searchParams - URL search parameters
 * @param headers - HTTP headers
 * @param body - Request body (parsed JSON or null)
 * @param baseUrl - Base URL for the FHIR server
 * @returns FHIRResponse
 */
export async function handleFHIRRequest(
  method: string,
  path: string,
  searchParams: URLSearchParams,
  headers: Headers,
  body: unknown,
  baseUrl: string,
): Promise<FHIRResponse> {
  // 1. Extract request context from headers
  const context = extractContext(headers);
  if (context === null) {
    return unauthorized('Missing X-Tenant-Id or X-User-Id headers');
  }

  // 2. Parse path
  const parsed = parsePath(path);

  // 3. Validate resource type (if not metadata)
  let resourceType: FHIRResourceType | null = null;
  if (!parsed.isMetadata && parsed.resourceType !== null) {
    if (!isSupportedResourceType(parsed.resourceType)) {
      return badRequest(`Unknown resource type: ${parsed.resourceType}`);
    }
    resourceType = parsed.resourceType;
  }

  // 4. Extract If-Match header
  const ifMatch = headers.get('If-Match');

  // 5. Build FHIRRequest
  const fhirRequest: FHIRRequest = {
    method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE',
    resourceType,
    resourceId: parsed.resourceId,
    isHistory: parsed.isHistory,
    isMetadata: parsed.isMetadata,
    searchParams,
    body,
    ifMatch,
    context,
  };

  // 6. Route and handle
  return routeFHIRRequest(fhirRequest, baseUrl);
}
