/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'

import { getCurrentUser } from '@/lib/auth'

import { parsePagination, requireMemoryUser, toMemoryScope } from '../_shared'

vi.mock('@/lib/services/product-memory-gateway', () => ({
  getProductMemoryGateway: vi.fn().mockReturnValue('mock-gateway'),
  ProductMemoryGatewayError: class ProductMemoryGatewayError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

describe('requireMemoryUser', () => {
  it('calls getCurrentUser with the provided request', async () => {
    const request = new Request('http://localhost')
    const mockUser = { id: 'user-1' }
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

    const result = await requireMemoryUser(request)

    expect(getCurrentUser).toHaveBeenCalledWith(request)
    expect(result).toEqual(mockUser)
  })
})

describe('jsonResponse', () => {
  it('creates a Response with JSON payload and default status 200', async () => {
    const payload = { key: 'value' }
    const { jsonResponse } = await import('../_shared')
    const response = jsonResponse(payload)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual(payload)
  })

  it('creates a Response with a custom status code', async () => {
    const payload = { key: 'value' }
    const { jsonResponse } = await import('../_shared')
    const response = jsonResponse(payload, 201)

    expect(response.status).toBe(201)
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })
})

describe('successResponse', () => {
  it('creates a Response with success payload, data, and default status 200', async () => {
    const payload = { key: 'value' }
    const { successResponse } = await import('../_shared')
    const response = successResponse(payload)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({
      success: true,
      data: payload,
      message: 'Success',
    })
  })

  it('creates a Response with a custom message and status code', async () => {
    const payload = { key: 'value' }
    const { successResponse } = await import('../_shared')
    const response = successResponse(payload, 'Created', 201)

    expect(response.status).toBe(201)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({
      success: true,
      data: payload,
      message: 'Created',
    })
  })
})

describe('errorResponse', () => {
  it('creates a Response with error payload, message, status, and details', async () => {
    const { errorResponse } = await import('../_shared')
    const response = errorResponse(400, 'Bad Request', 'Invalid input', {
      field: 'name',
    })

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({
      success: false,
      error: 'Bad Request',
      message: 'Invalid input',
      details: { field: 'name' },
    })
  })

  it('omits the details key when details is undefined', async () => {
    const { errorResponse } = await import('../_shared')
    const response = errorResponse(404, 'Not Found', 'Memory not found')

    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({
      success: false,
      error: 'Not Found',
      message: 'Memory not found',
    })
    expect('details' in data).toBe(false)
  })

  it('includes the details key when details is an empty object', async () => {
    const { errorResponse } = await import('../_shared')
    const response = errorResponse(400, 'Bad Request', 'Invalid input', {})

    const data = await response.json()
    expect(data).toEqual({
      success: false,
      error: 'Bad Request',
      message: 'Invalid input',
      details: {},
    })
    expect('details' in data).toBe(true)
  })

  it('includes details verbatim when present (object, array, string)', async () => {
    const { errorResponse } = await import('../_shared')

    const objectRes = errorResponse(400, 'Bad Request', 'Invalid', {
      reason: 'too long',
    })
    const objectData = await objectRes.json()
    expect(objectData['details']).toEqual({ reason: 'too long' })

    const arrayRes = errorResponse(400, 'Bad Request', 'Invalid', [
      'field-a',
      'field-b',
    ])
    const arrayData = await arrayRes.json()
    expect(arrayData['details']).toEqual(['field-a', 'field-b'])

    const stringRes = errorResponse(
      400,
      'Bad Request',
      'Invalid',
      'single-line detail',
    )
    const stringData = await stringRes.json()
    expect(stringData['details']).toBe('single-line detail')
  })

  it('preserves HTTP status codes 404 and 500 end-to-end', async () => {
    const { errorResponse } = await import('../_shared')

    const notFound = errorResponse(404, 'Not Found', 'Memory not found')
    expect(notFound.status).toBe(404)

    const serverError = errorResponse(
      500,
      'Internal Server Error',
      'Unexpected failure',
    )
    expect(serverError.status).toBe(500)

    const serverData = await serverError.json()
    expect(serverData).toEqual({
      success: false,
      error: 'Internal Server Error',
      message: 'Unexpected failure',
    })
  })
})

describe('jsonError', () => {
  it('creates a Response with error payload, message, and status', async () => {
    const { jsonError } = await import('../_shared')
    const response = jsonError(400, 'Bad Request', 'Invalid input')

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({
      error: 'Bad Request',
      message: 'Invalid input',
    })
  })
})

describe('parsePagination', () => {
  it('parses limit and offset with defaults', () => {
    const url = new URL('http://localhost')

    expect(parsePagination(url)).toEqual({
      limit: 10,
      offset: 0,
    })
  })

  it('parses explicit valid limit and offset', () => {
    const url = new URL('http://localhost?limit=25&offset=5')

    expect(parsePagination(url)).toEqual({
      limit: 25,
      offset: 5,
    })
  })

  it('falls back to defaults for non-numeric params', () => {
    const url = new URL('http://localhost?limit=abc&offset=xyz')

    expect(parsePagination(url)).toEqual({
      limit: 10,
      offset: 0,
    })
  })

  it('falls back when limit or offset are negative', () => {
    const url = new URL('http://localhost?limit=-5&offset=-3')

    expect(parsePagination(url)).toEqual({
      limit: 10,
      offset: 0,
    })
  })

  it('falls back to default limit when limit is zero', () => {
    const url = new URL('http://localhost?limit=0&offset=12')

    expect(parsePagination(url)).toEqual({
      limit: 10,
      offset: 12,
    })
  })

  it('handles partial params when only one query value is present', () => {
    expect(parsePagination(new URL('http://localhost?limit=30'))).toEqual({
      limit: 30,
      offset: 0,
    })

    expect(parsePagination(new URL('http://localhost?offset=15'))).toEqual({
      limit: 10,
      offset: 15,
    })
  })

  it('caps limit at 100 for large values', () => {
    const url = new URL('http://localhost?limit=500&offset=0')

    expect(parsePagination(url)).toEqual({
      limit: 100,
      offset: 0,
    })
  })
})

describe('toMemoryScope', () => {
  it('maps user, account, and workspace correctly with includeShared true', async () => {
    const scope = toMemoryScope('user-1', 'account-1', 'workspace-1')
    expect(scope).toEqual({
      userId: 'user-1',
      accountId: 'account-1',
      workspaceId: 'workspace-1',
      includeShared: true,
    })
  })

  it('handles optional parameters', async () => {
    const scope = toMemoryScope('user-1')
    expect(scope).toEqual({
      userId: 'user-1',
      accountId: undefined,
      workspaceId: undefined,
      includeShared: true,
    })
  })
})

describe('assertRequestedUser', () => {
  it('returns null if requestedUserId is undefined or null', async () => {
    const { assertRequestedUser } = await import('../_shared')
    expect(assertRequestedUser('user-1', undefined)).toBeNull()
    expect(assertRequestedUser('user-1', null)).toBeNull()
  })

  it('returns null if actualUserId matches requestedUserId', async () => {
    const { assertRequestedUser } = await import('../_shared')
    expect(assertRequestedUser('user-1', 'user-1')).toBeNull()
  })

  it('returns a 400 error response if actualUserId does not match requestedUserId', async () => {
    const { assertRequestedUser } = await import('../_shared')
    const response = assertRequestedUser('user-1', 'user-2')

    expect(response).toBeInstanceOf(Response)
    expect(response?.status).toBe(400)

    const data = await response?.json()
    expect(data).toEqual({
      error: 'Bad Request',
      message: 'userId must match the authenticated user',
    })
  })
})

describe('withAuthenticatedMemoryRoute', () => {
  it('returns a 401 error if user is not authenticated', async () => {
    const { withAuthenticatedMemoryRoute } = await import('../_shared')
    const { getCurrentUser } = await import('@/lib/auth')

    vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

    const handler = vi.fn()
    const route = withAuthenticatedMemoryRoute('testAction', handler)

    const request = new Request('http://localhost')
    const response = await route({ request })

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
    expect(handler).not.toHaveBeenCalled()
  })

  it('calls handler if user is authenticated and returns the response', async () => {
    const { withAuthenticatedMemoryRoute } = await import('../_shared')
    const { getCurrentUser } = await import('@/lib/auth')

    const mockUser = { id: 'user-1' }
    vi.mocked(getCurrentUser).mockResolvedValueOnce(mockUser as any)

    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    })
    const handler = vi.fn().mockResolvedValueOnce(mockResponse)
    const route = withAuthenticatedMemoryRoute('testAction', handler)

    const request = new Request('http://localhost')
    const context = { request, params: { memoryId: 'test-id' } }
    const response = await route(context)

    expect(handler).toHaveBeenCalledWith(context, mockUser)
    expect(response).toBe(mockResponse)
  })
})

describe('getGateway', () => {
  it('calls getProductMemoryGateway and returns its result', async () => {
    const { getGateway } = await import('../_shared')
    const { getProductMemoryGateway } =
      await import('@/lib/services/product-memory-gateway')

    const result = getGateway()

    expect(getProductMemoryGateway).toHaveBeenCalled()
    expect(result).toBe('mock-gateway')
  })
})

describe('handleMemoryApiError', () => {
  it('handles ProductMemoryGatewayError with 404 status', async () => {
    const { handleMemoryApiError } = await import('../_shared')
    const { ProductMemoryGatewayError } =
      await import('@/lib/services/product-memory-gateway')

    const error = new ProductMemoryGatewayError('Not found', 404)
    const response = handleMemoryApiError('testAction', error)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Not Found')
  })

  it('handles ProductMemoryGatewayError with 400 status', async () => {
    const { handleMemoryApiError } = await import('../_shared')
    const { ProductMemoryGatewayError } =
      await import('@/lib/services/product-memory-gateway')

    const error = new ProductMemoryGatewayError('Bad request', 400)
    const response = handleMemoryApiError('testAction', error)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Bad Request')
  })

  it('handles ProductMemoryGatewayError with 401 status', async () => {
    const { handleMemoryApiError } = await import('../_shared')
    const { ProductMemoryGatewayError } =
      await import('@/lib/services/product-memory-gateway')

    const error = new ProductMemoryGatewayError('Unauthorized', 401)
    const response = handleMemoryApiError('testAction', error)

    expect(response.status).toBe(502)
    const data = await response.json()
    expect(data.error).toBe('Bad Gateway')
  })

  it('handles ProductMemoryGatewayError with 403 status', async () => {
    const { handleMemoryApiError } = await import('../_shared')
    const { ProductMemoryGatewayError } =
      await import('@/lib/services/product-memory-gateway')

    const error = new ProductMemoryGatewayError('Forbidden', 403)
    const response = handleMemoryApiError('testAction', error)

    expect(response.status).toBe(502)
    const data = await response.json()
    expect(data.error).toBe('Bad Gateway')
  })

  it('handles standard Error', async () => {
    const { handleMemoryApiError } = await import('../_shared')

    const error = new Error('Some unexpected error')
    const response = handleMemoryApiError('testAction', error)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Internal Server Error')
  })

  it('handles unknown error types', async () => {
    const { handleMemoryApiError } = await import('../_shared')

    const error = 'Just a string error'
    const response = handleMemoryApiError('testAction', error)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Internal Server Error')
  })
})
