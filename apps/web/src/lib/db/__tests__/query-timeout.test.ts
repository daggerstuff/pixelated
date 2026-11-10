/**
 * Bounds on a query issued against a pooled Postgres client.
 *
 * Measured on `a24ab11d9` / Worker `e9aed1a4`: 35 of 35 successful session
 * loads logged `New client connected to database` and 38 of 38 deadline legs
 * logged none. A deadline leg therefore reuses a pooled client whose socket
 * never answers, and nothing bounds the statement on it — the pool set
 * `connectionTimeoutMillis` and `idleTimeoutMillis` but no `query_timeout`,
 * so the route's 8 s deadline was the only thing that ended the request.
 *
 * These tests drive the two shapes that stall: a statement issued through
 * `query()`, and the `BEGIN` of `resolveIdentity`'s slow-path `transaction()`.
 * They also cover the pool-level bound that covers every caller (a
 * `Query read timeout` raised by pg from inside a transaction callback), the
 * unchanged healthy path, the recycle of a client that outlived its lifetime,
 * and the acquire log line that separates a new client from a reused one.
 *
 * pg is mocked with a fake pool whose `connect()` and query behaviour are
 * scripted per call, so the hang paths can be driven without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryHandler = (text: string) => Promise<unknown>

type Behaviour =
  | { kind: 'resolve'; queryHandler?: QueryHandler }
  | { kind: 'reuse'; client: FakePoolClient }
  | { kind: 'hang' }
  | { kind: 'reject'; error: unknown }

const { FakePool, FakePoolClient, hooks } = vi.hoisted(() => {
  const state = {
    behaviours: [] as Behaviour[],
    error: null as unknown,
  }

  class FakePoolClient {
    releasedWith: unknown[] = []
    queries: string[] = []
    private readonly queryHandler: QueryHandler

    constructor(queryHandler?: QueryHandler) {
      this.queryHandler =
        queryHandler ??
        (async () => ({ rows: [], rowCount: 0, command: 'SELECT' }))
    }

    query = (text: string): Promise<unknown> => {
      this.queries.push(text)
      return this.queryHandler(text)
    }

    release = (destroy?: unknown) => {
      this.releasedWith.push(destroy)
    }
  }

  class FakePool {
    static instances: FakePool[] = []

    readonly options: Record<string, unknown>
    readonly clients: FakePoolClient[] = []
    ended = false
    private errorListener: ((err: unknown) => void) | null = null
    private connectListener: ((client: FakePoolClient) => void) | null = null

    constructor(options: Record<string, unknown>) {
      this.options = options
      FakePool.instances.push(this)
    }

    on(event: string, listener: (arg: never) => void): this {
      if (event === 'error') this.errorListener = listener
      if (event === 'connect') this.connectListener = listener
      return this
    }

    connect(): Promise<FakePoolClient> {
      const behaviour = state.behaviours.shift() ?? { kind: 'resolve' }
      switch (behaviour.kind) {
        case 'hang':
          return new Promise<FakePoolClient>(() => {})
        case 'reject':
          return Promise.reject(behaviour.error)
        case 'reuse':
          return Promise.resolve(behaviour.client)
        case 'resolve':
        default: {
          const client = new FakePoolClient(behaviour.queryHandler)
          this.clients.push(client)
          // pg-pool emits 'connect' for a freshly created client only; a
          // reused client is handed back without the event.
          this.connectListener?.(client)
          return Promise.resolve(client)
        }
      }
    }

    async end(): Promise<void> {
      this.ended = true
    }

    getErrorListener(): ((err: unknown) => void) | null {
      return this.errorListener
    }
  }

  return { FakePool, FakePoolClient, hooks: state }
})

vi.mock('pg', () => ({
  Pool: FakePool,
  PoolClient: FakePoolClient,
}))

import {
  acquireClient,
  closeDatabase,
  DatabaseUnavailableError,
  DB_MAX_LIFETIME_SECONDS,
  DB_QUERY_TIMEOUT_MS,
  initializeDatabase,
  isDatabaseUnavailableError,
  query,
  transaction,
} from '../index'

/** The route's request deadline (`TRAINING_DATA_DEADLINE_MS`). */
const REQUEST_DEADLINE_MS = 8_000

/** How long a hung statement may take before the test calls it a stall. */
const STALL_GUARD_MS = 1_000

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => ({ kind: 'resolved' as const }),
    (error: unknown) => ({ kind: 'rejected' as const, error }),
  )

const stallGuard = () =>
  new Promise<{ kind: 'stalled' }>((resolve) => {
    setTimeout(() => resolve({ kind: 'stalled' }), STALL_GUARD_MS)
  })

const neverSettles = () => new Promise<never>(() => {})

const lastClient = () => {
  const pool = FakePool.instances.at(-1)
  return pool?.clients.at(-1)
}

beforeEach(() => {
  FakePool.instances = []
  hooks.behaviours = []
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('DB_HOST', 'localhost')
  // The checkout's .env sets DB_* variables; pin the defaults here so the
  // assertions below test the code, not the local environment.
  vi.stubEnv('DB_CONNECTION_TIMEOUT', '')
  vi.stubEnv('DB_ACQUIRE_TIMEOUT', '')
  vi.stubEnv('DB_STATEMENT_TIMEOUT', '')
  vi.stubEnv('DB_QUERY_TIMEOUT', '')
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('query bound on a pooled client', () => {
  it('rejects a statement that never settles inside the bound, as a retryable failure', async () => {
    initializeDatabase({ queryTimeoutMillis: 50 })
    hooks.behaviours = [{ kind: 'resolve', queryHandler: () => neverSettles() }]

    const started = Date.now()
    const outcome = await Promise.race([
      settle(query('SELECT 1')),
      stallGuard(),
    ])
    const elapsed = Date.now() - started

    // The pinned code has no bound at all: this is 'stalled', and the
    // assertion below is the failing evidence for the deadline leg.
    expect(outcome.kind).toBe('rejected')
    expect(
      outcome.kind === 'rejected' &&
        outcome.error instanceof DatabaseUnavailableError,
    ).toBe(true)
    expect(
      outcome.kind === 'rejected' && isDatabaseUnavailableError(outcome.error),
    ).toBe(true)
    expect(elapsed).toBeLessThan(STALL_GUARD_MS)

    // A client whose statement exceeded the bound is destroyed, not returned
    // to the idle list with a half-consumed protocol stream.
    expect(lastClient()?.releasedWith).toEqual([true])
  })

  it('rejects a hung BEGIN in transaction() without attempting ROLLBACK on the dead socket', async () => {
    initializeDatabase({ queryTimeoutMillis: 50 })
    hooks.behaviours = [{ kind: 'resolve', queryHandler: () => neverSettles() }]
    const callback = vi.fn(async () => 'unreachable')

    const outcome = await Promise.race([
      settle(transaction(callback)),
      stallGuard(),
    ])

    expect(outcome.kind).toBe('rejected')
    expect(
      outcome.kind === 'rejected' &&
        outcome.error instanceof DatabaseUnavailableError,
    ).toBe(true)
    expect(callback).not.toHaveBeenCalled()

    const client = lastClient()
    // ROLLBACK on a socket that never answers would just wait for the same
    // bound again, so the dead client is destroyed instead.
    expect(client?.queries).toEqual(['BEGIN'])
    expect(client?.releasedWith).toEqual([true])
  })

  it('normalizes a pool-level Query read timeout raised inside a transaction callback', async () => {
    // pg's own `query_timeout` covers statements a caller issues on the client
    // it was handed, which this module cannot wrap. It surfaces as an Error
    // with the message `Query read timeout`.
    initializeDatabase({ queryTimeoutMillis: 50 })
    hooks.behaviours = [
      {
        kind: 'resolve',
        queryHandler: async (text) => {
          if (text === 'BEGIN') return { rows: [], rowCount: 0 }
          throw new Error('Query read timeout')
        },
      },
    ]

    const outcome = await Promise.race([
      settle(
        transaction(async (client) => {
          await client.query('SELECT * FROM users WHERE auth0_sub = $1', [
            'sub',
          ])
          return 'unreachable'
        }),
      ),
      stallGuard(),
    ])

    expect(outcome.kind).toBe('rejected')
    expect(
      outcome.kind === 'rejected' &&
        outcome.error instanceof DatabaseUnavailableError,
    ).toBe(true)

    const client = lastClient()
    expect(client?.queries).toEqual([
      'BEGIN',
      'SELECT * FROM users WHERE auth0_sub = $1',
    ])
    expect(client?.releasedWith).toEqual([true])
  })
})

describe('healthy path is unchanged', () => {
  it('returns rows from query() and releases the client without destroying it', async () => {
    initializeDatabase({ queryTimeoutMillis: 50 })
    hooks.behaviours = [
      {
        kind: 'resolve',
        queryHandler: async (text) => ({
          rows: [{ statement: text }],
          rowCount: 1,
        }),
      },
    ]

    const result = await query<{ statement: string }>('SELECT 1')

    expect(result.rows).toEqual([{ statement: 'SELECT 1' }])
    expect(lastClient()?.releasedWith).toEqual([undefined])
  })

  it('runs BEGIN, the callback and COMMIT in order and releases cleanly', async () => {
    initializeDatabase({ queryTimeoutMillis: 50 })
    hooks.behaviours = [{ kind: 'resolve' }]

    const result = await transaction(async (client) => {
      await client.query('INSERT INTO sessions DEFAULT VALUES')
      return 'committed'
    })

    expect(result).toBe('committed')
    const client = lastClient()
    expect(client?.queries).toEqual([
      'BEGIN',
      'INSERT INTO sessions DEFAULT VALUES',
      'COMMIT',
    ])
    expect(client?.releasedWith).toEqual([undefined])
  })
})

describe('idle client recycling', () => {
  it('destroys a client past its lifetime bound instead of handing it to a query', async () => {
    initializeDatabase({ clientLifetimeSeconds: 0.05 })
    hooks.behaviours = [{ kind: 'resolve' }]

    const first = await acquireClient()
    first.release()
    const stale = lastClient()
    expect(stale).toBeTruthy()

    // Let the client outlive `maxLifetimeSeconds` (50 ms).
    await new Promise((resolve) => setTimeout(resolve, 80))

    // The pool would hand the same socket back on the next checkout.
    hooks.behaviours = [{ kind: 'reuse', client: stale! }, { kind: 'resolve' }]
    const second = await acquireClient()

    expect(second).not.toBe(stale)
    expect(stale?.releasedWith).toContain(true)
    expect(FakePool.instances.at(-1)?.clients).toHaveLength(2)
  })

  it('does not recycle when the lifetime bound is disabled', async () => {
    initializeDatabase({ clientLifetimeSeconds: 0 })
    hooks.behaviours = [{ kind: 'resolve' }]

    const first = await acquireClient()
    first.release()
    await new Promise((resolve) => setTimeout(resolve, 80))

    hooks.behaviours = [{ kind: 'reuse', client: first as never }]
    const second = await acquireClient()

    expect(second).toBe(first)
    expect(first.releasedWith).not.toContain(true)
  })
})

describe('acquireClient log line', () => {
  it('separates a new client from a reused one', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    initializeDatabase()
    hooks.behaviours = [{ kind: 'resolve' }]

    const first = await acquireClient()
    first.release()

    hooks.behaviours = [{ kind: 'reuse', client: first as never }]
    const second = await acquireClient()
    second.release()

    const acquireLines = info.mock.calls
      .map((args) => args.join(' '))
      .filter((line) => line.includes('Acquired database client'))

    expect(acquireLines).toHaveLength(2)
    expect(acquireLines[0]).toContain('Acquired database client: new')
    expect(acquireLines[1]).toContain('Acquired database client: reused')
  })
})

describe('the pool is configured with the client-side bounds', () => {
  it('sets query_timeout and keepalive, all inside the route deadline', () => {
    initializeDatabase()

    const options = FakePool.instances[0]?.options ?? {}
    expect(options.query_timeout).toBe(DB_QUERY_TIMEOUT_MS)
    expect(options.keepAlive).toBe(true)

    // pg-pool's own `maxLifetimeSeconds` calls `.unref()` on a timer that is a
    // number in the Workers runtime, which throws on every new client. The
    // lifetime bound is enforced by acquireClient instead.
    expect(options.maxLifetimeSeconds).toBeUndefined()

    // Short enough to fail well inside the 8 s route deadline, long enough
    // that a healthy statement (measured at 94–263 ms to first query after
    // connect, 1 188 ms worst-case connect) never trips it.
    expect(DB_QUERY_TIMEOUT_MS).toBeLessThan(REQUEST_DEADLINE_MS)
    expect(DB_QUERY_TIMEOUT_MS).toBeGreaterThan(1_000)

    // The client-lifetime bound is on by default.
    expect(DB_MAX_LIFETIME_SECONDS).toBeGreaterThan(0)
  })

  it('keeps the default when DB_QUERY_TIMEOUT is set but empty', () => {
    vi.stubEnv('DB_QUERY_TIMEOUT', '')
    initializeDatabase()

    expect(FakePool.instances[0]?.options.query_timeout).toBe(
      DB_QUERY_TIMEOUT_MS,
    )
  })

  it('honours an explicit DB_QUERY_TIMEOUT override', () => {
    vi.stubEnv('DB_QUERY_TIMEOUT', '1500')
    initializeDatabase()

    expect(FakePool.instances[0]?.options.query_timeout).toBe(1_500)
  })
})
