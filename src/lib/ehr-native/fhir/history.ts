/**
 * FHIR R4 version history retrieval.
 *
 * Returns a Bundle of type 'history' containing all versions of a resource.
 *
 * @see https://hl7.org/fhir/R4/http.html#history
 */

import { internalServerError, notFound } from './error.js'
import {
  getDedicatedResourceHistory,
  getGenericResourceHistory,
} from './repositories/index.js'
import type {
  FHIRRequestContext,
  FHIRResourceType,
  FHIRBundle,
  FHIRResponse,
} from './types.js'
import { RESOURCE_REGISTRY } from './validation.js'

/**
 * Build a FHIR history Bundle from repository results.
 */
function buildHistoryBundle(
  resourceType: FHIRResourceType,
  resourceId: string,
  baseUrl: string,
  history: Array<{
    resource: Record<string, unknown>
    timestamp: string
    action: string
  }>,
): FHIRBundle {
  const entries = history.map((entry) => ({
    fullUrl: `${baseUrl}/${resourceType}/${resourceId}`,
    resource: entry.resource,
    request: {
      method:
        entry.action === 'create'
          ? 'POST'
          : entry.action === 'delete'
            ? 'DELETE'
            : 'PUT',
      url: `${resourceType}/${resourceId}`,
    },
    response: {
      status:
        entry.action === 'create'
          ? '201'
          : entry.action === 'delete'
            ? '204'
            : '200',
      lastModified: entry.timestamp,
    },
  }))

  return {
    resourceType: 'Bundle',
    type: 'history',
    total: entries.length,
    entry: entries,
    link: [
      {
        relation: 'self',
        url: `${baseUrl}/${resourceType}/${resourceId}/_history`,
      },
    ],
  }
}

/**
 * Retrieve the version history of a FHIR resource.
 *
 * Delegates to the appropriate repository based on resource type.
 */
export async function getResourceHistory(
  resourceType: FHIRResourceType,
  resourceId: string,
  context: FHIRRequestContext,
  baseUrl: string,
): Promise<FHIRResponse> {
  try {
    const registry = RESOURCE_REGISTRY[resourceType]
    let history: Array<{
      resource: Record<string, unknown>
      timestamp: string
      action: string
    }>

    if (registry.isGeneric) {
      history = await getGenericResourceHistory(
        context,
        resourceType,
        resourceId,
      )
    } else {
      history = await getDedicatedResourceHistory(
        context,
        resourceType,
        resourceId,
      )
    }

    if (history.length === 0) {
      return notFound(resourceType, resourceId)
    }

    const bundle = buildHistoryBundle(
      resourceType,
      resourceId,
      baseUrl,
      history,
    )

    return {
      status: 200,
      headers: { 'Content-Type': 'application/fhir+json' },
      body: bundle,
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'History retrieval failed'
    return internalServerError(message)
  }
}
