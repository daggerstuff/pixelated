import type { AstroIntegration } from 'astro'

import { connectRedis } from '../../lib/db/connection'

export default function redisConnect(): AstroIntegration {
  return {
    name: 'redis-connect',
    hooks: {
      'astro:server:setup': async ({ server: _server }) => {
        console.log('[redis-connect] Setting up Redis connection...')
        try {
          await connectRedis()
          console.log('[redis-connect] Redis connected successfully')
        } catch (error) {
          console.error('[redis-connect] Redis connection failed:', error)
        }
      },
    },
  }
}
