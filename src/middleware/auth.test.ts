import { describe, it, expect, vi, beforeEach } from 'vitest'

import { withAuth } from './auth'
import type { Session, ApiKeySession, ValidSession } from './auth'

describe('withAuth middleware', () => {
  const mockRequest = new Request('https://example.com/api/test')
  const mockHandler = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true })))

  beforeEach(() => {
    vi.clearAllMocks()
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
    // Mock the validateApiKey function
    vi.mock('@/lib/auth', () => ({
      ...vi.importActual<'@/lib/auth'>('@/lib/auth'),
      validateApiKey: vi.fn().mockResolvedValue({
        user: { id: 'dev_001', role: 'developer' },
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        authType: 'api-key',
      } as ApiKeySession),
    }))

    const { validateApiKey } = await import('@/lib/auth')
    validateApiKey.mockResolvedValue({
      user: { id: 'dev_001', role: 'developer' },
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      authType: 'api-key',
    } as ApiKeySession)

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
