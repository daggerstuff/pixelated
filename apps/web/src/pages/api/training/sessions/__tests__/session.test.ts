import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockGetSession } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: async (principal: { id?: string } | null) =>
    principal?.id ?? null,
}))
vi.mock('@/lib/db', () => ({
  getPool: () => ({ query: mockQuery }),
}))

import { GET } from '../[sessionId]'

const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'

const authenticatedSession = {
  user: { id: USER_ID, role: 'therapist' },
  expires: new Date(Date.now() + 60_000).toISOString(),
}

const invoke = (context: object) =>
  (GET as unknown as (value: object) => Promise<Response>)(context)

const request = () =>
  new Request(`http://localhost/api/training/sessions/${SESSION_ID}`)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue(authenticatedSession)
})

describe('GET /api/training/sessions/:sessionId', () => {
  it('requires authentication before querying session data', async () => {
    mockGetSession.mockResolvedValue(null)

    const response = await invoke({
      request: request(),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns only a session owned by the authenticated therapist', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: SESSION_ID,
            context: {
              internalMetadata: 'not exposed',
              synthetic: true,
              clientProfile: {
                name: 'Synthetic Client',
                age: 31,
                gender: 'unspecified',
                personalityType: 'reflective',
                presentingProblem: 'Work stress',
                triggers: ['workplace conflict'],
                strengths: ['support network'],
              },
              difficultyLevel: 'intermediate',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
            content: 'Prior practice message',
            created_at: new Date('2026-11-04T05:00:00.000Z'),
          },
        ],
      })

    const response = await invoke({
      request: request(),
      params: { sessionId: SESSION_ID },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      sessionId: SESSION_ID,
      messages: [
        {
          id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
          content: 'Prior practice message',
          createdAt: '2026-11-04T05:00:00.000Z',
        },
      ],
      clientProfile: {
        name: 'Synthetic Client',
        age: 31,
        gender: 'unspecified',
        personalityType: 'reflective',
        presentingProblem: 'Work stress',
        triggers: ['workplace conflict'],
        strengths: ['support network'],
      },
      difficultyLevel: 'intermediate',
    })
    expect(mockQuery.mock.calls[0]?.[0]).toContain(
      'id = $1 AND therapist_id = $2',
    )
    expect(mockQuery.mock.calls[0]?.[0]).toContain("session_type = 'training'")
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([SESSION_ID, USER_ID])
  })

  it('returns 404 for a session owned by another user', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invoke({
      request: request(),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(404)
  })

  it('returns 404 when the session has no approved training context', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: SESSION_ID,
          context: {
            synthetic: true,
            clientProfile: { name: 'Incomplete' },
          },
        },
      ],
    })

    const response = await invoke({
      request: request(),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(404)
  })

  it('does not expose ordinary sessions as synthetic training sessions', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          context: {
            synthetic: false,
            clientProfile: {
              name: 'Private Session',
              age: 41,
              gender: 'unspecified',
              personalityType: 'reflective',
              presentingProblem: 'Personal information',
            },
            difficultyLevel: 'intermediate',
          },
        },
      ],
    })

    const response = await invoke({
      request: request(),
      params: { sessionId: SESSION_ID },
    })

    expect(response.status).toBe(404)
  })

  it('rejects malformed session IDs before querying', async () => {
    const response = await invoke({
      request: request(),
      params: { sessionId: 'not-a-uuid' },
    })

    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
