/** @vitest-environment node */

/**
 * First-login provisioning regressions.
 *
 * Two defects in `resolveIdentity()` / `createUserWithLink()`:
 *
 * 1. The `users` INSERT omits `workspace_id`, which migration 011 makes
 *    `NOT NULL` with no default. A sub with no `auth_accounts` link therefore
 *    raises `23502`, the transaction rolls back, and every later request for
 *    that identity is denied. The row must be created against the platform's
 *    existing default workspace (the seeded `personal` row that migration 011
 *    backfills every legacy user to), and the login must fail explicitly when
 *    no such workspace can be determined.
 *
 * 2. When no `auth_accounts` link exists, the provisioning path upserts on
 *    `users.email`. A token without an email claim supplies `''`, which is
 *    UNIQUE, so two distinct subs collapse onto one internal user. An absent or
 *    empty email must never reach that INSERT; the resolver returns its
 *    unresolvable-identity outcome (`internalId: null`) instead.
 *
 * The token-validation path strips email from the validated payload, so a real
 * first login arrives without one. The provider is asked for the email only
 * when a link is missing, and that lookup is bounded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockTransaction,
  mockAcquireClient,
  mockGetFromCache,
  mockSetInCache,
  mockProvider,
} = vi.hoisted(() => ({
    mockTransaction: vi.fn(),
    mockAcquireClient: vi.fn(),
    mockGetFromCache: vi.fn(),
    mockSetInCache: vi.fn(),
    mockProvider: {
      name: 'auth0',
      validateToken: vi.fn(),
      getUserById: vi.fn(),
      findInternalIdBySub: vi.fn(),
      linkSubToInternalId: vi.fn(),
      findSubByInternalId: vi.fn(),
    },
  }))

vi.mock('../../db/index', () => ({
  transaction: mockTransaction,
  acquireClient: mockAcquireClient,
}))
vi.mock('../../redis', () => ({
  getFromCache: mockGetFromCache,
  setInCache: mockSetInCache,
  removeFromCache: vi.fn(),
}))
vi.mock('../identity-provider', () => ({
  getIdentityProvider: () => mockProvider,
}))

import * as userIdentity from '../user-identity'

/** The seeded default workspace (db/migrations/010_create_workspaces_table.sql). */
const PERSONAL_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'
const EXISTING_INTERNAL_UUID = '6cf52d73-8188-487f-a1c6-4ebc014328c0'

interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

interface RecordedInsert {
  columns: string[]
  values: Record<string, unknown>
}

interface FakeClient {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>
}

interface FakeDatabase {
  client: FakeClient
  inserts: RecordedInsert[]
  /** Rows the fake `users` table holds, keyed by email. */
  usersByEmail: Map<string, { id: string; role: string; workspaceId: unknown }>
}

/**
 * Parse `INSERT INTO users (<columns>) VALUES (<exprs>)` into a column/value
 * map so the assertion names the column instead of a positional index. The
 * pinned code and the repaired code use different column lists; parsing keeps
 * the failure message about `workspace_id` either way.
 */
function parseInsert(sql: string, params: unknown[]): RecordedInsert | null {
  const match = sql.match(
    /INSERT INTO users\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/i,
  )
  if (!match) return null
  const columns = match[1].split(',').map((column) => column.trim())
  const expressions = match[2].split(',').map((expression) => expression.trim())
  const values: Record<string, unknown> = {}
  expressions.forEach((expression, index) => {
    const column = columns[index]
    if (!column) return
    const parameter = expression.match(/^\$(\d+)$/)
    values[column] = parameter
      ? params[Number(parameter[1]) - 1]
      : expression.replace(/^'(.*)'$/, '$1')
  })
  return { columns, values }
}

/**
 * A minimal stand-in for the `PoolClient` inside the provisioning transaction.
 *
 * `enforceWorkspaceNotNull` mirrors the production constraint: an INSERT whose
 * `workspace_id` is missing or null raises `23502`, exactly as the live
 * database does. Without that, a test would "pass" on an insert the database
 * would have rejected.
 */
function createFakeDatabase(
  options: {
    personalWorkspace?: string | null
    enforceWorkspaceNotNull?: boolean
  } = {},
): FakeDatabase {
  const inserts: RecordedInsert[] = []
  const usersByEmail = new Map<
    string,
    { id: string; role: string; workspaceId: unknown }
  >()

  const client: FakeClient = {
    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
      const normalized = sql.replace(/\s+/g, ' ').trim()

      if (/^SELECT .*FROM workspaces/i.test(normalized)) {
        if (options.personalWorkspace === null) {
          return { rows: [], rowCount: 0 }
        }
        return {
          rows: [{ id: options.personalWorkspace ?? PERSONAL_WORKSPACE_ID }],
          rowCount: 1,
        }
      }

      if (/^INSERT INTO users/i.test(normalized)) {
        const insert = parseInsert(normalized, params)
        if (!insert) throw new Error(`unparseable INSERT: ${normalized}`)
        inserts.push(insert)

        const workspaceId = insert.values['workspace_id']
        if (options.enforceWorkspaceNotNull && !workspaceId) {
          const error = new Error(
            'null value in column "workspace_id" of relation "users" violates not-null constraint',
          ) as Error & { code: string }
          error.code = '23502'
          throw error
        }

        const email = String(insert.values['email'])
        usersByEmail.set(email, {
          id: String(insert.values['id']),
          role: String(insert.values['role']),
          workspaceId,
        })
        return { rows: [], rowCount: 1 }
      }

      if (/^SELECT id, role FROM users WHERE email/i.test(normalized)) {
        const row = usersByEmail.get(String(params[0]))
        return row
          ? { rows: [{ id: row.id, role: row.role }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
      }

      throw new Error(`unexpected query: ${normalized}`)
    },
  }

  return { client, inserts, usersByEmail }
}

function useDatabase(database: FakeDatabase): void {
  // The link lookup runs on a pooled client before the transaction opens, so
  // both paths are served by the same fake database.
  mockAcquireClient.mockResolvedValue({
    query: database.client.query,
    release: () => {},
  })
  mockTransaction.mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) =>
      callback(database.client),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAcquireClient.mockResolvedValue({
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  })
  mockGetFromCache.mockResolvedValue(null)
  mockSetInCache.mockResolvedValue(true)
  mockProvider.linkSubToInternalId.mockResolvedValue(undefined)
  mockProvider.getUserById.mockResolvedValue(null)
})

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('first-login provisioning assigns a workspace', () => {
  it('creates a usable users row against the seeded personal workspace', async () => {
    const database = createFakeDatabase({ enforceWorkspaceNotNull: true })
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)

    const identity = await userIdentity.resolveIdentity({
      sub: 'auth0|new-therapist',
      email: 'new-therapist@example.test',
      emailVerified: true,
      role: 'therapist',
    })

    expect(identity.internalId).toBeTruthy()
    expect(identity.isNewUser).toBe(true)
    expect(database.inserts).toHaveLength(1)
    expect(database.inserts[0].values['workspace_id']).toBe(
      PERSONAL_WORKSPACE_ID,
    )
    expect(mockProvider.getUserById).not.toHaveBeenCalled()
    expect(mockProvider.linkSubToInternalId).toHaveBeenCalledWith(
      'auth0|new-therapist',
      identity.internalId,
      database.client,
    )
  })

  it('provisions from the provider email when the token carries none', async () => {
    const database = createFakeDatabase({ enforceWorkspaceNotNull: true })
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)
    mockProvider.getUserById.mockResolvedValue({
      id: 'auth0|token-without-email',
      email: 'from-provider@example.test',
      role: 'therapist',
    })

    const identity = await userIdentity.resolveIdentity({
      sub: 'auth0|token-without-email',
      email: '',
      emailVerified: false,
    })

    expect(identity.internalId).toBeTruthy()
    expect(identity.email).toBe('from-provider@example.test')
    expect(mockProvider.getUserById).toHaveBeenCalledWith(
      'auth0|token-without-email',
    )
    expect(database.inserts).toHaveLength(1)
    expect(database.inserts[0].values['email']).toBe(
      'from-provider@example.test',
    )
    expect(database.inserts[0].values['workspace_id']).toBe(
      PERSONAL_WORKSPACE_ID,
    )
  })

  it('fails explicitly and writes no row when no workspace can be determined', async () => {
    const database = createFakeDatabase({ personalWorkspace: null })
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)

    await expect(
      userIdentity.resolveIdentity({
        sub: 'auth0|unassignable',
        email: 'unassignable@example.test',
        emailVerified: true,
      }),
    ).rejects.toThrow(/workspace/i)

    expect(database.inserts).toHaveLength(0)
    expect(mockProvider.linkSubToInternalId).not.toHaveBeenCalled()
  })
})

describe('an absent or empty email claim never reaches the unique insert', () => {
  it('returns the unresolvable identity for an empty email claim', async () => {
    const database = createFakeDatabase()
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)

    const identity = await userIdentity.resolveIdentity({
      sub: 'auth0|empty-email',
      email: '',
      emailVerified: false,
    })

    expect(identity.internalId).toBeNull()
    expect(identity.isNewUser).toBe(false)
    expect(database.inserts).toHaveLength(0)
  })

  it('returns the unresolvable identity when the email claim is absent', async () => {
    const database = createFakeDatabase()
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)

    const identity = await userIdentity.resolveIdentity({
      sub: 'auth0|missing-email',
    } as userIdentity.Auth0UserProfile)

    expect(identity.internalId).toBeNull()
    expect(database.inserts).toHaveLength(0)
  })

  it('treats a whitespace-only email claim as absent', async () => {
    const database = createFakeDatabase()
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)

    const identity = await userIdentity.resolveIdentity({
      sub: 'auth0|blank-email',
      email: '   ',
      emailVerified: false,
    })

    expect(identity.internalId).toBeNull()
    expect(database.inserts).toHaveLength(0)
  })

  it('does not coalesce two distinct subs that carry no email claim', async () => {
    const database = createFakeDatabase()
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)

    const first = await userIdentity.resolveIdentity({
      sub: 'auth0|sub-a',
      email: '',
      emailVerified: false,
    })
    const second = await userIdentity.resolveIdentity({
      sub: 'auth0|sub-b',
      email: '',
      emailVerified: false,
    })

    expect(first.internalId).toBeNull()
    expect(second.internalId).toBeNull()
    expect(database.inserts).toHaveLength(0)
    expect(database.usersByEmail.size).toBe(0)
  })

  it('still resolves an already-linked sub that carries no email claim', async () => {
    const database = createFakeDatabase()
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue({
      internalId: EXISTING_INTERNAL_UUID,
      role: 'therapist',
    })

    const identity = await userIdentity.resolveIdentity({
      sub: 'auth0|linked-without-email',
      email: '',
      emailVerified: false,
    })

    expect(identity.internalId).toBe(EXISTING_INTERNAL_UUID)
    expect(database.inserts).toHaveLength(0)
    expect(mockProvider.getUserById).not.toHaveBeenCalled()
  })
})

describe('the provider lookup used for a missing email is bounded', () => {
  it('pins the provider profile deadline at 1.5s', () => {
    expect(userIdentity.PROVIDER_PROFILE_DEADLINE_MS).toBe(1_500)
  })

  it('does not hold the request open when the provider never answers', async () => {
    vi.useFakeTimers()
    const database = createFakeDatabase()
    useDatabase(database)
    mockProvider.findInternalIdBySub.mockResolvedValue(null)
    mockProvider.getUserById.mockReturnValue(new Promise(() => {}))

    let settled: unknown
    const pending = userIdentity
      .resolveIdentity({
        sub: 'auth0|stalled-provider',
        email: '',
        emailVerified: false,
      })
      .catch((error: unknown) => {
        settled = error
      })
    await vi.advanceTimersByTimeAsync(userIdentity.PROVIDER_PROFILE_DEADLINE_MS)
    await pending

    expect(settled).toBeInstanceOf(Error)
    expect((settled as Error).message).toMatch(/deadline/i)
    expect(database.inserts).toHaveLength(0)
  })
})
