import type { APIRoute } from 'astro'
import { getRedisClient } from '@/lib/database/connection'

export const GET: APIRoute = async () => {
  const health: {
    status: 'ok' | 'degraded'
    timestamp: string
    services: {
      redis?: {
        status: 'connected' | 'disconnected'
        response?: unknown
        error?: string
      }
    }
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  }

  // Check Redis
  try {
    const redis = getRedisClient()
    const pong = await redis.ping()
    health.services.redis = {
      status: 'connected',
      response: pong,
    }
  } catch (error: unknown) {
    health.services.redis = {
      status: 'disconnected',
      error: (error as Error).message,
    }
    health.status = 'degraded'
  }

  const statusCode = health.status === 'ok' ? 200 : 503
  return new Response(JSON.stringify(health), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  })
}
