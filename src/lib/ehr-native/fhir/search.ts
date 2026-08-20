/**
 * FHIR R4 search parameter parsing and query building.
 *
 * Parses FHIR R4 search parameters from URL query strings and delegates
 * to the appropriate repository search functions.
 *
 * @see https://hl7.org/fhir/R4/search.html
 */

import type {
  FHIRRequestContext,
  FHIRResourceType,
  FHIRBundle,
  FHIRResponse,
} from './types.js'
import { RESOURCE_REGISTRY } from './validation.js'
import {
  searchDedicatedResources,
  searchGenericResources,
} from './repositories/index.js'
import { internalServerError } from './error.js'

/**
 * Parse pagination parameters from search params.
 *
 * @returns Normalized count and offset values.
 */
function parsePagination(searchParams: URLSearchParams): {
  count: number
  offset: number
} {
  const countParam = searchParams.get('_count')
  let count = 20
  if (countParam !== null) {
    const parsed = Number.parseInt(countParam, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      count = Math.min(parsed, 100)
    }
  }

  const offsetParam = searchParams.get('_offset')
  let offset = 0
  if (offsetParam !== null) {
    const parsed = Number.parseInt(offsetParam, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      offset = parsed
    }
  }

  return { count, offset }
}

/**
 * Build a FHIR Bundle response from search results.
 */
function buildSearchBundle(
  resourceType: FHIRResourceType,
  baseUrl: string,
  resources: Record<string, unknown>[],
  total: number,
  count: number,
  offset: number,
): FHIRBundle {
  const entries = resources.map((resource) => {
    const id = (resource['id'] as string | undefined) ?? ''
    return {
      fullUrl: `${baseUrl}/${resourceType}/${id}`,
      resource,
    }
  })

  const links: FHIRBundle['link'] = []

  // Self link
  links.push({
    relation: 'self',
    url: `${baseUrl}/${resourceType}?_count=${count}&_offset=${offset}`,
  })

  // Next link (if there are more results)
  if (offset + count < total) {
    links.push({
      relation: 'next',
      url: `${baseUrl}/${resourceType}?_count=${count}&_offset=${offset + count}`,
    })
  }

  // Previous link (if not at the start)
  if (offset > 0) {
    const prevOffset = Math.max(0, offset - count)
    links.push({
      relation: 'previous',
      url: `${baseUrl}/${resourceType}?_count=${count}&_offset=${prevOffset}`,
    })
  }

  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total,
    link: links,
    entry: entries,
  }
}

/**
 * Execute a FHIR R4 search for a resource type.
 *
 * Delegates to the appropriate repository based on whether the resource
 * type has a dedicated table or uses the generic ehr_resource table.
 */
export async function searchResources(
  resourceType: FHIRResourceType,
  searchParams: URLSearchParams,
  context: FHIRRequestContext,
  baseUrl: string,
): Promise<FHIRResponse> {
  try {
    const { count, offset } = parsePagination(searchParams)
    // Inject parsed pagination back into searchParams for repo functions
    searchParams.set('_count', String(count))
    searchParams.set('_offset', String(offset))

    const registry = RESOURCE_REGISTRY[resourceType]
    let result: { resources: Record<string, unknown>[]; total: number }

    if (registry.isGeneric) {
      result = await searchGenericResources(context, resourceType, searchParams)
    } else {
      result = await searchDedicatedResources(
        context,
        resourceType,
        searchParams,
      )
    }

    const bundle = buildSearchBundle(
      resourceType,
      baseUrl,
      result.resources,
      result.total,
      count,
      offset,
    )

    return {
      status: 200,
      headers: { 'Content-Type': 'application/fhir+json' },
      body: bundle,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return internalServerError(message)
  }
}
