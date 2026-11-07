/**
 * Recovery tests for the Workers-safe pg pool in lib/db.
 *
 * On Cloudflare Workers the module-level pool's sockets can go stale across
 * isolate freeze/thaw (and a dead idle client used to trigger
 * process.exit(-1), which tears down the whole isolate). The pool must
 * self-heal: discard itself on an idle-client error, and rebuild once on a
 * transient connection error instead of 500-ing the request.
 *
 * pg is mocked with a fake Pool so the failure/recovery paths can be driven
 * without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock is hoisted above all other statements, so the fakes and the shared
// connect-error queue must be defined with vi.hoisted to be reachable.
const { FakePool, FakePoolClient, hooks } = vi.hoisted(() => {
  const state = { errors: [] as unknown[] }

  class FakePoolClient {
    query: (text: string) => Promise<unknown> = async (text: string) => ({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      text,
    })
    release: () => void = () => undefined
  }

  class FakePool {
    static instances: FakePool[] = []

    readonly options: unknown
    readonly ended: { called: boolean } = { called: false }
    private errorListener: ((err: unknown) => void) | null = null
    private connectListener: ((client: FakePoolClient) => void) | null = null

    constructor(options: unknown) {
      this.options = options
      FakePool.instances.push(this)
    }

    on(event: string, listener: (err: unknown) => void): this {
      if (event === 'error') this.errorListener = listener
      if (event === 'connect') this.connectListener = listener
      return this
    }

    async connect(): Promise<FakePoolClient> {
      if (state.errors.length > 0) {
        throw state.errors.shift()
      }
      const client = new FakePoolClient()
      this.connectListener?.(client)
      return client
    }

    async end(): Promise<void> {
      this.ended.called = true
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
  getPool,
  initializeDatabase,
  query,
  transaction,
} from '../index'

describe('lib/db pool recovery', () => {
  beforeEach(() => {
    FakePool.instances = []
    hooks.errors = []
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('DB_HOST', 'localhost')
  })

  afterEach(async () => {
    await closeDatabase()
    vi.unstubAllEnvs()
  })

  it('rebuilds the pool once on a transient connection error and succeeds', async () => {
    initializeDatabase()
    expect(FakePool.instances).toHaveLength(1)
    const firstPool = FakePool.instances[0]

    hooks.errors = [
      Object.assign(new Error('connection terminated unexpectedly'), {
        code: 'ECONNRESET',
      }),
    ]

    const result = await query('SELECT 1')
    expect(result.rowCount).toBe(0)

    // The stale pool was torn down and a fresh one served the retry.
    expect(FakePool.instances).toHaveLength(2)
    expect(firstPool.ended.called).toBe(true)
    expect(FakePool.instances[1]).not.toBe(firstPool)
  })

  it('rebuilds even when the error only carries a message (no code)', async () => {
    initializeDatabase()
    hooks.errors = [new Error('The server closed the connection unexpectedly')]

    await expect(query('SELECT 1')).resolves.toMatchObject({ rowCount: 0 })
    expect(FakePool.instances).toHaveLength(2)
  })

  it('rethrows non-transient connection errors without rebuilding', async () => {
    initializeDatabase()
    const authError = Object.assign(
      new Error('password authentication failed'),
      {
        code: '28P01',
      },
    )
    hooks.errors = [authError]

    await expect(query('SELECT 1')).rejects.toBe(authError)
    expect(FakePool.instances).toHaveLength(1)
    expect(FakePool.instances[0].ended.called).toBe(false)
  })

  it('does not retry when the retry itself fails (rethrows as-is)', async () => {
    initializeDatabase()
    // First connect fails; the rebuild's connect fails too.
    hooks.errors = [
      Object.assign(new Error('connection timeout expired'), {
        code: 'ECONNREFUSED',
      }),
      Object.assign(new Error('connection timeout expired'), {
        code: 'ECONNREFUSED',
      }),
    ]
    const secondFailure = hooks.errors[1]

    await expect(query('SELECT 1')).rejects.toBe(secondFailure)
    expect(FakePool.instances).toHaveLength(2)
  })

  it('transaction() rebuilds the pool on a transient connect error', async () => {
    initializeDatabase()
    hooks.errors = [
      Object.assign(new Error('network connection lost'), {
        code: 'ECONNRESET',
      }),
    ]

    const value = await transaction(async (client) => {
      await client.query('BEGIN')
      return 42
    })
    expect(value).toBe(42)
    expect(FakePool.instances).toHaveLength(2)
  })

  it('discards the pool on an idle-client error and rebuilds on next use', async () => {
    const pool = initializeDatabase()
    const firstPool = FakePool.instances[0]
    expect(firstPool.getErrorListener()).toBeTruthy()
    firstPool.getErrorListener()?.(new Error('unexpected idle client failure'))

    const replacement = getPool()
    expect(replacement).not.toBe(pool)
    expect(firstPool.ended.called).toBe(true)
    // The replacement stays in place for subsequent use.
    expect(getPool()).toBe(replacement)
    expect(FakePool.instances).toHaveLength(2)
  })

  it('does not call process.exit on an idle-client error', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    try {
      initializeDatabase()
      const firstPool = FakePool.instances[0]
      firstPool.getErrorListener()?.(new Error('idle socket dropped'))
      expect(exitSpy).not.toHaveBeenCalled()
      expect(getPool()).not.toBe(firstPool)
    } finally {
      exitSpy.mockRestore()
    }
  })

  it('acquireClient() reuses a healthy pool without rebuilding', async () => {
    initializeDatabase()
    const client = await acquireClient()
    expect(FakePool.instances).toHaveLength(1)
    client.release()
    const again = await acquireClient()
    expect(FakePool.instances).toHaveLength(1)
    again.release()
  })
})
