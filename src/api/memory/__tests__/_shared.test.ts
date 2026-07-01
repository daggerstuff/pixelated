/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { getCurrentUser } from '@/lib/auth'

import { requireMemoryUser } from '../_shared'

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
