/**
 * This file is loaded before all tests across the entire project
 */

import { afterEach, beforeEach, vi } from 'vitest'

// CRITICAL: Mock React module to add act before react-dom loads it
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')

  const reactAct = (callback: () => void | Promise<void>): Promise<void> => {
    const result = callback()
    if (result && typeof result === 'object' && 'then' in result) {
      return Promise.resolve(result).then(() => {
        if (typeof queueMicrotask !== 'undefined') {
          return new Promise<void>((resolve) => queueMicrotask(() => resolve()))
        }
        return Promise.resolve()
      })
    }
    if (typeof queueMicrotask !== 'undefined') {
      return new Promise<void>((resolve) => queueMicrotask(() => resolve()))
    }
    return Promise.resolve()
  }

  return {
    ...actual,
    act: reactAct,
  }
})

import '@testing-library/jest-dom/vitest'
import '../src/test/setup-react19'

// MSW setup disabled due to import resolution issues with Vite
// Tests should run fine without MSW as they have comprehensive mocking

// Global test environment setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
})

// Mock environment variables for tests
vi.mock('astro:env/server', () => ({
  REDIS_URL:
    process.env['REDIS_URL'] ||
    'rediss://default:AS3JAAIjcDFlOGQ0YWIzOGYxYmU0MDU3YTlmZGFmYjI1NjQ1OGUwZHAxMA@neutral-ray-11721.upstash.io:6379',
  UPSTASH_REDIS_REST_URL:
    process.env['UPSTASH_REDIS_REST_URL'] ||
    'https://neutral-ray-11721.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:
    process.env['UPSTASH_REDIS_REST_TOKEN'] ||
    'AS3JAAIjcDFlOGQ0YWIzOGYxYmU0MDU3YTlmZGFmYjI1NjQ1OGUwZHAxMA',
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env['DATABASE_URL'] || 'mongodb://localhost:27017/pixelated_test',
  MONGODB_URI:
    process.env['MONGODB_URI'] || 'mongodb://localhost:27017/pixelated_test',
}))

// Mock Redis service for tests that don't need real Redis
// Create a stateful in-memory Redis mock (copied and simplified from RedisService.createMockClient)
function createMockRedis() {
  type RedisValue = unknown
  type RedisHashValue = unknown
  type RedisMember = unknown

  const store = new Map<string, RedisValue>()
  const setStore = new Map<string, Set<RedisMember>>()
  const hashStore = new Map<string, Map<string, RedisHashValue>>()
  const zsetStore = new Map<string, Map<RedisMember, number>>()
  const expirations = new Map<string, number>()

  // implement functions first so we can wrap them with vi.fn for spying
  const _get = async (k) => {
    // Check TTLs
    const exp = expirations.get(k)
    if (exp && Date.now() > exp) {
      store.delete(k)
      expirations.delete(k)
      return null
    }
    return store.has(k) ? store.get(k) : null
  }

  const _set = async (k, v) => {
    store.set(k, String(v))
    // clear expiration on plain set
    expirations.delete(k)
    return 'OK'
  }
  const _del = async (...keys: string[]) => {
    let deleted = 0
    for (const k of keys) {
      if (store.delete(k)) {
        deleted++
      }
      expirations.delete(k)
    }
    return deleted
  }

  // Return boolean for exists to match caller expectations
  const _exists = async (k) => store.has(k)
  const _keys = async (pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return Array.from(store.keys()).filter((key) => regex.test(key))
  }
  const _flushall = async () => {
    store.clear()
    setStore.clear()
    hashStore.clear()
    zsetStore.clear()
    expirations.clear()
    return 'OK'
  }

  const _ping = async () => 'PONG'
  const _disconnect = async () => undefined
  const _hset = async (key, field, value) => {
    if (!hashStore.has(key)) {
      hashStore.set(key, new Map())
    }
    const hash = hashStore.get(key)!
    const existed = hash.has(field)
    hash.set(field, String(value))
    return existed ? 0 : 1
  }

  const _hget = async (key, field) => {
    const hash = hashStore.get(key)
    return hash ? hash.get(field) || null : null
  }

  const _hgetall = async (key) => {
    const hash = hashStore.get(key)
    if (!hash) {
      return {}
    }
    const out = {}
    hash.forEach((v, f) => (out[f] = v))
    return out
  }

  const _hdel = async (key, field) => {
    const hash = hashStore.get(key)
    if (!hash) {
      return 0
    }
    return hash.delete(field) ? 1 : 0
  }
  const _sadd = async (key, member) => {
    if (!setStore.has(key)) {
      setStore.set(key, new Set())
    }
    const s = setStore.get(key)!
    const existed = s.has(member)
    s.add(member)
    return existed ? 0 : 1
  }

  const _srem = async (key, member) => {
    if (!setStore.has(key)) {
      return 0
    }
    return setStore.get(key)!.delete(member) ? 1 : 0
  }

  const _smembers = async (key) =>
    setStore.has(key) ? Array.from(setStore.get(key)!) : []
  const _zadd = async (key, score, member) => {
    if (!zsetStore.has(key)) {
      zsetStore.set(key, new Map())
    }
    const z = zsetStore.get(key)!
    const existed = z.has(member)
    z.set(member, Number(score))
    return existed ? 0 : 1
  }

  const _zrem = async (key, member) => {
    const z = zsetStore.get(key)
    if (!z) {
      return 0
    }
    return z.delete(member) ? 1 : 0
  }

  const _zrange = async (key, start, stop, withScores) => {
    const z = zsetStore.get(key)
    if (!z) {
      return []
    }
    const entries: Array<[RedisMember, number]> = Array.from(z.entries())
    const sorted = entries.sort((a, b) => (a[1] as number) - (b[1] as number))
    const slice =
      stop === -1 ? sorted.slice(start) : sorted.slice(start, stop + 1)
    if (withScores === 'WITHSCORES') {
      return slice.map((entry) => ({ value: entry[0], score: entry[1] }))
    }
    return slice.map((entry) => entry[0])
  }

  const _zpopmin = async (key) => {
    const z = zsetStore.get(key)
    if (!z || z.size === 0) {
      return []
    }
    const entries: Array<[RedisMember, number]> = Array.from(z.entries())
    const sorted = entries.sort((a, b) => (a[1] as number) - (b[1] as number))
    const [member, score] = sorted[0]!
    z.delete(member)
    return [{ value: member, score }]
  }
  // Counters and TTLs
  const _incr = async (key) => {
    const val = store.get(key)
    const num = val ? parseInt(val, 10) + 1 : 1
    store.set(key, String(num))
    return num
  }

  const _decr = async (key) => {
    const val = store.get(key)
    const num = val ? parseInt(val, 10) - 1 : -1
    store.set(key, String(num))
    return num
  }
  // TTL helpers: ttl returns seconds remaining, pttl returns ms
  const _ttl = async (key) => {
    if (!store.has(key)) {
      return -2
    }
    const exp = expirations.get(key)
    if (!exp) {
      return -1
    }
    const secs = Math.ceil((exp - Date.now()) / 1000)
    return secs > 0 ? secs : -2
  }

  const _pttl = async (key) => {
    if (!store.has(key)) {
      return -2
    }
    const exp = expirations.get(key)
    if (!exp) {
      return -1
    }
    const ms = exp - Date.now()
    return ms > 0 ? ms : -2
  }
  // setex and expire
  const _setex = async (key, ttlSeconds, value) => {
    store.set(key, String(value))
    expirations.set(key, Date.now() + Number(ttlSeconds) * 1000)
    return 'OK'
  }

  const _expire = async (key, ttlSeconds) => {
    if (!store.has(key)) {
      return 0
    }
    expirations.set(key, Date.now() + Number(ttlSeconds) * 1000)
    return 1
  }
  // mget/mset
  const _mget = async (...keys: string[]) =>
    keys.map((k) => (store.has(k) ? store.get(k) : null))
  const _mset = async (obj: Record<string, unknown>) => {
    Object.entries(obj).forEach(([k, v]) => store.set(k, String(v)))
    return 'OK'
  }
  // incrby/decrby
  const _incrby = async (key, by) => {
    const val = store.get(key)
    const num = val ? parseInt(val, 10) + Number(by) : Number(by)
    store.set(key, String(num))
    return num
  }

  const _decrby = async (key, by) => {
    const val = store.get(key)
    const num = val ? parseInt(val, 10) - Number(by) : -Number(by)
    store.set(key, String(num))
    return num
  }
  const _deletePattern = async (pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    const keys = Array.from(store.keys()).filter((k) => regex.test(k))
    keys.forEach((k) => store.delete(k))
    return keys.length
  }
  interface RedisPipeline {
    get: (key: string) => RedisPipeline
    set: (key: string, value: unknown) => RedisPipeline
    setex: (key: string, ttl: number, value: unknown) => RedisPipeline
    sadd: (key: string, member: unknown) => RedisPipeline
    expire: (key: string, ttl: number) => RedisPipeline
    del: (...keys: string[]) => RedisPipeline
    exec: () => Promise<unknown>
    pipeline?: RedisPipeline
  }

  const _multi = (): RedisPipeline => {
    const commands: Array<{ cmd: string; args: unknown[] }> = []
    const pipeline: RedisPipeline = {
      // support queuing get/set so tests using pipeline/multi behave
      get: (key: string) => {
        commands.push({ cmd: 'get', args: [key] })
        return pipeline
      },
      set: (key: string, value: unknown) => {
        commands.push({ cmd: 'set', args: [key, value] })
        return pipeline
      },
      setex: (key: string, ttl: number, value: unknown) => {
        commands.push({ cmd: 'setex', args: [key, ttl, value] })
        return pipeline
      },
      sadd: (key: string, member: unknown) => {
        commands.push({ cmd: 'sadd', args: [key, member] })
        return pipeline
      },
      expire: (key: string, ttl: number) => {
        commands.push({ cmd: 'expire', args: [key, ttl] })
        return pipeline
      },
      del: (...keys: string[]) => {
        commands.push({ cmd: 'del', args: keys })
        return pipeline
      },
      exec: async () => {
        const results: unknown[] = []
        for (const c of commands) {
          if (c.cmd === 'setex') {
            const [_k, ttl, value] = c.args
            store.set(_k, String(value))
            expirations.set(_k, Date.now() + Number(ttl) * 1000)
            results.push([null, 'OK'])
          } else if (c.cmd === 'get') {
            const [k] = c.args
            const exp = expirations.get(k)
            if (exp && Date.now() > exp) {
              store.delete(k)
              expirations.delete(k)
              results.push([null, null])
            } else {
              results.push([null, store.has(k) ? store.get(k) : null])
            }
          } else if (c.cmd === 'set') {
            const [k, v] = c.args
            store.set(k, String(v))
            expirations.delete(k)
            results.push([null, 'OK'])
          } else if (c.cmd === 'sadd') {
            const [k, member] = c.args
            if (!setStore.has(k)) {
              setStore.set(k, new Set())
            }
            const s = setStore.get(k)!
            const existed = s.has(member)
            s.add(member)
            results.push([null, existed ? 0 : 1])
          } else if (c.cmd === 'expire') {
            const [k, ttl] = c.args
            if (!store.has(k)) {
              results.push([null, 0])
            } else {
              expirations.set(k, Date.now() + Number(ttl) * 1000)
              results.push([null, 1])
            }
          } else if (c.cmd === 'del') {
            const keys = c.args as string[]
            let deleted = 0
            for (const key of keys) {
              if (store.delete(key)) {
                deleted++
              }
              expirations.delete(key)
            }
            results.push([null, deleted])
          } else {
            results.push([null, null])
          }
        }
        return results
      },
    }

    // pipeline alias commonly used in some clients
    ;(pipeline as unknown as { pipeline?: RedisPipeline }).pipeline = pipeline
    return pipeline
  }
  const _connect = async () => undefined
  const _getPoolStats = async () => ({
    totalConnections: 1,
    activeConnections: 1,
    idleConnections: 0,
    waitingClients: 0,
  })
  // pub/sub (no-op for tests)
  const _publish = async (_channel: string, _message: unknown) => 0
  const _subscribe = async (_channel: string) => undefined
  const _unsubscribe = async (_channel: string) => undefined
  // scan convenience
  const _scan = async (_cursor: number, matchPattern?: string) => {
    const all = Array.from(store.keys())
    let keys = all
    if (matchPattern) {
      const regex = new RegExp('^' + matchPattern.replace(/\*/g, '.*') + '$')
      keys = all.filter((k) => regex.test(k))
    }
    return [String(0), keys]
  }

  // ensure getClient is available on the mock
  const _getClient = () => mock
  const _lpush = async (key, value) => {
    const listKey = `__list__:${key}`
    if (!store.has(listKey)) {
      store.set(listKey, JSON.stringify([]))
    }
    const arr = JSON.parse(store.get(listKey))
    arr.unshift(value)
    store.set(listKey, JSON.stringify(arr))
    return arr.length
  }

  const _rpoplpush = async (src, dest) => {
    const srcKey = `__list__:${src}`
    const destKey = `__list__:${dest}`
    const srcArr = store.has(srcKey) ? JSON.parse(store.get(srcKey)) : []
    if (srcArr.length === 0) {
      return null
    }
    const val = srcArr.pop()
    store.set(srcKey, JSON.stringify(srcArr))
    const destArr = store.has(destKey) ? JSON.parse(store.get(destKey)) : []
    destArr.push(val)
    store.set(destKey, JSON.stringify(destArr))
    return val
  }

  const _lrem = async (key, _count, value) => {
    const listKey = `__list__:${key}`
    const arr = store.has(listKey) ? JSON.parse(store.get(listKey)) : []
    const filtered = arr.filter((v) => v !== value)
    store.set(listKey, JSON.stringify(filtered))
    return arr.length - filtered.length
  }

  const _llen = async (key) => {
    const listKey = `__list__:${key}`
    const arr = store.has(listKey) ? JSON.parse(store.get(listKey)) : []
    return arr.length
  }

  const _lrange = async (key, start, stop) => {
    const listKey = `__list__:${key}`
    const arr = store.has(listKey) ? JSON.parse(store.get(listKey)) : []
    return arr.slice(start, stop + 1)
  }

  const _brpop = async (key) => {
    const listKey = `__list__:${key}`
    const arr = store.has(listKey) ? JSON.parse(store.get(listKey)) : []
    if (arr.length === 0) {
      return null
    }
    const val = arr.pop()
    store.set(listKey, JSON.stringify(arr))
    return [key, val]
  }

  // now assemble mock with vi.fn wrappers so tests can spy on calls
  const mock: Record<string, unknown> = {
    get: vi.fn(_get),
    set: vi.fn(_set),
    del: vi.fn(_del),
    exists: vi.fn(_exists),
    keys: vi.fn(_keys),
    flushall: vi.fn(_flushall),
    ping: vi.fn(_ping),
    disconnect: vi.fn(_disconnect),
    hset: vi.fn(_hset),
    hget: vi.fn(_hget),
    hgetall: vi.fn(_hgetall),
    hdel: vi.fn(_hdel),
    sadd: vi.fn(_sadd),
    srem: vi.fn(_srem),
    smembers: vi.fn(_smembers),
    zadd: vi.fn(_zadd),
    zrem: vi.fn(_zrem),
    zrange: vi.fn(_zrange),
    zpopmin: vi.fn(_zpopmin),
    incr: vi.fn(_incr),
    decr: vi.fn(_decr),
    ttl: vi.fn(_ttl),
    pttl: vi.fn(_pttl),
    setex: vi.fn(_setex),
    expire: vi.fn(_expire),
    mget: vi.fn(_mget),
    mset: vi.fn(_mset),
    incrby: vi.fn(_incrby),
    decrby: vi.fn(_decrby),
    deletePattern: vi.fn(_deletePattern),
    multi: vi.fn(() => {
      const p = _multi()
      // wrap pipeline functions so they are spy-able as well
      p.get = vi.fn(p.get)
      p.set = vi.fn(p.set)
      p.setex = vi.fn(p.setex)
      p.sadd = vi.fn(p.sadd)
      p.expire = vi.fn(p.expire)
      p.del = vi.fn(p.del)
      p.exec = vi.fn(p.exec)
      p.pipeline = p
      return p
    }),
    pipeline: vi.fn(() => _multi()),
    isHealthy: vi.fn(_isHealthy),
    connect: vi.fn(_connect),
    getPoolStats: vi.fn(_getPoolStats),
    publish: vi.fn(_publish),
    subscribe: vi.fn(_subscribe),
    unsubscribe: vi.fn(_unsubscribe),
    scan: vi.fn(_scan),
    getClient: vi.fn(_getClient),
    lpush: vi.fn(_lpush),
    rpoplpush: vi.fn(_rpoplpush),
    lrem: vi.fn(_lrem),
    llen: vi.fn(_llen),
    lrange: vi.fn(_lrange),
    brpop: vi.fn(_brpop),
  }

  return mock
}

const globalMockRedis = createMockRedis()

vi.mock('@/lib/services/redis', () => {
  const impl = Object.assign({}, globalMockRedis, {
    getClient: () => globalMockRedis,
    isConnected: () => true,
  })
  return {
    redis: globalMockRedis,
    RedisService: vi.fn().mockImplementation(() => impl),
  }
})

// Also mock the raw redis client module so imports from '@/lib/redis' get the same mocked API
vi.mock('@/lib/redis', () => ({
  redis: globalMockRedis,
}))

// Also mock the RedisService class directly for tests that import it
vi.mock('@/lib/services/redis/RedisService', () => {
  const impl = Object.assign({}, globalMockRedis, {
    getClient: () => globalMockRedis,
    isConnected: () => true,
  })
  return {
    RedisService: vi.fn().mockImplementation(() => impl),
  }
})

// Also mock relative imports for tests in subdirectories
vi.mock('../RedisService', () => {
  const impl = Object.assign({}, globalMockRedis, {
    getClient: () => globalMockRedis,
    isConnected: () => true,
  })
  return {
    RedisService: vi.fn().mockImplementation(() => impl),
  }
})

// Mock audit logging for security tests
vi.mock('@/lib/security/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditEventType: {
    DLP_ALLOWED: 'DLP_ALLOWED',
    DLP_BLOCKED: 'DLP_BLOCKED',
    DLP_REDACTED: 'DLP_REDACTED',
    CREATE: 'CREATE',
    SECURITY: 'SECURITY',
  },
}))

// Mock backup security manager
vi.mock('@/lib/security/backup', () => {
  const mockBackupManager = {
    getInstance: vi.fn().mockReturnValue({
      initialize: vi.fn().mockResolvedValue(undefined),
      createBackup: vi.fn().mockResolvedValue('test-backup-id'),
      verifyBackup: vi.fn().mockResolvedValue(true),
      restoreBackup: vi.fn().mockResolvedValue(true),
      getStorageProvider: vi.fn().mockReturnValue({
        initialize: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([]),
        storeFile: vi.fn().mockResolvedValue(undefined),
        getFile: vi.fn().mockResolvedValue(new Uint8Array()),
        deleteFile: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }

  return {
    BackupSecurityManager: mockBackupManager,
    default: mockBackupManager,
    // Mock types as well
    BackupType: {
      FULL: 'FULL',
      DIFFERENTIAL: 'DIFFERENTIAL',
      TRANSACTION: 'TRANSACTION',
      INCREMENTAL: 'INCREMENTAL',
    },
    BackupStatus: {
      PENDING: 'PENDING',
      COMPLETED: 'COMPLETED',
      FAILED: 'FAILED',
    },
    StorageLocation: {
      PRIMARY: 'PRIMARY',
      SECONDARY: 'SECONDARY',
      TERTIARY: 'TERTIARY',
    },
  }
})

// Mock storage providers wrapper
vi.mock('@/lib/security/backup/storage-providers-wrapper', () => ({
  getStorageProvider: vi.fn().mockResolvedValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    storeFile: vi.fn().mockResolvedValue(undefined),
    getFile: vi.fn().mockResolvedValue(new Uint8Array()),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  }),
  createMockStorageProvider: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    storeFile: vi.fn().mockResolvedValue(undefined),
    getFile: vi.fn().mockResolvedValue(new Uint8Array()),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Mock crypto for FHE tests
vi.mock('@/lib/fhe/crypto', () => ({
  fhe: {
    encrypt: vi.fn().mockReturnValue('encrypted_data'),
    decrypt: vi.fn().mockReturnValue('decrypted_data'),
    verifySender: vi.fn().mockReturnValue(true),
  },
}))

// Mock Astro runtime
vi.mock('astro/runtime/server/index.js', () => ({
  createAstro: () => ({
    props: {},
    request: new Request('http://localhost:3000'),
    params: {},
    url: new URL('http://localhost:3000'),
  }),
}))

// Polyfill for Node.js globals in test environment
globalThis.Request = globalThis.Request || Request
globalThis.Response = globalThis.Response || Response
globalThis.Headers = globalThis.Headers || Headers
globalThis.fetch = globalThis.fetch || fetch

// Setup garbage collection for memory management in tests
declare const global: { gc?: () => void }

if (process.env['CI'] && global.gc) {
  afterEach(() => {
    // Force garbage collection after memory-intensive tests
    global.gc?.()
  })
}

export { }
