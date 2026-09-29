/* @vitest-environment node */
/**
 * src/pages/api/ai/__tests__/quad-audit.test.ts
 *
 * Verifies the quad-audit gateway route: session/admin gating, service
 * configuration errors, request validation, and upstream pass-through
 * (success, upstream error mapping).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/session.js', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
  AuditEventType: { AI_OPERATION: 'ai_operation' },
  AuditEventStatus: { SUCCESS: 'success', FAILURE: 'failure' },
}))

import { getSession } from '@/lib/auth/session.js'

const mockGetSession = vi.mocked(getSession)

function makeRequest(body: unknown): Request {
  return {
    method: 'POST',
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

function makeSession(role: string): object {
  return { user: { id: 'user-1', role } }
}

async function loadRoute(): Promise<{ POST: (ctx: { request: Request }) => Promise<Response> }> {
  return await import('../quad-audit')
}

describe('POST /api/ai/quad-audit', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('QUADIT_AUDIT_SERVICE_URL', 'http://pe-service.test/api/v1/audits')
    vi.stubEnv('QUADIT_AUDIT_SERVICE_TOKEN', 'service-token')
    mockGetSession.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns 401 when there is no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const { POST } = await loadRoute()

    const response = await POST({ request: makeRequest({ items: [] }) })
    expect(response.status).toBe(401)
  })

  it('returns 403 when the user is not an admin', async () => {
    mockGetSession.mockResolvedValue(makeSession('educator') as never)
    const { POST } = await loadRoute()

    const response = await POST({ request: makeRequest({ items: [] }) })
    expect(response.status).toBe(403)
  })

  it('returns 503 when the service URL is not configured', async () => {
    vi.stubEnv('QUADIT_AUDIT_SERVICE_URL', '')
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    const { POST } = await loadRoute()

    const response = await POST({ request: makeRequest({ items: [] }) })
    expect(response.status).toBe(503)
  })

  it('returns 422 for an empty items array', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    const { POST } = await loadRoute()

    const response = await POST({
      request: makeRequest({ items: [], mode: 'deterministic' }),
    })
    expect(response.status).toBe(422)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('items')
  })

  it('returns 422 for an item with empty content', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    const { POST } = await loadRoute()

    const response = await POST({
      request: makeRequest({ items: [{ id: 'a', content: '  ' }] }),
    })
    expect(response.status).toBe(422)
  })

  it('returns 422 for an invalid mode', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    const { POST } = await loadRoute()

    const response = await POST({
      request: makeRequest({
        items: [{ id: 'a', content: 'text' }],
        mode: 'vibes',
      }),
    })
    expect(response.status).toBe(422)
  })

  it('forwards valid requests and returns the upstream report', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    const report = { passed: true, verdicts: [], summary: 'ok' }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(report), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadRoute()

    const response = await POST({
      request: makeRequest({
        items: [{ id: 'a', content: 'hello' }],
        mode: 'deterministic',
      }),
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { passed: boolean }
    expect(body.passed).toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://pe-service.test/api/v1/audits',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer service-token',
        }),
      }),
    )
  })

  it('maps upstream errors to the upstream status', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'bad item' }), { status: 422 }),
      ),
    )
    const { POST } = await loadRoute()

    const response = await POST({
      request: makeRequest({ items: [{ id: 'a', content: 'hello' }] }),
    })
    expect(response.status).toBe(422)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe('bad item')
  })

  it('returns 500 when the upstream fetch throws', async () => {
    mockGetSession.mockResolvedValue(makeSession('admin') as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection refused')),
    )
    const { POST } = await loadRoute()

    const response = await POST({
      request: makeRequest({ items: [{ id: 'a', content: 'hello' }] }),
    })
    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain('connection refused')
  })
})
