import type { EHRProvider, FHIRClient, FHIRResource } from '../types'
import { FHIRError } from '../types'
import type { Logger } from '../types'
import { OAuth2Service } from './oauth2.service'

export function createFHIRClient(
  provider: EHRProvider,
  logger: Logger | Console,
): FHIRClient {
  const headers = new Headers({
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json',
  })

  const oauth2Service = new OAuth2Service()

  async function authorizeRequest(): Promise<Headers> {
    const accessToken = await oauth2Service.getAccessToken(provider)
    const authorizedHeaders = new Headers(headers)
    authorizedHeaders.set('Authorization', `Bearer ${accessToken}`)
    return authorizedHeaders
  }

  async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new FHIRError(
        String(error) || `HTTP error ${response.status}`,
        `HTTP_${response.status}`,
        provider.id,
        error.resourceType,
        error.id,
      )
    }
    return response.json()
  }

  // Audit logging must never affect the underlying FHIR operation.
  const auditLog = (action: string, resourceType: string, id?: string) => {
    try {
      if (logger && 'audit' in logger && typeof logger.audit === 'function') {
        const result = logger.audit({
          action,
          resourceType,
          resourceId: id,
          providerId: provider.id,
          timestamp: new Date().toISOString(),
        })
        if (result && typeof result.catch === 'function') {
          result.catch(() => {})
        }
      } else if (logger && typeof logger.info === 'function') {
        logger.info(`AUDIT: ${action} ${resourceType} ${id ?? ''}`.trim(), {
          action,
          resourceType,
          resourceId: id,
          providerId: provider.id,
        })
      }
    } catch {
      // Audit failures must not affect the underlying FHIR operation
    }
  }

  return {
    async searchResources<T extends FHIRResource>(
      resourceType: string,
      params: Record<string, string>,
    ): Promise<T[]> {
      try {
        const searchParams = new URLSearchParams(params)
        const url = `${provider.baseUrl}/${resourceType}?${searchParams}`
        const response = await fetch(url, {
          headers: await authorizeRequest(),
        })
        const bundle = await handleResponse<{
          entry?: Array<{ resource: T }>
        }>(response)
        auditLog('search', resourceType)
        return bundle.entry?.map((e) => e.resource) ?? []
      } catch (error: unknown) {
        throw new FHIRError(
          'Failed to search resources',
          'SEARCH_ERROR',
          provider.id,
          resourceType,
          undefined,
          error instanceof Error ? error : undefined,
        )
      }
    },

    async getResource<T extends FHIRResource>(
      resourceType: string,
      id: string,
    ): Promise<T> {
      try {
        const url = `${provider.baseUrl}/${resourceType}/${id}`
        const response = await fetch(url, {
          headers: await authorizeRequest(),
        })
        const result = await handleResponse<T>(response)
        auditLog('read', resourceType, id)
        return result
      } catch (error: unknown) {
        throw new FHIRError(
          'Failed to get resource',
          'GET_ERROR',
          provider.id,
          resourceType,
          id,
          error instanceof Error ? error : undefined,
        )
      }
    },

    async createResource<T extends FHIRResource>(
      resource: Omit<T, 'id'>,
    ): Promise<T> {
      try {
        const url = `${provider.baseUrl}/${resource.resourceType}`
        const response = await fetch(url, {
          method: 'POST',
          headers: await authorizeRequest(),
          body: JSON.stringify(resource),
        })
        const result = await handleResponse<T>(response)
        auditLog('create', resource.resourceType)
        return result
      } catch (error: unknown) {
        throw new FHIRError(
          'Failed to create resource',
          'CREATE_ERROR',
          provider.id,
          resource.resourceType,
          undefined,
          error instanceof Error ? error : undefined,
        )
      }
    },

    async updateResource<T extends FHIRResource>(resource: T): Promise<T> {
      try {
        const url = `${provider.baseUrl}/${resource.resourceType}/${resource.id}`
        const response = await fetch(url, {
          method: 'PUT',
          headers: await authorizeRequest(),
          body: JSON.stringify(resource),
        })
        const result = await handleResponse<T>(response)
        auditLog('update', resource.resourceType, resource.id)
        return result
      } catch (error: unknown) {
        throw new FHIRError(
          'Failed to update resource',
          'UPDATE_ERROR',
          provider.id,
          resource.resourceType,
          resource.id,
          error instanceof Error ? error : undefined,
        )
      }
    },

    async deleteResource(resourceType: string, id: string): Promise<void> {
      try {
        const url = `${provider.baseUrl}/${resourceType}/${id}`
        const response = await fetch(url, {
          method: 'DELETE',
          headers: await authorizeRequest(),
        })
        await handleResponse<void>(response)
        auditLog('delete', resourceType, id)
      } catch (error: unknown) {
        throw new FHIRError(
          'Failed to delete resource',
          'DELETE_ERROR',
          provider.id,
          resourceType,
          id,
          error instanceof Error ? error : undefined,
        )
      }
    },
  }
}
