/**
 * CSRF token store.
 *
 * The Worker has no reachable Redis host, so CSRF tokens are written to a
 * Cloudflare KV namespace (`CSRF_TOKENS`, declared in `wrangler.jsonc`). Node
 * and Vercel deployments have no KV binding and keep using the existing Redis
 * cache. When neither backend exists the store reports itself unavailable and
 * the caller keeps its documented contract: 503 when minting a token, 403 when
 * validating one.
 *
 * The binding is read from the Astro Cloudflare adapter's runtime env — the
 * `locals` the route and `csrfProtection` pass in, then the adapter-provided
 * `cloudflare:workers` env — never from a bare global.
 */
import { getFromCache, setInCache } from '../redis'

/** Binding name declared in `wrangler.jsonc` (`kv_namespaces`). */
export const CSRF_KV_BINDING = 'CSRF_TOKENS'

/** Documented token lifetime: one hour, applied as the KV entry expiry. */
export const CSRF_TOKEN_TTL_SECONDS = 60 * 60

/** Key prefix `csrfProtection` has always validated against. */
const CSRF_TOKEN_KEY_PREFIX = 'csrf:'

export interface CsrfTokenRecord {
  token: string
  expiresAt: number
}

/**
 * The subset of `KVNamespace` this store uses. Structural so tests can pass a
 * plain object and the module stays free of Workers type globals.
 */
export interface CsrfKvNamespace {
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete?(key: string): Promise<void>
}

/** The subset of the Redis cache helpers this store uses. */
export interface CsrfCacheBackend {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>
}

type CsrfStoreKind = 'kv' | 'redis' | 'unavailable'

export interface CsrfStore {
  readonly kind: CsrfStoreKind
  /** Returns false when the token could not be persisted. */
  store(
    token: string,
    record: CsrfTokenRecord,
    ttlSeconds?: number,
  ): Promise<boolean>
  /** Returns null on miss, expiry, or backend failure. */
  load(token: string): Promise<CsrfTokenRecord | null>
}

function csrfKey(token: string): string {
  return `${CSRF_TOKEN_KEY_PREFIX}${token}`
}

function isCsrfTokenRecord(value: unknown): value is CsrfTokenRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<CsrfTokenRecord>
  return (
    typeof record.token === 'string' && typeof record.expiresAt === 'number'
  )
}

function createKvCsrfStore(kv: CsrfKvNamespace): CsrfStore {
  return {
    kind: 'kv',
    async store(token, record, ttlSeconds = CSRF_TOKEN_TTL_SECONDS) {
      try {
        await kv.put(csrfKey(token), JSON.stringify(record), {
          expirationTtl: ttlSeconds,
        })
        return true
      } catch {
        return false
      }
    },
    async load(token) {
      try {
        const raw = await kv.get(csrfKey(token))
        if (raw === null) return null
        const parsed: unknown = JSON.parse(raw)
        return isCsrfTokenRecord(parsed) ? parsed : null
      } catch {
        return null
      }
    },
  }
}

function createRedisCsrfStore(cache: CsrfCacheBackend): CsrfStore {
  return {
    kind: 'redis',
    async store(token, record, ttlSeconds = CSRF_TOKEN_TTL_SECONDS) {
      return cache.set(csrfKey(token), record, ttlSeconds)
    },
    async load(token) {
      return cache.get<CsrfTokenRecord>(csrfKey(token))
    },
  }
}

const unavailableCsrfStore: CsrfStore = {
  kind: 'unavailable',
  async store() {
    return false
  },
  async load() {
    return null
  },
}

/** The existing Redis cache, used when no KV binding is present. */
const redisCsrfCacheBackend: CsrfCacheBackend = {
  get: <T>(key: string) => getFromCache<T>(key),
  set: (key, value, ttlSeconds) => setInCache(key, value, ttlSeconds),
}

/**
 * Build a store from explicit backends.
 *
 * `kv` wins when present. Otherwise `cache` (the Redis helpers by default) is
 * used, and `cache: null` with no `kv` yields the unavailable store.
 */
export function createCsrfStore(
  options: {
    kv?: CsrfKvNamespace | null
    cache?: CsrfCacheBackend | null
  } = {},
): CsrfStore {
  if (options.kv) {
    return createKvCsrfStore(options.kv)
  }
  const cache =
    options.cache === undefined ? redisCsrfCacheBackend : options.cache
  if (cache) {
    return createRedisCsrfStore(cache)
  }
  return unavailableCsrfStore
}

function asKvNamespace(value: unknown): CsrfKvNamespace | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CsrfKvNamespace>
  if (typeof candidate.get !== 'function') return null
  if (typeof candidate.put !== 'function') return null
  return candidate as CsrfKvNamespace
}

/**
 * Read the binding from the adapter runtime env attached to Astro `locals`.
 *
 * Astro ≤5 exposed it as `locals.runtime.env`. Adapter 14 (Astro 7) replaced
 * that getter with one that throws, so the probe is defensive and falls
 * through to the `cloudflare:workers` env below.
 */
function bindingFromLocals(locals: unknown): CsrfKvNamespace | null {
  if (!locals || typeof locals !== 'object') return null
  try {
    const runtime = (locals as { runtime?: { env?: Record<string, unknown> } })
      .runtime
    const env = runtime?.env
    if (!env || typeof env !== 'object') return null
    return asKvNamespace(env[CSRF_KV_BINDING])
  } catch {
    return null
  }
}

/**
 * Read the binding from the adapter-provided Worker env.
 *
 * Imported lazily for the same reason the adapter does it: a top-level
 * `cloudflare:workers` import cannot load outside the Workers runtime, and the
 * Node/Vercel build and the unit tests must keep working.
 */
async function bindingFromWorkerRuntime(): Promise<CsrfKvNamespace | null> {
  try {
    const workerEnv = (await import('cloudflare:workers')) as {
      env?: Record<string, unknown>
    }
    return asKvNamespace(workerEnv.env?.[CSRF_KV_BINDING])
  } catch {
    return null
  }
}

/** Resolve the KV binding from the adapter runtime env, if one is bound. */
async function resolveCsrfKvBinding(
  locals?: unknown,
): Promise<CsrfKvNamespace | null> {
  return bindingFromLocals(locals) ?? (await bindingFromWorkerRuntime())
}

/**
 * Resolve the store for a request: KV when the Worker binds one, the existing
 * Redis cache otherwise.
 */
export async function resolveCsrfStore(locals?: unknown): Promise<CsrfStore> {
  return createCsrfStore({ kv: await resolveCsrfKvBinding(locals) })
}
