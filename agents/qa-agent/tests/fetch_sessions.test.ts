import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const inputSchema = z.object({
  since: z.string().datetime().describe('ISO 8601 timestamp'),
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
})

async function execute(input: z.infer<typeof inputSchema>) {
  return {
    since: input.since,
    limit: input.limit ?? 50,
    cursor: input.cursor ?? null,
    next_cursor: null,
    sessions: [],
    fetched_at: new Date().toISOString(),
    foresight_stub: {
      note:
        'Foresight tagged-query `session.lifecycle=CLOSED AND ' +
        'session.closed_at >= :since` is not yet wired.',
    },
    mongo_stub: {
      collection: 'sessions',
      note: 'Mongo query via the session-mcp is not yet wired.',
    },
  }
}

describe('fetch_sessions', () => {
  it('should echo the since parameter in output', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50 })
    expect(result.since).toBe(since)
  })

  it('should default limit to 50', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since })
    expect(result.limit).toBe(50)
  })

  it('should default limit to 50 when explicitly passed', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50 })
    expect(result.limit).toBe(50)
  })

  it('should accept different limit values within range', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 100 })
    expect(result.limit).toBe(100)
  })

  it('should return null for cursor when not provided', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since })
    expect(result.cursor).toBeNull()
  })

  it('should echo cursor when provided', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50, cursor: 'page-2-token' })
    expect(result.cursor).toBe('page-2-token')
  })

  it('should return an empty sessions array in this stub', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50 })
    expect(result.sessions).toHaveLength(0)
  })

  it('should return next_cursor as null in this stub', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50 })
    expect(result.next_cursor).toBeNull()
  })

  it('should include a valid ISO fetched_at timestamp', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50 })
    expect(result.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should return both foresight_stub and mongo_stub', async () => {
    const since = '2026-01-01T00:00:00.000Z'
    const result = await execute({ since, limit: 50 })
    expect(result.foresight_stub).toBeDefined()
    expect(result.mongo_stub).toBeDefined()
    expect((result.mongo_stub as Record<string, unknown>).collection).toBe(
      'sessions',
    )
  })
})
