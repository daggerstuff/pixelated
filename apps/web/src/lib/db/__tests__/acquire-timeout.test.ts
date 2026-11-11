/**
 * Bounds on Postgres client acquisition (diagnosis finding D3).
 *
 * The measured 8 s read-path stall was `getPool().connect()` inside
 * `resolveIdentity` never yielding a client. pg's only bound was
 * `connectionTimeoutMillis: 15000` — 1.875x the 8 s request deadline — and the
 * single retry fired only on a *raised* transient error, so a hang was neither
 * bounded nor retried. The acquisition is now bounded well inside the request
 * deadline, retried once on a rebuilt pool, and a client that arrives after the
 * deadline is destroyed instead of leaking its slot.
 *
 * pg is mocked with a fake pool whose `connect()` behaviour is scripted per
 * call, so the hang / late-arrival paths can be driven without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Behaviour =
  | { kind: 'resolve' }
  | { kind: 'hang' }
  | { kind: 'reject'; error: unknown }
  | { kind: 'resolveAfter'; ms: number }

const { FakePool, FakePoolClient, hooks } = vi.hoisted(() => {
  const state = { behaviours: [] as Behaviour[] }

  class FakePoolClient {
    releasedWith: unknown[] = []
    query = async () => ({ rows: [], rowCount: 0 })
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

    constructor(options: Record<string, unknown>) {
      this.options = options
      FakePool.instances.push(this)
    }

    on(event: string, listener: (err: unknown) => void): this {
      if (event === 'error') this.errorListener = listener
      return this
    }

    connect(): Promise<FakePoolClient> {
      const behaviour = state.behaviours.shift() ?? { kind: 'resolve' }
      switch (behaviour.kind) {
        case 'hang':
          return new Promise<FakePoolClient>(() => {})
        case 'reject':
          return Promise.reject(behaviour.error)
        case 'resolveAfter':
          return new Promise<FakePoolClient>((resolve) => {
            setTimeout(() => {
              const client = new FakePoolClient()
              this.clients.push(client)
              resolve(client)
            }, behaviour.ms)
          })
        case 'resolve':
        default: {
          const client = new FakePoolClient()
          this.clients.push(client)
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
  DB_ACQUIRE_ATTEMPTS,
  DB_ACQUIRE_TIMEOUT_MS,
  DB_CONNECTION_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS,
  initializeDatabase,
  isDatabaseUnavailableError,
} from '../index'

/** The route's request deadline (`TRAINING_DATA_DEADLINE_MS`). */
const REQUEST_DEADLINE_MS = 8_000

/** How long a hung acquisition may take before the test calls it a stall. */
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

beforeEach(() => {
  FakePool.instances = []
  hooks.behaviours = []
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('DB_HOST', 'localhost')
  // The checkout's .env sets DB_CONNECTION_TIMEOUT; pin the defaults here so
  // the assertions below test the code, not the local environment.
  vi.stubEnv('DB_CONNECTION_TIMEOUT', '')
  vi.stubEnv('DB_ACQUIRE_TIMEOUT', '')
  vi.stubEnv('DB_STATEMENT_TIMEOUT', '')
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
})

describe('Postgres client acquisition bound', () => {
  it('fails fast instead of stalling when connect() never settles', async () => {
    initializeDatabase({ acquireTimeoutMillis: 50 })
    hooks.behaviours = [{ kind: 'hang' }, { kind: 'hang' }]

    const started = Date.now()
    const outcome = await Promise.race([settle(acquireClient()), stallGuard()])
    const elapsed = Date.now() - started

    // The pinned code has no bound at all: this is 'stalled' and the
    // assertion below is the failing evidence for D3.
    expect(outcome.kind).toBe('rejected')
    expect(
      outcome.kind === 'rejected' && isDatabaseUnavailableError(outcome.error),
    ).toBe(true)
    expect(
      outcome.kind === 'rejected' &&
        outcome.error instanceof DatabaseUnavailableError,
    ).toBe(true)
    expect(elapsed).toBeLessThan(STALL_GUARD_MS)

    // Both attempts ran, and the first pool was discarded rather than left
    // holding a half-open socket.
    expect(FakePool.instances).toHaveLength(DB_ACQUIRE_ATTEMPTS)
    expect(FakePool.instances[0]?.ended).toBe(true)
  })

  it('retries once on a rebuilt pool and succeeds', async () => {
    initializeDatabase({ acquireTimeoutMillis: 50 })
    hooks.behaviours = [{ kind: 'hang' }, { kind: 'resolve' }]

    const outcome = await Promise.race([settle(acquireClient()), stallGuard()])

    expect(outcome.kind).toBe('resolved')
    expect(FakePool.instances).toHaveLength(2)
    expect(FakePool.instances[0]?.ended).toBe(true)
    expect(FakePool.instances[1]?.ended).toBe(false)
  })

  it('destroys a client that arrives after the deadline instead of leaking the slot', async () => {
    initializeDatabase({ acquireTimeoutMillis: 50 })
    hooks.behaviours = [{ kind: 'resolveAfter', ms: 150 }, { kind: 'resolve' }]

    const client = await acquireClient()
    client.release()

    // Let the abandoned first attempt resolve.
    await new Promise((resolve) => setTimeout(resolve, 250))

    const abandoned = FakePool.instances[0]?.clients[0]
    expect(abandoned).toBeTruthy()
    // release(true) destroys the client; release() alone would return a
    // client from a discarded pool to that pool's idle list.
    expect(abandoned?.releasedWith).toEqual([true])
  })

  it('keeps two acquisition attempts and the statement timeout inside the request deadline', () => {
    expect(DB_ACQUIRE_ATTEMPTS).toBe(2)
    expect(DB_ACQUIRE_TIMEOUT_MS * DB_ACQUIRE_ATTEMPTS).toBeLessThan(
      REQUEST_DEADLINE_MS,
    )
    expect(DB_STATEMENT_TIMEOUT_MS).toBeLessThan(REQUEST_DEADLINE_MS)
    expect(DB_CONNECTION_TIMEOUT_MS).toBeLessThan(REQUEST_DEADLINE_MS)
  })

  it('configures the statement timeout and the pool connect timeout', () => {
    initializeDatabase()

    const options = FakePool.instances[0]?.options ?? {}
    expect(options.statement_timeout).toBe(DB_STATEMENT_TIMEOUT_MS)
    expect(options.connectionTimeoutMillis).toBe(DB_CONNECTION_TIMEOUT_MS)
  })
})

/**
 * A non-positive `DB_ACQUIRE_TIMEOUT` disables the acquisition bound.
 *
 * `acquireWithDeadline` scheduled `setTimeout(…, timeoutMs)` with no guard, so
 * `0` — pg's own "no timeout" value, and the value the sibling knobs treat as
 * "disabled" — fired the deadline on the next timer turn and every acquisition
 * failed with `AcquireTimeoutError`. Two attempts later the caller received a
 * `DatabaseUnavailableError`, so the knob made every request fail instead of
 * removing the bound. A negative value behaved the same way, because
 * `setTimeout` clamps a negative delay to `0`.
 *
 * These cases drive a `connect()` that settles *after* the timer turn, which is
 * what separates "disabled" from "wins the microtask race": a `0`-bound
 * deadline would still lose to an already-resolved `connect()` promise, so a
 * microtask-resolved fake would pass on the broken code and prove nothing.
 */
describe('a non-positive DB_ACQUIRE_TIMEOUT disables the acquisition bound', () => {
  it('does not fail every acquisition when DB_ACQUIRE_TIMEOUT=0', async () => {
    vi.stubEnv('DB_ACQUIRE_TIMEOUT', '0')
    initializeDatabase()
    hooks.behaviours = [
      { kind: 'resolveAfter', ms: 20 },
      { kind: 'resolveAfter', ms: 20 },
    ]

    const outcome = await settle(acquireClient())

    expect(outcome.kind).toBe('resolved')
  })

  it('treats a negative DB_ACQUIRE_TIMEOUT as disabled, not as an immediate timeout', async () => {
    vi.stubEnv('DB_ACQUIRE_TIMEOUT', '-100')
    initializeDatabase()
    // Both attempts are slow, so the retry cannot hide an immediate timeout:
    // `setTimeout` clamps a negative delay to 0, which used to fire before
    // either connect settled.
    hooks.behaviours = [
      { kind: 'resolveAfter', ms: 20 },
      { kind: 'resolveAfter', ms: 20 },
    ]

    const outcome = await settle(acquireClient())

    expect(outcome.kind).toBe('resolved')
    // One attempt, no pool rebuild: the bound is gone, not merely survived.
    expect(FakePool.instances).toHaveLength(1)
  })

  it('does not discard the pool when the bound is disabled', async () => {
    initializeDatabase({ acquireTimeoutMillis: 0 })
    hooks.behaviours = [{ kind: 'resolveAfter', ms: 20 }]

    const client = await acquireClient()
    client.release()

    expect(FakePool.instances).toHaveLength(1)
    expect(FakePool.instances[0]?.ended).toBe(false)
  })

  it('keeps the 2 500 ms default when DB_ACQUIRE_TIMEOUT is not a number', () => {
    vi.stubEnv('DB_ACQUIRE_TIMEOUT', 'not-a-number')
    initializeDatabase()

    expect(FakePool.instances[0]?.options.acquireTimeoutMillis).toBe(
      DB_ACQUIRE_TIMEOUT_MS,
    )
    // The positive default is unchanged: this guard removes the zero/negative
    // trap, it does not relax the bound.
    expect(DB_ACQUIRE_TIMEOUT_MS).toBe(2_500)
  })
})
