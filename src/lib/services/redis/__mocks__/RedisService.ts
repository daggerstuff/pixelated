import { EventEmitter } from 'events'
import type { IRedisService } from '../types'

// Create a simple in-memory store for mock Redis
const store = new Map<string, string>()
const setStore = new Map<string, Set<string>>()
const hashStore = new Map<string, Map<string, string>>()
const listStore = new Map<string, string[]>()
const zsetStore = new Map<string, Map<string, number>>()

/**
 * Mock RedisService for tests
 */
export class RedisService extends EventEmitter implements IRedisService {
  private connected = false
  private healthy = true

  constructor(_config: Record<string, unknown>) {
    super()
    this.connected = false
    this.healthy = true
  }

  async connect() {
    this.connected = true
    this.healthy = true
    return undefined
  }

  async disconnect() {
    this.connected = false
    return undefined
  }

  async cleanup() {
    // Clean up resources and close connections
    this.connected = false
    return undefined
  }

  async isHealthy() {
    return this.healthy
  }

  async getPoolStats() {
    return {
      totalConnections: 5,
      activeConnections: 2,
      idleConnections: 3,
      waitingClients: 0,
    }
  }

  async set(key: string, value: string, _ttlMs?: number) {
    store.set(key, value)
    // Simulate TTL (no actual implementation needed for tests)
  }

  async get(key: string) {
    return store.get(key) || null
  }

  async del(key: string) {
    store.delete(key)
  }

  async exists(key: string) {
    return store.has(key)
  }

  async ttl(key: string) {
    return store.has(key) ? 60 : -2 // 60 seconds if exists, -2 if not
  }

  // Hash operations
  async hset(key: string, field: string, value: string) {
    if (!hashStore.has(key)) {
      hashStore.set(key, new Map())
    }
    const hash = hashStore.get(key)!
    const existed = hash.has(field)
    hash.set(field, value)
    return existed ? 0 : 1
  }

  async hget(key: string, field: string) {
    const hash = hashStore.get(key)
    return hash ? hash.get(field) || null : null
  }

  async hdel(key: string, field: string) {
    const hash = hashStore.get(key)
    if (!hash) {
      return 0
    }
    const deleted = hash.delete(field)
    return deleted ? 1 : 0
  }

  async hgetall(key: string) {
    const hash = hashStore.get(key)
    if (!hash) {
      return {}
    }
    const result: Record<string, string> = {}
    hash.forEach((value, field) => {
      result[field] = value
    })
    return result
  }

  // List operations
  async lpush(key: string, ...values: string[]) {
    if (!listStore.has(key)) {
      listStore.set(key, [])
    }
    const list = listStore.get(key)!
    values.forEach((value) => list.unshift(value))
    return list.length
  }

  async rpush(key: string, ...values: string[]) {
    if (!listStore.has(key)) {
      listStore.set(key, [])
    }
    const list = listStore.get(key)!
    values.forEach((value) => list.push(value))
    return list.length
  }

  async lpop(key: string) {
    const list = listStore.get(key)
    return list && list.length > 0 ? list.shift()! : null
  }

  async rpop(key: string) {
    const list = listStore.get(key)
    return list && list.length > 0 ? list.pop()! : null
  }

  async lrange(key: string, start: number, end: number) {
    const list = listStore.get(key) || []
    // Handle negative indices and convert end=-1 to the end of the array
    const adjustedEnd = end < 0 ? list.length + end + 1 : end + 1
    return list.slice(start, adjustedEnd)
  }

  async lrem(key: string, count: number, value: string) {
    const list = listStore.get(key)
    if (!list) {
      return 0
    }

    let removed = 0
    if (count === 0) {
      // Remove all occurrences
      const newList = list.filter((item) => item !== value)
      removed = list.length - newList.length
      listStore.set(key, newList)
    } else if (count > 0) {
      // Remove first count occurrences
      for (let i = 0; i < count; i++) {
        const index = list.indexOf(value)
        if (index === -1) {
          break
        }
        list.splice(index, 1)
        removed++
      }
    } else {
      // Remove last count occurrences
      count = Math.abs(count)
      for (let i = 0; i < count; i++) {
        const index = list.lastIndexOf(value)
        if (index === -1) {
          break
        }
        list.splice(index, 1)
        removed++
      }
    }

    return removed
  }

  async llen(key: string) {
    const list = listStore.get(key)
    return list ? list.length : 0
  }

  // Set operations
  async sadd(key: string, ...members: string[]) {
    if (!setStore.has(key)) {
      setStore.set(key, new Set())
    }
    const set = setStore.get(key)!
    let added = 0
    members.forEach((member) => {
      if (!set.has(member)) {
        set.add(member)
        added++
      }
    })
    return added
  }

  async srem(key: string, ...members: string[]) {
    const set = setStore.get(key)
    if (!set) {
      return 0
    }
    let removed = 0
    members.forEach((member) => {
      if (set.has(member)) {
        set.delete(member)
        removed++
      }
    })
    return removed
  }

  async smembers(key: string) {
    const set = setStore.get(key)
    return set ? Array.from(set) : []
  }

  // Other operations
  async incr(key: string) {
    const value = store.get(key)
    const num = value ? parseInt(value, 10) + 1 : 1
    store.set(key, num.toString())
    return num
  }

  async keys(pattern: string) {
    // Simple glob pattern matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return Array.from(store.keys()).filter((key) => regex.test(key))
  }

  // Missing method from interface
  async deletePattern(pattern: string) {
    const keys = await this.keys(pattern)
    for (const key of keys) {
      await this.del(key)
    }
  }

  // Sorted set operations
  async zadd(key: string, score: number, member: string) {
    if (!zsetStore.has(key)) {
      zsetStore.set(key, new Map())
    }
    const zset = zsetStore.get(key)!
    const existed = zset.has(member)
    zset.set(member, score)
    return existed ? 0 : 1
  }

  async zrangebyscore(key: string, min: string | number, max: string | number) {
    const zset = zsetStore.get(key)
    if (!zset) {
      return []
    }

    const minScore = min === '-inf' ? Number.NEGATIVE_INFINITY : Number(min)
    const maxScore = max === '+inf' ? Number.POSITIVE_INFINITY : Number(max)

    const result: string[] = []
    zset.forEach((score, member) => {
      if (score >= minScore && score <= maxScore) {
        result.push(member)
      }
    })

    return result
  }

  async zremrangebyscore(
    key: string,
    min: string | number,
    max: string | number,
  ) {
    const zset = zsetStore.get(key)
    if (!zset) {
      return 0
    }

    const minScore = min === '-inf' ? Number.NEGATIVE_INFINITY : Number(min)
    const maxScore = max === '+inf' ? Number.POSITIVE_INFINITY : Number(max)

    let removed = 0
    const toRemove: string[] = []

    zset.forEach((score, member) => {
      if (score >= minScore && score <= maxScore) {
        toRemove.push(member)
      }
    })

    toRemove.forEach((member) => {
      zset.delete(member)
      removed++
    })

    return removed
  }
}
