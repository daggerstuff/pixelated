/**
 * Lazy MCP client helper — extracted from src/lib/context/optimization.ts
 * so eve agents can resolve it within their own package boundary.
 */

export interface LazyConnection<T> {
  get: () => Promise<T>
  isLoaded: () => boolean
  unload: () => Promise<void>
  close: () => Promise<void>
}

export function createLazyResource<T>(
  factory: () => T | Promise<T>,
): LazyConnection<T> {
  let cached: T | undefined
  let loading: Promise<T> | undefined
  let loadGeneration = 0
  let closing = false

  const closeIfCloseable = async (resource: T): Promise<void> => {
    if (
      resource != null &&
      typeof (resource as { close?: unknown }).close === 'function'
    ) {
      await (resource as unknown as { close: () => Promise<void> }).close()
    }
  }

  return {
    isLoaded: () => cached !== undefined,
    get: async () => {
      if (closing) throw new Error('Resource is closing')
      if (cached !== undefined) return cached
      if (loading !== undefined) return loading

      const gen = ++loadGeneration
      const promise = Promise.resolve(factory())
        .then((resource) => {
          if (loadGeneration !== gen) {
            void closeIfCloseable(resource)
            return resource
          }
          cached = resource
          return resource
        })
        .catch((err) => {
          if (loadGeneration === gen) {
            loading = undefined
          }
          throw err
        })
        .finally(() => {
          if (loadGeneration === gen) {
            loading = undefined
          }
        })

      loading = promise
      return loading
    },
    unload: async () => {
      cached = undefined
      loadGeneration++
      const currentLoading = loading
      loading = undefined
      if (currentLoading) {
        try {
          await currentLoading
        } catch {
          // ignore errors from the discarded load
        }
      }
    },
    close: async () => {
      if (closing) return
      closing = true

      let resource: T | undefined
      if (loading) {
        try {
          resource = await loading
        } catch {
          // Factory failed — nothing to close.
        }
      }
      resource ??= cached

      if (resource) {
        await closeIfCloseable(resource)
      }

      cached = undefined
      loading = undefined
      loadGeneration++
    },
  }
}

export function createLazyMcpClient<T extends { close(): Promise<void> }>(
  factory: () => Promise<T>,
): {
  getClient: () => Promise<T>
  close: () => Promise<void>
} {
  const lazyClient = createLazyResource<T>(factory)

  return {
    getClient: async () => lazyClient.get(),
    close: async () => lazyClient.close(),
  }
}
