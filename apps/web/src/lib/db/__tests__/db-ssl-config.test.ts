/**
 * Regression tests for the SSL misconfiguration behind Sentry issue
 * PIXEL-ASTRO-W ("The server does not support SSL connections").
 *
 * Local Postgres has no TLS support: pointing the driver at localhost with
 * SSL enabled makes every connection fail. SSL must only be enabled for
 * remote hosts, regardless of NODE_ENV, unless sslmode is explicit.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { closeDatabase, initializeDatabase } from '../index'
import { parseDatabaseUrl } from '../parse-database-url'

describe('parseDatabaseUrl SSL mapping', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('disables SSL for localhost even in production when sslmode is unset', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const config = parseDatabaseUrl('postgres://user:pass@localhost:5432/db')
    expect(config.ssl).toBe(false)
  })

  it('disables SSL for 127.0.0.1 even in production when sslmode is unset', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const config = parseDatabaseUrl('postgres://user:pass@127.0.0.1:5432/db')
    expect(config.ssl).toBe(false)
  })

  it('enables verified SSL for remote hosts when sslmode is unset', () => {
    const config = parseDatabaseUrl(
      'postgres://user:pass@db.internal.example.com:5432/db',
    )
    expect(config.ssl).toEqual({ rejectUnauthorized: true })
  })

  it('honours explicit sslmode=disable', () => {
    const config = parseDatabaseUrl(
      'postgres://user:pass@db.internal.example.com:5432/db?sslmode=disable',
    )
    expect(config.ssl).toBe(false)
  })

  it('honours explicit sslmode=no-verify', () => {
    const config = parseDatabaseUrl(
      'postgres://user:pass@db.internal.example.com:5432/db?sslmode=no-verify',
    )
    expect(config.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('honours explicit sslmode=require', () => {
    const config = parseDatabaseUrl(
      'postgres://user:pass@localhost:5432/db?sslmode=require',
    )
    expect(config.ssl).toEqual({ rejectUnauthorized: true })
  })
})

describe('initializeDatabase SSL configuration', () => {
  afterEach(async () => {
    await closeDatabase()
    vi.unstubAllEnvs()
  })

  it('disables SSL when DB_HOST is localhost in production', () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DB_HOST', 'localhost')
    const pool = initializeDatabase()
    const options = (pool as unknown as { options: { ssl: unknown } }).options
    expect(options.ssl).toBe(false)
  })

  it('disables SSL when no host is configured outside production', () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DB_HOST', '')
    const pool = initializeDatabase()
    const options = (pool as unknown as { options: { ssl: unknown } }).options
    expect(options.ssl).toBe(false)
  })

  it('enables verified SSL for remote DB_HOST in production', () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DB_HOST', 'db.internal.example.com')
    const pool = initializeDatabase()
    const options = (pool as unknown as { options: { ssl: unknown } }).options
    expect(options.ssl).toEqual({ rejectUnauthorized: true })
  })

  it('keeps explicit sslmode=require from DATABASE_URL even for localhost', () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgres://user:pass@localhost:5432/db?sslmode=require',
    )
    vi.stubEnv('NODE_ENV', 'test')
    const pool = initializeDatabase()
    const options = (pool as unknown as { options: { ssl: unknown } }).options
    expect(options.ssl).toEqual({ rejectUnauthorized: true })
  })
})
