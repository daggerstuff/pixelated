/** @vitest-environment node */

/**
 * The connection module must not hand out a pool the db module discarded.
 *
 * `lib/db` rebuilds its pool after a transient connection failure. This module
 * caches a reference to it and exposes it through `getPostgresPool()`, which
 * ten consumers read; a cached reference outlives the rebuild and every one of
 * them then talks to an ended pool.
 *
 * pg is mocked with a fake Pool so the rebuild can be driven without a
 * database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { FakePool } = vi.hoisted(() => {
  class FakePoolClient {
    query = async (text: string) => ({ rows: [{ now: text }], rowCount: 1 })
    release = () => undefined
  }

  class FakePool {
    static instances: FakePool[] = []
    readonly options: unknown
    ended = false
    private errorListener: ((error: unknown) => void) | null = null

    constructor(options: unknown) {
      this.options = options
      FakePool.instances.push(this)
    }

    on(event: string, listener: (error: unknown) => void): this {
      if (event === 'error') this.errorListener = listener
      return this
    }

    async connect(): Promise<FakePoolClient> {
      return new FakePoolClient()
    }

    async query(): Promise<{ rows: unknown[]; rowCount: number }> {
      return { rows: [], rowCount: 0 }
    }

    async end(): Promise<void> {
      this.ended = true
    }
  }

  return { FakePool }
})

vi.mock('pg', () => ({ Pool: FakePool, PoolClient: class {} }))

import {
  connectPostgreSQL,
  disconnectPostgreSQL,
  getPostgresPool,
} from '../connection'
import { closeDatabase, initializeDatabase } from '../index'

beforeEach(() => {
  FakePool.instances = []
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('DATABASE_URL', '')
  vi.stubEnv('DB_HOST', 'localhost')
})

afterEach(async () => {
  await disconnectPostgreSQL()
  await closeDatabase()
  vi.unstubAllEnvs()
})

describe('the cached PostgreSQL pool', () => {
  it('refuses to hand out a pool before connectPostgreSQL ran', () => {
    expect(() => getPostgresPool()).toThrow(/connectPostgreSQL/)
  })

  it('hands out the pool the db module owns after a rebuild', async () => {
    initializeDatabase()
    const first = FakePool.instances[0]
    const connected = await connectPostgreSQL()

    expect(connected).toBe(first)
    expect(getPostgresPool()).toBe(first)

    // The db module discarded its pool; the next read rebuilds it.
    await closeDatabase()
    expect(first.ended).toBe(true)

    const replacement = getPostgresPool()

    expect(replacement).not.toBe(first)
    expect(FakePool.instances).toHaveLength(2)
    expect(replacement).toBe(FakePool.instances[1])
  })

  it('re-tests the connection against the replacement', async () => {
    initializeDatabase()
    await connectPostgreSQL()
    await closeDatabase()

    const replacement = await connectPostgreSQL()

    expect(replacement).toBe(FakePool.instances[1])
    expect(FakePool.instances).toHaveLength(2)
  })

  it('clears the connected state on disconnect', async () => {
    initializeDatabase()
    await connectPostgreSQL()

    await disconnectPostgreSQL()

    expect(FakePool.instances[0].ended).toBe(true)
    expect(() => getPostgresPool()).toThrow(/connectPostgreSQL/)
  })
})
