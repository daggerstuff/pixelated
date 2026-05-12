import { Redis } from 'ioredis'
import { CacheInvalidation } from './src/lib/cache/invalidation.ts'
import { RedisService } from './src/lib/services/redis/RedisService'

async function main() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL required')
  }

  const redis = new RedisService({ url, keyPrefix: '' })
  await redis.connect()
  const client = redis.getClient()
  if (!client) {
    throw new Error('Redis client not initialized')
  }

  const ci = new CacheInvalidation({ redis: client as Redis, prefix: '' })
  const pattern = `dbg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const keys = Array.from({ length: 3 }, (_, i) => `${pattern}:${i}`)

  for (const key of keys) {
    await client.set(key, 'v')
  }

  await ci.invalidatePattern(`${pattern}:*`)
  const exists = await Promise.all(keys.map((k) => client.exists(k)))
  const remaining = await client.keys(`${pattern}:*`)
  console.log('exists', exists)
  console.log('remaining', remaining)

  await redis.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
