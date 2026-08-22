import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as calendarById } from '../calendar/[id]'
import { GET as calendarList, POST as calendarCreate } from '../calendar/index'
import { GET as contactById } from '../contacts/[id]'
import { GET as contactsList, POST as contactsCreate } from '../contacts/index'
import { GET as documentById } from '../documents/[id]'
import {
  GET as documentsList,
  POST as documentsCreate,
} from '../documents/index'
import { GET as gmailById, PATCH as gmailPatch } from '../gmail/[id]'
import { GET as gmailList } from '../gmail/index'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

const mockQuery = vi.fn()
vi.mock('@/lib/db', () => ({
  getPool: () => ({ query: mockQuery }),
}))

import { getCurrentUser } from '@/lib/auth'

const mockGetCurrentUser = vi.mocked(getCurrentUser)

const OWNER = { id: 'owner-1', role: 'user' }
const OTHER = { id: 'other-1', role: 'user' }

function request(
  path: string,
  init?: { method?: string; body?: unknown },
): Request {
  return new Request(`http://localhost${path}`, {
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.stringify(init.body) : undefined,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
}


function invoke(
  handler: (ctx: never) => Promise<Response>,
  ctx: object,
): Promise<Response> {
  return (handler as unknown as (c: object) => Promise<Response>)(ctx)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('workspace route auth floor', () => {
  it('returns 401 without authentication', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await invoke(documentsList, {
      request: request('/api/workspace/documents'),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for guest accounts', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'g', role: 'guest' })
    const res = await invoke(contactsList, {
      request: request('/api/workspace/contacts'),
    })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/workspace/documents', () => {
  it('scopes list query to the caller (owner/collaborator/public)', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({ rows: [] })

    await invoke(documentsList, {
      request: request('/api/workspace/documents?limit=5'),
    })

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain(
      '(owner_id = $1 OR $1 = ANY(collaborators) OR is_public = TRUE)',
    )
    expect(params).toEqual(['owner-1', 5, 0])
  })

  it("returns 404 for another user's document (no ID enumeration)", async () => {
    mockGetCurrentUser.mockResolvedValue(OTHER)
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })

    const res = await invoke(documentById, {
      request: request('/api/workspace/documents/doc-1'),
      params: { id: 'doc-1' },
    })
    expect(res.status).toBe(404)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('id = $1 AND (owner_id = $2')
    expect(params).toEqual(['doc-1', 'other-1'])
  })

  it('POST creates a document owned by the caller', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'doc-1',
          title: 'T',
          owner_id: 'owner-1',
          version: 1,
          is_public: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    })

    const res = await invoke(documentsCreate, {
      request: request('/api/workspace/documents', {
        method: 'POST',
        body: { title: 'T', content: 'C' },
      }),
    })
    expect(res.status).toBe(201)

    const [, params] = mockQuery.mock.calls[0]
    expect(params).toEqual(['T', 'C', 'owner-1', false])
  })
})

describe('GET /api/workspace/calendar', () => {
  it('scopes list to owner/attendee/public and applies time bounds', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({ rows: [] })

    await invoke(calendarList, {
      request: request(
        '/api/workspace/calendar?from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z',
      ),
    })

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain(
      '(owner_id = $1 OR $1 = ANY(attendees) OR is_public = TRUE)',
    )
    expect(sql).toContain('end_at >= $2::timestamptz')
    expect(sql).toContain('start_at <= $3::timestamptz')
    expect(params).toEqual([
      'owner-1',
      '2026-01-01T00:00:00Z',
      '2026-02-01T00:00:00Z',
      100,
    ])
  })

  it('POST validates startAt/endAt ordering', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    const res = await invoke(calendarCreate, {
      request: request('/api/workspace/calendar', {
        method: 'POST',
        body: {
          title: 'X',
          startAt: '2026-01-02T00:00:00Z',
          endAt: '2026-01-01T00:00:00Z',
        },
      }),
    })
    expect(res.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('POST creates event owned by caller', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'evt-1',
          title: 'X',
          description: '',
          owner_id: 'owner-1',
          attendees: [],
          start_at: new Date(),
          end_at: new Date(),
          location: '',
          is_public: false,
          created_at: new Date(),
        },
      ],
    })

    const res = await invoke(calendarCreate, {
      request: request('/api/workspace/calendar', {
        method: 'POST',
        body: {
          title: 'X',
          startAt: '2026-01-01T00:00:00Z',
          endAt: '2026-01-02T00:00:00Z',
        },
      }),
    })
    expect(res.status).toBe(201)

    const [, params] = mockQuery.mock.calls[0]
    expect(params[2]).toBe('owner-1')
  })

  it('attendee can fetch a shared event (200, not 404)', async () => {
    mockGetCurrentUser.mockResolvedValue(OTHER)
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'evt-1',
          title: 'Shared',
          description: '',
          owner_id: 'owner-1',
          attendees: ['other-1'],
          start_at: new Date(),
          end_at: new Date(),
          location: '',
          is_public: false,
          created_at: new Date(),
        },
      ],
    })

    const res = await invoke(calendarById, {
      request: request('/api/workspace/calendar/evt-1'),
      params: { id: 'evt-1' },
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { event: { attendees: string[] } }
    expect(data.event.attendees).toContain('other-1')
  })
})

describe('GET /api/workspace/contacts', () => {
  it('is strictly owner-scoped (no sharing predicate)', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({ rows: [] })

    await invoke(contactsList, { request: request('/api/workspace/contacts') })

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('WHERE owner_id = $1')
    expect(sql).not.toContain('collaborators')
    expect(params[0]).toBe('owner-1')
  })

  it('POST stores contact under the caller', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'c-1',
          name: 'Ada',
          email: 'ada@example.com',
          phone: '',
          organization: '',
          notes: '',
          owner_id: 'owner-1',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    })

    const res = await invoke(contactsCreate, {
      request: request('/api/workspace/contacts', {
        method: 'POST',
        body: { name: 'Ada', email: 'Ada@Example.com' },
      }),
    })
    expect(res.status).toBe(201)

    const [, params] = mockQuery.mock.calls[0]
    // email normalized to lowercase
    expect(params).toEqual(['Ada', 'ada@example.com', '', '', '', 'owner-1'])
  })
})

describe('GET /api/workspace/gmail', () => {
  it('lists newest first, owner-scoped', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({ rows: [] })

    await invoke(gmailList, { request: request('/api/workspace/gmail?limit=10') })

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('WHERE owner_id = $1')
    expect(sql).toContain('ORDER BY received_at DESC')
    expect(params).toEqual(['owner-1', 10, 0])
  })

  it('unread=true adds read_at IS NULL', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({ rows: [] })

    await invoke(gmailList, { request: request('/api/workspace/gmail?unread=true') })

    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toContain('read_at IS NULL')
  })

  it('list omits body (get includes it)', async () => {
    mockGetCurrentUser.mockResolvedValue(OWNER)
    mockQuery.mockResolvedValue({ rows: [] })
    await invoke(gmailList, { request: request('/api/workspace/gmail') })
    expect(mockQuery.mock.calls[0][0]).not.toMatch(/\bbody\b/)

    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'm-1',
          message_id: 'mid-1',
          from_name: 'Ada',
          from_address: 'ada@example.com',
          to_addresses: ['owner-1@example.com'],
          subject: 'Hi',
          body: 'secret body',
          received_at: new Date(),
          read_at: null,
          owner_id: 'owner-1',
        },
      ],
    })
    const res = await invoke(gmailById, {
      request: request('/api/workspace/gmail/m-1'),
      params: { id: 'm-1' },
    })
    const data = (await res.json()) as { message: { body: string } }
    expect(data.message.body).toBe('secret body')
  })

  it('PATCH marks read/unread only on own messages', async () => {
    mockGetCurrentUser.mockResolvedValue(OTHER)
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 })

    const res = await invoke(gmailPatch, {
      request: request('/api/workspace/gmail/m-1', {
        method: 'PATCH',
        body: { read: true },
      }),
      params: { id: 'm-1' },
    })
    expect(res.status).toBe(404)
    const [, params] = mockQuery.mock.calls[0]
    expect(params).toEqual(['m-1', 'other-1', true])
  })
})
