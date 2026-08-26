import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET, POST } from './session'

vi.mock('@/config/mongodb.config', () => {
  const store = new Map<string, Record<string, unknown>>()

  return {
    mongodb: {
      connect: vi.fn(async () => ({
        collection: () => ({
          createIndexes: vi.fn(),
          findOne: vi.fn(async (filter: { sessionId: string }) => {
            const doc = store.get(filter.sessionId)
            return doc ?? null
          }),
          updateOne: vi.fn(
            async (
              filter: { sessionId: string },
              update: {
                $set: Record<string, unknown>
                $setOnInsert?: Record<string, unknown>
              },
              _opts: { upsert: boolean },
            ) => {
              store.set(filter.sessionId, update.$set)
              return { upsertedCount: 1 }
            },
          ),
          deleteOne: vi.fn(async (filter: { sessionId: string }) => {
            store.delete(filter.sessionId)
          }),
        }),
      })),
    },
  }
})

describe('API /session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for missing session', async () => {
    const request = new Request('http://localhost/api/session?id=missing')
    const response = await GET({ request })
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  it('creates and retrieves session', async () => {
    const sessionData = {
      id: 'test-id',
      therapist_id: 'therapist-1',
      started_at: new Date().toISOString(),
      state: 'active',
    }
    // POST
    const postResponse = await POST({
      request: new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify(sessionData),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    })
    expect(postResponse.status).toBe(201)
    const postData = await postResponse.json()
    expect(postData).toMatchObject({ ...sessionData, saved: true })
    // GET
    const getRequest = new Request('http://localhost/api/session?id=test-id')
    const getResponse = await GET({ request: getRequest })
    expect(getResponse.status).toBe(200)
    const getData = await getResponse.json()
    expect(getData).toMatchObject(sessionData)
  })
})
