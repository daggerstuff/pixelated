import { describe, it, expect, vi, beforeEach } from 'vitest'

import { withAuth } from './auth'

const mockValidateApiKey = vi.fn()

vi.mock('@/lib/db/developer-api-keys', () => ({
  developerApiKeyManager: {
    validateApiKey: mockValidateApiKey,
  },
}))

describe('withAuth middleware', () => {
  const mockRequest = new Request('https://example.com/api/test')
  const mockHandler = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true })))

  beforeEach(() => {
    mockValidateApiKey
      .mockReset()
      .mockResolvedValue({ valid: false, error: 'Invalid API key' })
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
})
