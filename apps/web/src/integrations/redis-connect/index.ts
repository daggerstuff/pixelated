import type { AstroIntegration } from 'astro'

import { connectRedis } from '../../lib/db/connection'

export default function redisConnect(): AstroIntegration {
  return {
    name: 'redis-connect',
    hooks: {
      'astro:server:setup': async ({ server: _server }) => {
        try {
          await connectRedis()
        } catch (error) {
          // error handled by caller
        }
      },
    },
  }
}
