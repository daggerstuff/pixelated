import type { EHRProvider, FHIRClient, FHIRResource } from '../types'
import { FHIRError } from '../types'
import { OAuth2Service } from './oauth2.service'

export function createFHIRClient(provider: EHRProvider): FHIRClient {
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
        const bundle = await handleResponse<{ entry?: Array<{ resource: T }> }>(
          response,
        )
        return bundle.entry?.map((e) => e.resource) || []
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
        return handleResponse<T>(response)
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
        return handleResponse<T>(response)
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
        return handleResponse<T>(response)
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
