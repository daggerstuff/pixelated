/**
 * The `DB_QUERY_TIMEOUT` disable guard.
 *
 * `queryWithDeadline` used to have no non-positive guard, and pg treats `0` as
 * "unbounded" (`const readTimeout = config.query_timeout || …`), so
 * `DB_QUERY_TIMEOUT=0` made every statement fail immediately: the module's own
 * `setTimeout(…, 0)` deadline won the race before the query could settle. Its
 * siblings already treat a non-positive value as "disabled" — the liveness
 * probe (`probeClientLiveness`), the client-lifetime recycle
 * (`isClientPastLifetime`) and the server-side `statement_timeout` — so this
 * knob was the one that silently inverted its documented meaning.
 *
 * These tests pin the same contract in both places the query bound is
 * enforced: this module's deadline race and the pool's `query_timeout` option.
 * A negative value must be normalised before it reaches pg, because pg's
 * `if (readTimeout)` is truthy for a negative number and `setTimeout` would
 * then fire immediately. A positive bound must still trip, so the guard cannot
 * be "fixed" by removing the bound.
 *
 * pg is mocked with a fake pool whose `connect()` and query behaviour are
 * scripted per call, so the disable paths can be driven without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryHandler = (text: string) => Promise<unknown>

interface FakeClient {
  releasedWith: unknown[]
  queries: string[]
  query: (text: string) => Promise<unknown>
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

    constructor(private readonly queryHandler: QueryHandler = defaultHandler) {}

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
  DB_ACQUIRE_TIMEOUT_MS,
  DB_LIVENESS_PROBE_TIMEOUT_MS,
  DB_MAX_LIFETIME_SECONDS,
  DB_QUERY_TIMEOUT_MS,
  initializeDatabase,
  isDatabaseUnavailableError,
  query,
  transaction,
} from '../index'

/** A query that settles only after the event loop has turned over. */
const settlesAfter =
  (ms: number): QueryHandler =>
  () =>
    new Promise((resolve) => {
      setTimeout(() => resolve({ rows: [{ ok: true }], rowCount: 1 }), ms)
    })

const neverSettles = () => new Promise<never>(() => {})

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => ({ kind: 'resolved' as const }),
    (error: unknown) => ({ kind: 'rejected' as const, error }),
  )

const stallGuard = () =>
  new Promise<{ kind: 'stalled' }>((resolve) => {
    setTimeout(() => resolve({ kind: 'stalled' }), 500)
  })

const lastClient = () => FakePool.instances.at(-1)?.clients.at(-1)

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
  vi.stubEnv('DB_MAX_LIFETIME_SECONDS', '')
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('a non-positive DB_QUERY_TIMEOUT disables the bound', () => {
  it('does not fail every query when DB_QUERY_TIMEOUT=0', async () => {
    vi.stubEnv('DB_QUERY_TIMEOUT', '0')
    initializeDatabase()
    hooks.behaviours = [{ kind: 'resolve', queryHandler: settlesAfter(20) }]

    const outcome = await settle(query('SELECT 1'))

    // Pinned behaviour: the module's own `setTimeout(…, 0)` fires first and
    // every statement rejects as a retryable DatabaseUnavailableError.
    expect(outcome.kind).toBe('resolved')
    expect(lastClient()?.releasedWith).toEqual([undefined])
  })

  it('passes 0 to pg, which reads it as "no timeout"', () => {
    vi.stubEnv('DB_QUERY_TIMEOUT', '0')
    initializeDatabase()

    expect(FakePool.instances[0]?.options.query_timeout).toBe(0)
  })

  it('treats a negative DB_QUERY_TIMEOUT as disabled, not as an immediate timeout', async () => {
    vi.stubEnv('DB_QUERY_TIMEOUT', '-100')
    initializeDatabase()
    hooks.behaviours = [{ kind: 'resolve', queryHandler: settlesAfter(20) }]

    const outcome = await settle(query('SELECT 1'))

    expect(outcome.kind).toBe('resolved')
    // pg's `if (readTimeout)` is truthy for a negative number, so a negative
    // override must be normalised before it reaches the pool or pg schedules
    // an immediate timeout and reintroduces the defect one layer down.
    expect(FakePool.instances[0]?.options.query_timeout).toBe(0)
  })

  it('does not fail BEGIN/COMMIT in transaction() when the bound is disabled', async () => {
    initializeDatabase({ queryTimeoutMillis: 0 })
    hooks.behaviours = [{ kind: 'resolve', queryHandler: settlesAfter(5) }]

    const outcome = await settle(
      transaction(async (client) => {
        await client.query('SELECT 1')
        return 'committed'
      }),
    )

    expect(outcome.kind).toBe('resolved')
    expect(lastClient()?.queries).toEqual(['BEGIN', 'SELECT 1', 'COMMIT'])
    expect(lastClient()?.releasedWith).toEqual([undefined])
  })
})

describe('a non-numeric DB_QUERY_TIMEOUT keeps the default bound', () => {
  it('falls back to the 4 000 ms default instead of disabling or failing', async () => {
    vi.stubEnv('DB_QUERY_TIMEOUT', 'not-a-number')
    initializeDatabase()
    hooks.behaviours = [{ kind: 'resolve', queryHandler: settlesAfter(5) }]

    expect(FakePool.instances[0]?.options.query_timeout).toBe(
      DB_QUERY_TIMEOUT_MS,
    )
    const outcome = await settle(query('SELECT 1'))
    expect(outcome.kind).toBe('resolved')
  })
})

describe('the positive bound is not weakened', () => {
  it('still rejects a statement that never settles inside a positive bound', async () => {
    initializeDatabase({ queryTimeoutMillis: 40 })
    hooks.behaviours = [{ kind: 'resolve', queryHandler: neverSettles }]

    const outcome = await Promise.race([
      settle(query('SELECT 1')),
      stallGuard(),
    ])

    expect(outcome.kind).toBe('rejected')
    expect(
      outcome.kind === 'rejected' &&
        outcome.error instanceof DatabaseUnavailableError,
    ).toBe(true)
    expect(
      outcome.kind === 'rejected' && isDatabaseUnavailableError(outcome.error),
    ).toBe(true)
    // A statement abandoned by the bound destroys its client.
    expect(lastClient()?.releasedWith).toEqual([true])
  })

  it('keeps the 4 000 ms bound and the sibling guards', () => {
    initializeDatabase()

    // The owner condition on this file: the 4 000 ms bound must not widen.
    expect(DB_QUERY_TIMEOUT_MS).toBe(4_000)
    // The sibling knobs keep their own bounds and their disable guards.
    expect(DB_LIVENESS_PROBE_TIMEOUT_MS).toBe(300)
    expect(DB_MAX_LIFETIME_SECONDS).toBe(60)
    expect(DB_ACQUIRE_TIMEOUT_MS).toBe(2_500)

    const options = FakePool.instances[0]?.options ?? {}
    expect(options.query_timeout).toBe(DB_QUERY_TIMEOUT_MS)
  })

  it('keeps the liveness probe disabled by a zero bound', async () => {
    initializeDatabase({ livenessProbeTimeoutMillis: 0 })
    hooks.behaviours = [{ kind: 'resolve' }]

    const first = await acquireClient()
    first.release()

    hooks.behaviours = [{ kind: 'reuse', client: first as never }]
    const second = await acquireClient()

    expect(second).toBe(first)
    expect((first as unknown as FakeClient).queries).not.toContain('SELECT 1')
  })
})
