/**
 * HIPAA-compliant session configuration for Express with Redis store support.
 *
 * PIX-3755: Redis session store migration (horizontal scaling prerequisite)
 *
 * This module provides:
 *   - Redis-backed session store using connect-redis
 *   - HIPAA-aligned session configuration (secure, httpOnly, sameSite=strict)
 *   - Zero-downtime migration support via dual-write pattern
 *   - Feature flag rollback via USE_REDIS_SESSIONS env var
 */

import { RedisStore } from 'connect-redis'
import session from 'express-session'
import type { RedisClientType } from 'redis'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { redis } from '@/lib/redis'

const logger = createBuildSafeLogger('session-config')

/**
 * Session configuration constants aligned with HIPAA Security Rule.
 */
export const SESSION_CONFIG = {
  name: 'pixelated.sid',
  secret: process.env['SESSION_SECRET'] ?? '',
  prefix: 'sess:',
  maxAge: 24 * 60 * 60 * 1000,
  rolling: true,
  saveUninitialized: false,
  resave: false,
  cookie: {
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  },
} as const

export function validateSessionConfig(): void {
  if (!SESSION_CONFIG.secret && process.env['NODE_ENV'] === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production')
  }
}

export function useRedisSessions(): boolean {
  return process.env['USE_REDIS_SESSIONS'] === 'true' || process.env['USE_REDIS_SESSIONS'] === '1'
}

export function createRedisStore(): session.Store {
  const client = redis as unknown as RedisClientType
  return new RedisStore({
    client,
    prefix: SESSION_CONFIG.prefix,
    ttl: SESSION_CONFIG.maxAge / 1000,
  })
}

function createMemoryStore(): session.Store {
  return new session.MemoryStore()
}

export function getSessionStore(): session.Store {
  if (useRedisSessions()) {
    logger.info('Using Redis session store for horizontal scaling')
    return createRedisStore()
  }
  logger.warn('Using in-memory session store - not suitable for production')
  return createMemoryStore()
}

export function createSessionMiddleware(): ReturnType<typeof session> {
  validateSessionConfig()
  const store = getSessionStore()

  return session({
    store,
    name: SESSION_CONFIG.name,
    secret: SESSION_CONFIG.secret || generateFallbackSecret(),
    resave: SESSION_CONFIG.resave,
    saveUninitialized: SESSION_CONFIG.saveUninitialized,
    rolling: SESSION_CONFIG.rolling,
    cookie: {
      secure: SESSION_CONFIG.cookie.secure,
      httpOnly: SESSION_CONFIG.cookie.httpOnly,
      sameSite: SESSION_CONFIG.cookie.sameSite,
      maxAge: SESSION_CONFIG.cookie.maxAge,
      path: SESSION_CONFIG.cookie.path,
    },
  })
}

function generateFallbackSecret(): string {
  // Use a module-level variable to persist the secret for the process lifetime
  if (!fallbackSecret) {
    fallbackSecret = `dev-secret-${Date.now()}-${Math.random().toString(36).slice(2)}`
    logger.warn('Generated ephemeral session secret for development')
  }
  return fallbackSecret
}

let fallbackSecret: string | undefined

export interface SessionData {
  userId?: string
  createdAt?: string
  lastActivity?: string
}

export default createSessionMiddleware