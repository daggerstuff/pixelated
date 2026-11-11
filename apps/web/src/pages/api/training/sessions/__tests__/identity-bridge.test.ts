import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockGetSession, mockResolveInternalUserId } = vi.hoisted(
  () => ({
    mockQuery: vi.fn(),
    mockGetSession: vi.fn(),
    mockResolveInternalUserId: vi.fn(),
  }),
)

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/db', () => ({
  getPool: () => ({ query: mockQuery }),
  query: mockQuery,
  // Mirrors the real predicate so the route's 503 mapping is exercised.
  isDatabaseUnavailableError: (error: unknown) =>
    (error as { code?: string } | null)?.code === 'DB_UNAVAILABLE',
}))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))

import { GET } from '../[sessionId]'
import { POST } from '../[sessionId]/messages'

const ORG_A_UUID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const ORG_B_UUID = '9d1f0a54-1c7e-4a25-9f6b-2f0f9d1c7a11'
const SESSION_A = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const SESSION_B = 'bb682d68-2338-48f0-8ac5-e0243b1346d2'

const principal = (id: string) => ({ user: { id, role: 'therapist' } })

const invokeGet = (sessionId: string) =>
  (GET as unknown as (value: object) => Promise<Response>)({
    request: new Request(`http://localhost/api/training/sessions/${sessionId}`),
    params: { sessionId },
  })

const invokePost = (sessionId: string, content = 'Trainee reply') =>
  (POST as unknown as (value: object) => Promise<Response>)({
    request: new Request(
      `http://localhost/api/training/sessions/${sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost',
        },
        body: JSON.stringify({ content }),
      },
    ),
    params: { sessionId },
  })

const sessionRow = (id: string) => ({
  rowCount: 1,
  rows: [
    {
      id,
      context: {
        synthetic: true,
        clientProfile: {
          name: 'Synthetic Client',
          age: 31,
          gender: 'unspecified',
          personalityType: 'reflective',
          presentingProblem: 'Work stress',
        },
        difficultyLevel: 'intermediate',
      },
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue(principal('auth0|org-a'))
  mockResolveInternalUserId.mockResolvedValue(ORG_A_UUID)
})

describe('identity bridge — training session read', () => {
  it('resolves the Auth0 sub to the internal UUID before the ownership query', async () => {
    mockQuery
      .mockResolvedValueOnce(sessionRow(SESSION_A))
      .mockResolvedValueOnce({ rows: [] })

    const response = await invokeGet(SESSION_A)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sessionId).toBe(SESSION_A)
    expect(mockResolveInternalUserId).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auth0|org-a' }),
      { propagateDatabaseErrors: true },
    )
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([SESSION_A, ORG_A_UUID])
    expect(mockQuery.mock.calls[0]?.[1]).not.toContain('auth0|org-a')
  })

  it('answers a retryable 503 when identity resolution stalls on the database', async () => {
    // D3: the first Postgres round-trip is the acquisition. It must reach the
    // client as a retryable failure, not as a denial or a deadline expiry.
    mockResolveInternalUserId.mockRejectedValue(
      Object.assign(new Error('Database connection could not be acquired'), {
        code: 'DB_UNAVAILABLE',
      }),
    )

    const response = await invokeGet(SESSION_A)

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('1')
    expect(await response.json()).toEqual({
      error: 'Session temporarily unavailable',
    })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('denies a resolved principal whose session belongs to another organization (A to B)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invokeGet(SESSION_B)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Session not found' })
    expect(JSON.stringify(body)).not.toContain(SESSION_B)
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([SESSION_B, ORG_A_UUID])
  })

  it('denies a resolved principal whose session belongs to another organization (B to A)', async () => {
    mockGetSession.mockResolvedValue(principal('auth0|org-b'))
    mockResolveInternalUserId.mockResolvedValue(ORG_B_UUID)
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    const response = await invokeGet(SESSION_A)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Session not found' })
    expect(mockQuery.mock.calls[0]?.[1]).toEqual([SESSION_A, ORG_B_UUID])
  })

  it('denies an unmapped principal without returning 5xx', async () => {
    mockResolveInternalUserId.mockResolvedValue(null)

    const response = await invokeGet(SESSION_A)

    expect([401, 403, 404]).toContain(response.status)
    expect(response.status).toBeLessThan(500)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('identity bridge — training message write', () => {
  it('writes as the resolved internal UUID for the session owner', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'cf3f44d1-adb0-4db2-96e1-5481fa80872b',
          content: 'Trainee reply',
          created_at: new Date('2026-11-04T05:00:00.000Z'),
        },
      ],
    })

    const response = await invokePost(SESSION_A)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.content).toBe('Trainee reply')
    const params = mockQuery.mock.calls[0]?.[1] as unknown[]
    expect(params).toHaveLength(4)
    expect(params[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(params.slice(1)).toEqual([SESSION_A, ORG_A_UUID, 'Trainee reply'])
    expect(params).not.toContain('auth0|org-a')
  })

  it('denies a cross-owner write and creates no row (A to B)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await invokePost(SESSION_B, 'foreign write')
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Training session not found' })
    expect(mockQuery.mock.calls[0]?.[0]).toContain('therapist_id = $3')
    const params = (mockQuery.mock.calls[0]?.[1] ?? []) as unknown[]
    expect(params.slice(1)).toEqual([SESSION_B, ORG_A_UUID, 'foreign write'])
  })

  it('denies a cross-owner write and creates no row (B to A)', async () => {
    mockGetSession.mockResolvedValue(principal('auth0|org-b'))
    mockResolveInternalUserId.mockResolvedValue(ORG_B_UUID)
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    const response = await invokePost(SESSION_A, 'foreign write')

    expect(response.status).toBe(404)
    const params = (mockQuery.mock.calls[0]?.[1] ?? []) as unknown[]
    expect(params.slice(1)).toEqual([SESSION_A, ORG_B_UUID, 'foreign write'])
  })

  it('denies an unmapped principal without writing or returning 5xx', async () => {
    mockResolveInternalUserId.mockResolvedValue(null)

    const response = await invokePost(SESSION_A)

    expect([401, 403, 404]).toContain(response.status)
    expect(response.status).toBeLessThan(500)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
