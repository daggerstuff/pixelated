import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockGetSession } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/db', () => ({ getPool: () => ({ query: mockQuery }) }))

import { POST } from '../[sessionId]/messages'

const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const invoke = (context: object) =>
  (POST as unknown as (value: object) => Promise<Response>)(context)

const request = (body: unknown) =>
  new Request(`http://localhost/api/training/sessions/${SESSION_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost',
    },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: { id: USER_ID } })
})

describe('POST /api/training/sessions/:sessionId/messages', () => {
  it('requires authentication before saving', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await invoke({
      request: request({ content: 'Practice response' }),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('saves only to an owner-owned synthetic training session', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
          content: 'Practice response',
          created_at: new Date('2026-11-04T05:00:00.000Z'),
        },
      ],
    })

    const response = await invoke({
      request: request({ content: ' Practice response ' }),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
      content: 'Practice response',
      createdAt: '2026-11-04T05:00:00.000Z',
    })
    expect(mockQuery.mock.calls[0]?.[0]).toContain(
      "context->>'synthetic' = 'true'",
    )
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([
      SESSION_ID,
      USER_ID,
      'Practice response',
    ])
  })

  it('rejects empty and oversized messages', async () => {
    for (const content of ['', ' '.repeat(3), 'x'.repeat(1001)]) {
      const response = await invoke({
        request: request({ content }),
        params: { sessionId: SESSION_ID },
      })
      expect(response.status).toBe(400)
    }

    expect(mockQuery).not.toHaveBeenCalled()
  })
})
