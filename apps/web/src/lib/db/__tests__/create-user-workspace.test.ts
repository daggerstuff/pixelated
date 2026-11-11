/** @vitest-environment node */

/**
 * Registration provisions a user against a resolved workspace (VAL-IDENT-003).
 *
 * `db/migrations/011_add_workspace_id_to_users.sql` backfills `users.workspace_id`
 * and then enforces `NOT NULL`. `createUserWithLink()` was taught to resolve the
 * seeded `personal` workspace before it inserts, but `UserManager.createUser()`
 * — the path `/api/auth/register` uses — still inserted the user row without
 * `workspace_id`, so registration raised PostgreSQL `23502` and answered `500`.
 *
 * Two behaviours are pinned here:
 *
 *   - the INSERT always carries a resolved `workspace_id`, so `23502` cannot
 *     happen on this path
 *   - when no `personal` workspace exists the call fails explicitly, before any
 *     INSERT is issued, with an error the route can name
 *
 * pg is mocked with a scripted fake pool, so the statements are observed rather
 * than inferred.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryHandler = (
  text: string,
  params?: unknown[],
) => Promise<{ rows: unknown[]; rowCount: number }>

interface RecordedQuery {
  text: string
  params?: unknown[]
}

interface FakeClient {
  queries: RecordedQuery[]
  handler: QueryHandler
  query: (text: string, params?: unknown[]) => Promise<unknown>
  release: (destroy?: unknown) => void
}

const { FakePool, hooks } = vi.hoisted(() => {
  const state = { handlers: [] as QueryHandler[] }

  const emptyHandler: QueryHandler = async () => ({ rows: [], rowCount: 0 })

  class FakePoolClient implements FakeClient {
    queries: RecordedQuery[] = []
    handler: QueryHandler

    constructor(handler?: QueryHandler) {
      this.handler = handler ?? emptyHandler
    }

    query = (text: string, params?: unknown[]): Promise<unknown> => {
      this.queries.push({ text, params })
      return this.handler(text, params)
    }

    release = () => undefined
  }

  class FakePool {
    static instances: FakePool[] = []

    readonly clients: FakePoolClient[] = []
    ended = false

    constructor() {
      FakePool.instances.push(this)
    }

    on(): this {
      return this
    }

    connect(): Promise<FakePoolClient> {
      const handler = state.handlers.shift()
      const client = new FakePoolClient(handler)
      this.clients.push(client)
      return Promise.resolve(client)
    }

    async end(): Promise<void> {
      this.ended = true
    }
  }

  return { FakePool, hooks: state }
})

vi.mock('pg', () => ({
  Pool: FakePool,
  PoolClient: class {},
}))

import { closeDatabase, initializeDatabase, userManager } from '../index'
import { WorkspaceResolutionError } from '../workspace'

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'
const USER_ID = 'b6f0f9b7-5b4f-4f6a-9f9a-3a1b2c3d4e5f'

const userInput = {
  email: 'trainee@example.test',
  passwordHash: 'hashed-password',
  firstName: 'Test',
  lastName: 'Trainee',
  role: 'user',
}

/** Every statement the call issued, across all clients. */
const allQueries = (): RecordedQuery[] =>
  FakePool.instances.flatMap((pool) => pool.clients).flatMap((c) => c.queries)

const selectWorkspace: QueryHandler = async () => ({
  rows: [{ id: WORKSPACE_ID }],
  rowCount: 1,
})

const insertUser: QueryHandler = async () => ({
  rows: [{ id: USER_ID }],
  rowCount: 1,
})

beforeEach(() => {
  FakePool.instances = []
  hooks.handlers = []
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('DB_HOST', 'localhost')
  vi.stubEnv('DB_CONNECTION_TIMEOUT', '')
  vi.stubEnv('DB_ACQUIRE_TIMEOUT', '')
  vi.stubEnv('DB_STATEMENT_TIMEOUT', '')
  vi.stubEnv('DB_QUERY_TIMEOUT', '')
  vi.stubEnv('DB_LIVENESS_PROBE_TIMEOUT', '')
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('UserManager.createUser: workspace resolution', () => {
  it('resolves the seeded personal workspace and supplies it on the INSERT', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 40 })
    hooks.handlers = [selectWorkspace, insertUser]

    const userId = await userManager.createUser(userInput)
    expect(userId).toBe(USER_ID)

    const [workspaceRead, insert] = allQueries()

    expect(workspaceRead.text).toMatch(/FROM\s+workspaces/i)
    expect(workspaceRead.text).toMatch(/slug\s*=\s*\$1/i)
    expect(workspaceRead.params).toEqual(['personal'])

    // `users.workspace_id` is NOT NULL with no default (migration 011), so the
    // INSERT must name it and carry the resolved value.
    expect(insert.text).toMatch(/INSERT\s+INTO\s+users/i)
    expect(insert.text).toMatch(/workspace_id/i)
    expect(insert.params).toContain(WORKSPACE_ID)
  })

  it('fails explicitly and writes no user when no default workspace exists', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 40 })
    hooks.handlers = [async () => ({ rows: [], rowCount: 0 }), insertUser]

    await expect(userManager.createUser(userInput)).rejects.toBeInstanceOf(
      WorkspaceResolutionError,
    )

    // The failure happens before the user row is attempted: an INSERT without
    // a workspace would be the 23502 this repair exists to remove.
    expect(
      allQueries().filter((entry) => /INSERT\s+INTO\s+users/i.test(entry.text)),
    ).toHaveLength(0)
  })

  it('names the missing workspace in the error message', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 40 })
    hooks.handlers = [async () => ({ rows: [], rowCount: 0 })]

    await expect(userManager.createUser(userInput)).rejects.toThrow(
      /no 'personal' workspace/i,
    )
  })
})
