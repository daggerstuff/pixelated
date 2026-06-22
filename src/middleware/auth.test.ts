/// <reference types="vitest/node" />
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { withAuth } from './auth'

const mockValidateApiKey = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())
const mockIsSessionValid = vi.hoisted(() => vi.fn())

vi.mock('../lib/db/developer-api-keys', () => ({
  developerApiKeyManager: {
    validateApiKey: mockValidateApiKey,
  },
}))

vi.mock('../lib/auth/session', () => ({
  getSession: mockGetSession,
  isSessionValid: mockIsSessionValid,
}))

describe('withAuth middleware', () => {
  const mockRequest = new Request('https://example.com/api/test')
  const mockHandler = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true })))

  beforeEach(() => {
    mockHandler.mockClear()
    mockValidateApiKey
      .mockReset()
      .mockResolvedValue({ valid: false, error: 'Invalid API key' })
    mockGetSession.mockReset().mockResolvedValue(null)
    mockIsSessionValid.mockReset().mockReturnValue(false)
  })

  it('should allow unauthenticated access to whitelisted paths', async () => {
    const middleware = withAuth(mockHandler, { allowPaths: ['/api/health'] })
    const request = new Request('https://example.com/api/health')

    const response = await middleware(request)
    expect(response.status).toBe(200)
    expect(mockHandler).toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated requests without allowApiKey', async () => {
    const middleware = withAuth(mockHandler)
    const response = await middleware(mockRequest)

    expect(response.status).toBe(401)
    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('should validate API key when allowApiKey is true', async () => {
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      api_key: {
        user_id: 'dev_001',
        scopes: ['developer'],
        rate_limit: 1000,
      },
    })

    const middleware = withAuth(mockHandler, { allowApiKey: true })
    const request = new Request('https://example.com/api/test', {
      headers: { 'X-API-Key': 'x-api-key-placeholder' },
    })

    const response = await middleware(request)
    expect(response.status).toBe(200)
    expect(mockHandler).toHaveBeenCalled()
  })

  it('should return 401 for invalid API key', async () => {
    const middleware = withAuth(mockHandler, { allowApiKey: true })
    const request = new Request('https://example.com/api/test', {
      headers: { 'X-API-Key': 'invalid-key' },
    })

    const response = await middleware(request)
    expect(response.status).toBe(401)
    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('should return 401 when API key validation times out', async () => {
    vi.useFakeTimers()

    // Make validateApiKey never resolve so it triggers the timeout
    mockValidateApiKey.mockImplementation(() => new Promise(() => {}))

    const middleware = withAuth(mockHandler, { allowApiKey: true })
    const request = new Request('https://example.com/api/test', {
      headers: { 'X-API-Key': 'timeout-key' },
    })

    const responsePromise = middleware(request)

    // Advance timers to trigger the 5000ms timeout
    await vi.advanceTimersByTimeAsync(5000)
    // Let the event loop tick
    await Promise.resolve()

    const response = await responsePromise
    expect(response.status).toBe(401)
    expect(mockHandler).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
  it('should return 401 when API key validation throws an error', async () => {
    vi.useFakeTimers()
    mockValidateApiKey.mockRejectedValue(new Error('Database error'))

    const middleware = withAuth(mockHandler, { allowApiKey: true })
    const request = new Request('https://example.com/api/test', {
      headers: { 'X-API-Key': 'error-key' },
    })

    const response = await middleware(request)
    expect(response.status).toBe(401)
    expect(mockHandler).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
