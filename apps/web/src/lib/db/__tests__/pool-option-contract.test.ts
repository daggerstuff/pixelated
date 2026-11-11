/**
 * One contract over every numeric `DB_*` knob: a non-positive or non-numeric
 * value must resolve to the documented default or to the documented disabling
 * value, never to something pg would act on.
 *
 * This is the case that would have caught the whole family in one shot. The
 * traps were found one sibling per round: `queryWithDeadline` and
 * `acquireWithDeadline` had no `<= 0` guard, `statement_timeout` was passed
 * through bare, and `connectionTimeoutMillis`, `idleTimeoutMillis` and `max`
 * arrived through the `...finalConfig` spread with no sign check at all. Each
 * one inverted its documented meaning in a different way:
 *
 *   - pg's `const readTimeout = config.query_timeout || …` is truthy for a
 *     negative value, so a negative bound schedules an immediate timeout;
 *   - `if (params.statement_timeout)` is truthy for a negative value, so
 *     PostgreSQL refuses the connection at startup;
 *   - pg-pool's `if (this.options.connectionTimeoutMillis)` and
 *     `if (this.options.idleTimeoutMillis)` are truthiness tests, so a negative
 *     value schedules `setTimeout(…, -N)` and destroys or evicts every client;
 *   - pg-pool's `max || poolSize || 10` turns `0` into 10, and a negative `max`
 *     makes `_isFull()` true forever, so every `connect()` queues and times out;
 *   - `DB_PORT` was a bare `parseInt`, so a non-numeric value resolved to `NaN`
 *     and every connection failed.
 *
 * The expectations are literals on purpose: they are the values the owner
 * fixed, so a later edit cannot widen a bound quietly. `DB_QUERY_TIMEOUT` is
 * the 4 000 ms bound that must not be widened.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { FakePool } = vi.hoisted(() => {
  class FakePool {
    static instances: FakePool[] = []

    readonly options: Record<string, unknown>

    constructor(options: Record<string, unknown>) {
      this.options = options
      FakePool.instances.push(this)
    }

    on(): this {
      return this
    }

    async connect(): Promise<never> {
      throw new Error('the contract test never checks out a client')
    }

    async end(): Promise<void> {}
  }

  return { FakePool }
})

vi.mock('pg', () => ({
  Pool: FakePool,
  PoolClient: class {},
}))

import {
  closeDatabase,
  DB_ACQUIRE_TIMEOUT_MS,
  DB_CONNECTION_TIMEOUT_MS,
  DB_LIVENESS_PROBE_TIMEOUT_MS,
  DB_MAX_LIFETIME_SECONDS,
  DB_QUERY_TIMEOUT_MS,
  DB_STATEMENT_TIMEOUT_MS,
  initializeDatabase,
} from '../index'

interface Knob {
  env: string
  /** The pool option the knob resolves to. */
  option: string
  /** The documented positive default, kept for empty/non-numeric input. */
  documentedDefault: number
  /**
   * What a non-positive override resolves to. A number is the exact disabling
   * value pg understands; `'non-positive'` means the module's own `<= 0`
   * guard is the disabling mechanism and the raw value stays inert.
   */
  nonPositive: number | 'non-positive'
}

const KNOBS: Knob[] = [
  {
    env: 'DB_QUERY_TIMEOUT',
    option: 'query_timeout',
    documentedDefault: DB_QUERY_TIMEOUT_MS,
    nonPositive: 0,
  },
  {
    env: 'DB_ACQUIRE_TIMEOUT',
    option: 'acquireTimeoutMillis',
    documentedDefault: DB_ACQUIRE_TIMEOUT_MS,
    nonPositive: 'non-positive',
  },
  {
    env: 'DB_LIVENESS_PROBE_TIMEOUT',
    option: 'livenessProbeTimeoutMillis',
    documentedDefault: DB_LIVENESS_PROBE_TIMEOUT_MS,
    nonPositive: 'non-positive',
  },
  {
    env: 'DB_MAX_LIFETIME_SECONDS',
    option: 'clientLifetimeSeconds',
    documentedDefault: DB_MAX_LIFETIME_SECONDS,
    nonPositive: 'non-positive',
  },
  {
    env: 'DB_STATEMENT_TIMEOUT',
    option: 'statement_timeout',
    documentedDefault: 5_000,
    nonPositive: 0,
  },
  {
    env: 'DB_CONNECTION_TIMEOUT',
    option: 'connectionTimeoutMillis',
    documentedDefault: 3_000,
    nonPositive: 0,
  },
  {
    env: 'DB_IDLE_TIMEOUT',
    option: 'idleTimeoutMillis',
    documentedDefault: 30_000,
    nonPositive: 0,
  },
  {
    env: 'DB_MAX_CONNECTIONS',
    option: 'max',
    // `0` silently becomes pg-pool's own 10 and a negative value is
    // permanently full, so the only safe non-positive resolution is the
    // documented default.
    documentedDefault: 20,
    nonPositive: 20,
  },
  {
    env: 'DB_PORT',
    option: 'port',
    documentedDefault: 5_432,
    // A port has no disabling value: an unusable one falls back to the
    // documented default instead of reaching pg as `NaN`.
    nonPositive: 5_432,
  },
]

const VALUES = ['0', '-1', 'abc', '']

const NON_POSITIVE = new Set(['0', '-1'])

beforeEach(() => {
  FakePool.instances = []
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('DB_HOST', 'localhost')
  // The checkout's .env sets DB_* variables; pin every knob so the contract
  // tests the code, not the local environment.
  for (const knob of KNOBS) vi.stubEnv(knob.env, '')
})

afterEach(async () => {
  await closeDatabase()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('every numeric DB_* knob resolves to a documented value', () => {
  for (const knob of KNOBS) {
    for (const value of VALUES) {
      it(`${knob.env}=${JSON.stringify(value)} resolves ${knob.option} to the documented default or the disabling value`, async () => {
        vi.stubEnv(knob.env, value)
        initializeDatabase()

        const resolved = FakePool.instances[0]?.options[knob.option] as number
        const expected = NON_POSITIVE.has(value)
          ? knob.nonPositive
          : knob.documentedDefault

        expect(Number.isFinite(resolved)).toBe(true)
        if (expected === 'non-positive') {
          expect(resolved).toBeLessThanOrEqual(0)
        } else {
          expect(resolved).toBe(expected)
        }
      })
    }
  }
})

describe('the positive defaults the owner fixed are unchanged', () => {
  it('keeps the 4 000 ms query bound and every sibling default', () => {
    expect(DB_QUERY_TIMEOUT_MS).toBe(4_000)
    expect(DB_ACQUIRE_TIMEOUT_MS).toBe(2_500)
    expect(DB_CONNECTION_TIMEOUT_MS).toBe(3_000)
    expect(DB_STATEMENT_TIMEOUT_MS).toBe(5_000)
    expect(DB_LIVENESS_PROBE_TIMEOUT_MS).toBe(300)
    expect(DB_MAX_LIFETIME_SECONDS).toBe(60)
  })

  it('resolves every pool option to its positive default with no overrides', () => {
    initializeDatabase()

    const options = FakePool.instances[0]?.options ?? {}
    expect(options.query_timeout).toBe(4_000)
    expect(options.statement_timeout).toBe(5_000)
    expect(options.connectionTimeoutMillis).toBe(3_000)
    expect(options.idleTimeoutMillis).toBe(30_000)
    expect(options.max).toBe(20)
    expect(options.port).toBe(5_432)
  })
})
