/**
 * Liveness probe on a borrowed pooled Postgres client.
 *
 * Measured on `249c558c4` / Worker `7542a5d3` (evidence
 * `availability-remeasure-249c558c4-2026-11-10.md` §6): every failing leg was
 * served by a **reused** pooled client whose socket never answered, and every
 * success was served by one the pool had just opened. The 4 000 ms query bound
 * turns that into a bounded failure, and the 60 s lifetime recycle catches a
 * client that outlived its bound, but neither stops a socket that died well
 * inside 60 s from being handed to a statement.
 *
 * These tests drive the three outcomes that matter:
 *
 *   - a reused client whose probe never settles is destroyed and replaced
 *     before the caller's statement, which then succeeds on the replacement
 *   - a healthy reused client is handed out unchanged, with exactly one probe
 *     and no destruction
 *   - a probe failure never surfaces to the caller as a bare failure it cannot
 *     retry: it is a `DatabaseUnavailableError`, which the routes map to a
 *     retryable 503, and it is never a client the caller may use
 *
 * They also pin the cost side: a client the pool just created is not probed, so
 * a healthy acquire pays one extra round trip only when the client was reused.
 *
 * pg is mocked with a fake pool whose `connect()` and query behaviour are
 * scripted per call, so a dead socket can be driven without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryHandler = (text: string) => Promise<unknown>

interface FakeClient {
  releasedWith: unknown[]
  queries: string[]
  handler: QueryHandler
  query: (text: string, params?: unknown[]) => Promise<unknown>
  release: (destroy?: unknown) => void
}

type Behaviour =
  | { kind: 'resolve'; queryHandler?: QueryHandler }
  | { kind: 'reuse'; client: FakeClient }

const { FakePool, hooks } = vi.hoisted(() => {
  const state = { behaviours: [] as Behaviour[] }

  const defaultHandler: QueryHandler = async () => ({
    rows: [],
    rowCount: 0,
    command: 'SELECT',
  })

  class FakePoolClient implements FakeClient {
    releasedWith: unknown[] = []
    queries: string[] = []
    handler: QueryHandler

    constructor(queryHandler?: QueryHandler) {
      this.handler = queryHandler ?? defaultHandler
    }

    query = (text: string): Promise<unknown> => {
      this.queries.push(text)
      return this.handler(text)
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
    private connectListener: ((client: FakePoolClient) => void) | null = null

    constructor(options: Record<string, unknown>) {
      this.options = options
      FakePool.instances.push(this)
    }

    on(event: string, listener: (arg: never) => void): this {
      if (event === 'connect') this.connectListener = listener
      return this
    }

    connect(): Promise<FakePoolClient> {
      const behaviour = state.behaviours.shift() ?? { kind: 'resolve' }
      if (behaviour.kind === 'reuse') {
        return Promise.resolve(behaviour.client as FakePoolClient)
      }
      const client = new FakePoolClient(behaviour.queryHandler)
      this.clients.push(client)
      // pg-pool emits 'connect' for a freshly created client only; a reused
      // client is handed back without the event.
      this.connectListener?.(client)
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

import {
  acquireClient,
  closeDatabase,
  DatabaseUnavailableError,
  DB_LIVENESS_PROBE_TIMEOUT_MS,
  DB_MAX_LIFETIME_SECONDS,
  DB_QUERY_TIMEOUT_MS,
  initializeDatabase,
  isDatabaseUnavailableError,
  query,
} from '../index'

/** The probe statement: a trivial round trip, not a caller query. */
const PROBE = 'SELECT 1'

const neverSettles = () => new Promise<never>(() => {})

const stallGuard = (ms = 1_000) =>
  new Promise<{ kind: 'stalled' }>((resolve) => {
    setTimeout(() => resolve({ kind: 'stalled' }), ms)
  })

const lastClient = () => {
  const pool = FakePool.instances.at(-1)
  return pool?.clients.at(-1)
}

/** Acquire a client, release it, and hand back the fake for scripting. */
async function acquireThenRelease(): Promise<FakeClient> {
  hooks.behaviours = [{ kind: 'resolve' }]
  const client = (await acquireClient()) as unknown as FakeClient
  client.release()
  client.releasedWith.length = 0
  return client
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
  vi.stubEnv('DB_LIVENESS_PROBE_TIMEOUT', '')
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('a reused client that fails its liveness probe', () => {
  it('is destroyed and replaced before the caller statement, which then succeeds', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 40 })
    const stale = await acquireThenRelease()

    // The pooled socket is dead: nothing written to it ever answers.
    stale.handler = () => neverSettles()

    hooks.behaviours = [
      { kind: 'reuse', client: stale },
      {
        kind: 'resolve',
        queryHandler: async (text) => ({
          rows: [{ statement: text }],
          rowCount: 1,
        }),
      },
    ]

    const started = Date.now()
    const outcome = await Promise.race([
      query<{ statement: string }>('SELECT id FROM sessions'),
      stallGuard(),
    ])
    const elapsed = Date.now() - started

    // The caller's statement ran, on a client that answers.
    expect(outcome).not.toEqual({ kind: 'stalled' })
    expect(outcome).toEqual({
      rows: [{ statement: 'SELECT id FROM sessions' }],
      rowCount: 1,
    } as never)

    // The dead client saw the probe and nothing else, and was destroyed rather
    // than returned to the idle list with an unanswered statement on it.
    expect(stale.queries).toEqual([PROBE])
    expect(stale.releasedWith).toEqual([true])

    // The caller's statement ran on the replacement, which was not probed
    // because the pool had just created it.
    const replacement = lastClient()
    expect(replacement).not.toBe(stale)
    expect(replacement?.queries).toEqual(['SELECT id FROM sessions'])

    // The probe bound is a few hundred milliseconds, well inside the query
    // bound — the trip costs a fraction of the 4 s ceiling.
    expect(elapsed).toBeLessThan(DB_QUERY_TIMEOUT_MS)
    expect(DB_LIVENESS_PROBE_TIMEOUT_MS).toBeLessThan(DB_QUERY_TIMEOUT_MS / 4)
  })

  it('logs a distinct probe-trip line, separate from the acquire line', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    initializeDatabase({ livenessProbeTimeoutMillis: 20 })
    const stale = await acquireThenRelease()
    stale.handler = () => neverSettles()
    info.mockClear()

    hooks.behaviours = [{ kind: 'reuse', client: stale }, { kind: 'resolve' }]
    const replacement = await acquireClient()
    replacement.release()

    const warnLines = warn.mock.calls.map((args) => args.join(' '))
    expect(
      warnLines.filter((line) => line.includes('failed its liveness probe')),
    ).toHaveLength(1)

    // The acquire line is unchanged and still describes the client that was
    // actually handed over: the replacement the pool just opened.
    const acquireLines = info.mock.calls
      .map((args) => args.join(' '))
      .filter((line) => line.includes('Acquired database client'))
    expect(acquireLines).toEqual([
      expect.stringContaining('Acquired database client: new'),
    ])
  })
})

describe('a healthy reused client', () => {
  it('is handed out unchanged, probed exactly once, and not destroyed', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 40 })
    const client = await acquireThenRelease()

    hooks.behaviours = [{ kind: 'reuse', client }]
    const again = await acquireClient()

    expect(again).toBe(client)
    expect(client.queries).toEqual([PROBE])
    expect(client.releasedWith).toEqual([])

    again.release()
    expect(client.releasedWith).toEqual([undefined])
  })

  it('is not probed when the pool has just created it', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 40 })

    hooks.behaviours = [{ kind: 'resolve' }]
    const fresh = (await acquireClient()) as unknown as FakeClient

    expect(fresh.queries).toEqual([])
    expect(fresh.releasedWith).toEqual([])
    fresh.release()
  })

  it('can be disabled with a zero bound, leaving a reused client unprobed', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 0 })
    const client = await acquireThenRelease()

    hooks.behaviours = [{ kind: 'reuse', client }]
    const again = await acquireClient()

    expect(again).toBe(client)
    expect(client.queries).toEqual([])
    again.release()
  })
})

describe('a probe failure the replacement cannot recover from', () => {
  it('surfaces as a retryable availability error, never as an unusable client', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 20 })
    const first = await acquireThenRelease()
    const second = await acquireThenRelease()
    first.handler = () => neverSettles()
    second.handler = () => neverSettles()

    hooks.behaviours = [
      { kind: 'reuse', client: first },
      { kind: 'reuse', client: second },
    ]

    const error = await query('SELECT 1').then(
      () => null,
      (caught: unknown) => caught,
    )

    // The routes answer `DatabaseUnavailableError` with a retryable 503 +
    // `Retry-After`; anything else on this path is a 500.
    expect(error).toBeInstanceOf(DatabaseUnavailableError)
    expect(isDatabaseUnavailableError(error)).toBe(true)

    // Neither dead client was handed to the caller.
    expect(first.queries).toEqual([PROBE])
    expect(second.queries).toEqual([PROBE])
    expect(first.releasedWith).toEqual([true])
    expect(second.releasedWith).toEqual([true])
  })
})

describe('the existing bounds are unchanged', () => {
  it('keeps the 4 000 ms query bound and the 60 s lifetime recycle', () => {
    initializeDatabase()

    expect(DB_QUERY_TIMEOUT_MS).toBe(4_000)
    expect(DB_MAX_LIFETIME_SECONDS).toBe(60)

    const options = FakePool.instances[0]?.options ?? {}
    expect(options.query_timeout).toBe(DB_QUERY_TIMEOUT_MS)

    // The probe has its own short bound; it never widens the statement bound.
    expect(DB_LIVENESS_PROBE_TIMEOUT_MS).toBeGreaterThan(0)
    expect(DB_LIVENESS_PROBE_TIMEOUT_MS).toBeLessThan(DB_QUERY_TIMEOUT_MS)
  })
})
