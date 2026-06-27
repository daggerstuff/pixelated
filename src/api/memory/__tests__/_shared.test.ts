import { describe, expect, it, vi } from 'vitest'

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
      message: 'Success'
    })
  })
})

describe('errorResponse', () => {
  it('creates an error Response with correct payload and status', async () => {
    const { errorResponse } = await import('../_shared')
    const response = errorResponse(400, 'Bad Request', 'Invalid input', { field: 'name' })

    expect(response.status).toBe(400)
    expect(response.headers.get('Content-Type')).toBe('application/json')

    const data = await response.json()
    expect(data).toEqual({
      success: false,
      error: 'Bad Request',
      message: 'Invalid input',
      details: { field: 'name' }
    })
  })
})
