/**
 * FHIR R4 router — resource type routing and dispatch.
 *
 * Routes incoming FHIRRequest to the appropriate CRUD, search, or history handler.
 */

import { capabilityStatementResponse } from './capability-statement.js'
import {
  createResource,
  readResource,
  updateResource,
  deleteResource,
} from './crud.js'
import { badRequest, notFound, notImplemented } from './error.js'
import { getResourceHistory } from './history.js'
import { searchResources } from './search.js'
import type { FHIRRequest, FHIRResourceType, FHIRResponse } from './types.js'
import { isSupportedResourceType } from './validation.js'

/**
 * Handle a FHIR R4 request by routing to the appropriate handler.
 *
 * @param request - Parsed FHIR request
 * @param baseUrl - Base URL for the FHIR server (e.g. https://example.com/fhir/r4)
 * @returns FHIRResponse
 */
export async function routeFHIRRequest(
  request: FHIRRequest,
  baseUrl: string,
): Promise<FHIRResponse> {
  // Handle metadata (CapabilityStatement)
  if (request.isMetadata) {
    return capabilityStatementResponse(baseUrl)
  }

  // Validate resource type
  if (
    request.resourceType === null ||
    !isSupportedResourceType(request.resourceType)
  ) {
    return badRequest(
      `Unknown resource type: ${request.resourceType ?? 'none'}`,
    )
  }

  const resourceType = request.resourceType

  // Handle history endpoint: GET /{ResourceType}/{id}/_history
  if (request.isHistory) {
    if (request.method !== 'GET') {
      return badRequest('Only GET is supported for history endpoints')
    }
    if (request.resourceId === null) {
      return badRequest('Resource ID is required for history')
    }
    return getResourceHistory(
      resourceType,
      request.resourceId,
      request.context,
      baseUrl,
    )
  }

  // Route by HTTP method
  switch (request.method) {
    case 'GET': {
      // GET /{ResourceType}/{id} — read
      // GET /{ResourceType}?search — search
      if (request.resourceId !== null) {
        return readResource(resourceType, request.resourceId, request.context)
      }
      return searchResources(
        resourceType,
        request.searchParams,
        request.context,
        baseUrl,
      )
    }

    case 'POST': {
      // POST /{ResourceType} — create
      if (request.resourceId !== null) {
        return badRequest('POST to a specific resource ID is not supported')
      }
      return createResource(
        resourceType,
        request.body,
        request.context,
        baseUrl,
      )
    }

    case 'PUT': {
      // PUT /{ResourceType}/{id} — update
      if (request.resourceId === null) {
        return badRequest('PUT requires a resource ID')
      }
      return updateResource(
        resourceType,
        request.resourceId,
        request.body,
        request.context,
        request.ifMatch,
      )
    }

    case 'DELETE': {
      // DELETE /{ResourceType}/{id} — soft delete
      if (request.resourceId === null) {
        return badRequest('DELETE requires a resource ID')
      }
      return deleteResource(resourceType, request.resourceId, request.context)
    }

    default: {
      return notImplemented(`HTTP method ${request.method} is not supported`)
    }
  }
}
