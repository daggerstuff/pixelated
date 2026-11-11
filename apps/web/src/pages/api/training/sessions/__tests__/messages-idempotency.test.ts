/**
 * Idempotency coverage for the trainee message POST.
 *
 * `withDeadline` races the handler against a timer; it does not abort the work
 * it wrapped. A statement that overruns the 8 000 ms bound can therefore still
 * commit after the client has received the retryable `503`, and the retry the
 * `503` invites writes a second row for the same submission.
 *
 * The route identifies a logical submission by its payload — session, author
 * and content — and writes the row under a deterministic primary key, so the
 * first attempt and its retry contend for the same row instead of stacking two.
 * These cases exercise that with a fake table that honours `ON CONFLICT (id) DO
 * NOTHING`, including the ordering that produces the defect: the retry lands
 * first and the abandoned first attempt commits afterwards.
 *
 * They fail against the pinned handler for the right reason: it inserts with a
 * server-generated id, so the two attempts are two rows.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQuery, mockGetSession, mockResolveInternalUserId } = vi.hoisted(
  () => ({
    mockQuery: vi.fn(),
    mockGetSession: vi.fn(),
    mockResolveInternalUserId: vi.fn(),
  }),
)

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/auth/internal-identity', () => ({
  resolveInternalUserId: mockResolveInternalUserId,
}))
vi.mock('@/lib/db', () => ({
  getPool: () => ({ query: mockQuery }),
  query: mockQuery,
  isDatabaseUnavailableError: (error: unknown) =>
    (error as { code?: string } | null)?.code === 'DB_UNAVAILABLE',
}))

import { MESSAGE_POST_DEADLINE_MS, POST } from '../[sessionId]/messages'

const USER_ID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'
const SESSION_ID = '7a62430b-a01a-4eaf-8eb8-517e70ffb20d'
const OTHER_SESSION_ID = '9b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

type MessageRow = {
  id: string
  session_id: string
  therapist_id: string
  content: string
  created_at: Date
}

/**
 * A table that behaves like `training_session_messages` for the two statements
 * this route issues. The INSERT honours the SQL it is given:
 *
 * - a column list that names `id` uses the caller's deterministic key and
 *   `ON CONFLICT (id) DO NOTHING` drops a duplicate;
 * - a column list without `id` is the pinned handler, which lets Postgres
 *   generate a fresh uuid per statement — exactly the double-write under test.
 */
const createTable = () => {
  const rows: MessageRow[] = []
  let insertCalls = 0
  let sessionOwned = true

  const query = vi.fn(async (text: string, params: unknown[] = []) => {
    if (/INSERT INTO training_session_messages/.test(text)) {
      insertCalls += 1
      const declaresId =
        /INSERT INTO training_session_messages \(\s*id\s*,/.test(text)
      const [first, second, third, fourth] = params as [
        string,
        string,
        string,
        string,
      ]
      const id = declaresId ? first : crypto.randomUUID()
      const sessionId = declaresId ? second : first
      const therapistId = declaresId ? third : second
      const content = declaresId ? fourth : third

      if (!sessionOwned) return { rows: [], rowCount: 0 }
      if (declaresId && rows.some((row) => row.id === id)) {
        return { rows: [], rowCount: 0 }
      }

      const row: MessageRow = {
        id,
        session_id: sessionId,
        therapist_id: therapistId,
        content,
        created_at: new Date(),
      }
      rows.push(row)
      return {
        rows: [
          { id: row.id, content: row.content, created_at: row.created_at },
        ],
        rowCount: 1,
      }
    }

    if (
      /SELECT id, content, created_at/.test(text) &&
      /FROM training_session_messages/.test(text)
    ) {
      const [id, sessionId, therapistId] = params as [string, string, string]
      const row = rows.find(
        (candidate) =>
          candidate.id === id &&
          candidate.session_id === sessionId &&
          candidate.therapist_id === therapistId,
      )
      return row
        ? {
            rows: [
              {
                id: row.id,
                content: row.content,
                created_at: row.created_at,
              },
            ],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 }
    }

    throw new Error(`Unexpected statement: ${text}`)
  })

  return {
    rows,
    query,
    insertCalls: () => insertCalls,
    setSessionOwned: (owned: boolean) => {
      sessionOwned = owned
    },
  }
}

const request = (content: string, sessionId = SESSION_ID) =>
  new Request(`http://localhost/api/training/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost',
    },
    body: JSON.stringify({ content }),
  })

const invoke = (content: string, sessionId = SESSION_ID) =>
  (POST as unknown as (value: object) => Promise<Response>)({
    request: request(content, sessionId),
    params: { sessionId },
  })

const flush = async () => {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: { id: USER_ID } })
  mockResolveInternalUserId.mockResolvedValue(USER_ID)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('trainee message POST idempotency', () => {
  it('writes one row when a retry lands before the abandoned first INSERT', async () => {
    const table = createTable()
    let releaseFirstInsert: (() => void) | undefined
    const firstInsertGate = new Promise<void>((resolve) => {
      releaseFirstInsert = resolve
    })
    let insertCalls = 0

    mockQuery.mockImplementation(async (text: string, params?: unknown[]) => {
      if (/INSERT INTO training_session_messages/.test(text)) {
        insertCalls += 1
        if (insertCalls === 1) {
          // The first attempt's statement is still in flight when the deadline
          // fires. This is the measured shape: a persisted POST at 18 641 ms
          // against an 8 000 ms bound.
          await firstInsertGate
        }
      }
      return table.query(text, params)
    })

    vi.useFakeTimers()
    const firstAttempt = invoke('Practice response')
    await vi.advanceTimersByTimeAsync(MESSAGE_POST_DEADLINE_MS)
    const firstResponse = await firstAttempt
    expect(firstResponse.status).toBe(503)
    expect(firstResponse.headers.get('retry-after')).toBe('1')

    // The trainee retries the same submission. It is admitted once.
    vi.useRealTimers()
    const retry = await invoke('Practice response')
    expect(retry.status).toBe(201)
    expect(await retry.json()).toMatchObject({ content: 'Practice response' })

    // The abandoned first attempt now commits, after the 503 was sent.
    releaseFirstInsert?.()
    await flush()

    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.content).toBe('Practice response')
  })

  it('answers the retry with the row the first attempt persisted', async () => {
    const table = createTable()
    mockQuery.mockImplementation(table.query)

    const first = await invoke('Practice response')
    const retry = await invoke('Practice response')

    expect(first.status).toBe(201)
    expect(retry.status).toBe(201)
    const firstBody = (await first.json()) as { id: string; createdAt: string }
    const retryBody = (await retry.json()) as { id: string; createdAt: string }
    expect(retryBody.id).toBe(firstBody.id)
    expect(retryBody.createdAt).toBe(firstBody.createdAt)
    expect(table.rows).toHaveLength(1)
  })

  it('keeps the happy path to a single statement', async () => {
    const table = createTable()
    mockQuery.mockImplementation(table.query)

    const response = await invoke('Practice response')

    expect(response.status).toBe(201)
    // One INSERT and no lookup: the deduplicating read only runs when the
    // insert reports a conflict or an absent session.
    expect(table.insertCalls()).toBe(1)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('keeps distinct submissions in the same session as separate rows', async () => {
    const table = createTable()
    mockQuery.mockImplementation(table.query)

    expect((await invoke('Practice response')).status).toBe(201)
    expect((await invoke('A different reflection')).status).toBe(201)

    expect(table.rows).toHaveLength(2)
  })

  it('keeps the same content in different sessions as separate rows', async () => {
    const table = createTable()
    mockQuery.mockImplementation(table.query)

    expect((await invoke('Practice response', SESSION_ID)).status).toBe(201)
    expect((await invoke('Practice response', OTHER_SESSION_ID)).status).toBe(
      201,
    )

    expect(table.rows).toHaveLength(2)
  })

  it('answers 404 without leaking a row when the session is not owned', async () => {
    const table = createTable()
    mockQuery.mockImplementation(table.query)
    table.setSessionOwned(false)

    const response = await invoke('Practice response')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: 'Training session not found',
    })
    expect(table.rows).toHaveLength(0)
    // The replay lookup is scoped to the caller, so an absent ownership
    // predicate cannot surface somebody else's message.
    const lookup = String(mockQuery.mock.calls[1]?.[0])
    expect(lookup).toContain('session_id = $2')
    expect(lookup).toContain('therapist_id = $3')
  })

  it('treats a retry after the deadline window as the same submission', async () => {
    const table = createTable()
    mockQuery.mockImplementation(table.query)

    expect((await invoke('Practice response')).status).toBe(201)

    // The key is derived from the payload, not from wall-clock time, so a
    // retry that lands later still resolves to the row the first attempt
    // wrote instead of stacking a second one.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1000))
    const retry = await invoke('Practice response')
    vi.useRealTimers()

    expect(retry.status).toBe(201)
    expect(table.rows).toHaveLength(1)
  })
})
