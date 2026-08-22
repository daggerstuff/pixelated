// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the logger so tests don't depend on console output
vi.mock('../../../utils/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import {
  OfflineSyncService,
  type SyncAction,
  type EnqueueInput,
} from '../offline-sync.service'

// ---------------------------------------------------------------------------
// Mutable IDBRequest mock
// ---------------------------------------------------------------------------

interface MutableIDBRequest<T = unknown> {
  result: T
  error: Error | null
  source: unknown
  transaction: unknown
  readyState: string
  onsuccess: ((ev: Event) => void) | null
  onerror: ((ev: Event) => void) | null
}

function createRequest<T = unknown>(): MutableIDBRequest<T> {
  return {
    result: undefined as T,
    error: null,
    source: undefined,
    transaction: null,
    readyState: 'pending',
    onsuccess: null,
    onerror: null,
  }
}

// ---------------------------------------------------------------------------
// Mock Response helper
// ---------------------------------------------------------------------------

function mockResponse(status: number, body: string = '{}'): Response {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(JSON.parse(body)),
    text: () => Promise.resolve(body),
    clone() {
      return mockResponse(status, body)
    },
  }
  return res as unknown as Response
}

// ---------------------------------------------------------------------------
// In-memory IndexedDB mock
// ---------------------------------------------------------------------------

interface MockStore {
  data: Map<string, SyncAction>
}

function createMockIndexedDB() {
  const store: MockStore = { data: new Map() }

  const mockStore = {
    add: (value: SyncAction): MutableIDBRequest => {
      const req = createRequest()
      if (store.data.has(value.id)) {
        setTimeout(() => {
          req.error = new Error('Key already exists')
          req.onerror?.(new Event('error'))
        }, 0)
      } else {
        store.data.set(value.id, value)
        setTimeout(() => {
          req.result = value
          req.onsuccess?.(new Event('success'))
        }, 0)
      }
      return req
    },
    put: (value: SyncAction): MutableIDBRequest => {
      const req = createRequest()
      store.data.set(value.id, value)
      setTimeout(() => {
        req.result = value
        req.onsuccess?.(new Event('success'))
      }, 0)
      return req
    },
    get: (key: string): MutableIDBRequest => {
      const req = createRequest()
      setTimeout(() => {
        req.result = store.data.get(key) ?? null
        req.onsuccess?.(new Event('success'))
      }, 0)
      return req
    },
    getAll: (): MutableIDBRequest => {
      const req = createRequest()
      setTimeout(() => {
        req.result = Array.from(store.data.values())
        req.onsuccess?.(new Event('success'))
      }, 0)
      return req
    },
    delete: (key: string): MutableIDBRequest => {
      const req = createRequest()
      store.data.delete(key)
      setTimeout(() => {
        req.result = undefined
        req.onsuccess?.(new Event('success'))
      }, 0)
      return req
    },
    clear: (): MutableIDBRequest => {
      const req = createRequest()
      store.data.clear()
      setTimeout(() => {
        req.result = undefined
        req.onsuccess?.(new Event('success'))
      }, 0)
      return req
    },
  }

  const mockDB = {
    objectStoreNames: { contains: (name: string) => name === 'offline_queue' },
    transaction: vi.fn((_storeName: string, _mode: string) => {
      const tx = {
        objectStore: () => mockStore,
        onerror: null as ((ev: Event) => void) | null,
        error: null as DOMException | null,
      }
      return tx
    }),
    close: vi.fn(),
  }

  const openRequest = {
    result: mockDB,
    onupgradeneeded: null as ((ev: Event) => void) | null,
    onsuccess: null as ((ev: Event) => void) | null,
    onerror: null as ((ev: Event) => void) | null,
    error: null as DOMException | null,
  }

  const mockIndexedDB = {
    open: vi.fn(() => {
      setTimeout(() => {
        openRequest.onsuccess?.(new Event('success'))
      }, 0)
      return openRequest
    }),
    _store: store,
    _db: mockDB,
  }

  return { mockIndexedDB, store, mockDB, openRequest }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeActionInput(
  type: 'note' | 'appointment' | 'message' = 'note',
  payload: Record<string, unknown> = { content: 'test' },
): EnqueueInput {
  return { type, payload }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OfflineSyncService', () => {
  let mockEnv: ReturnType<typeof createMockIndexedDB>
  let originalIndexedDB: typeof indexedDB | undefined
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    OfflineSyncService.resetInstance()
    mockEnv = createMockIndexedDB()
    originalIndexedDB = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', {
      value: mockEnv.mockIndexedDB,
      writable: true,
      configurable: true,
    })
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    OfflineSyncService.resetInstance()
    if (originalIndexedDB !== undefined) {
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      })
    } else {
      delete (globalThis as Record<string, unknown>)['indexedDB']
    }
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // --- Singleton pattern --------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance from getInstance()', () => {
      const a = OfflineSyncService.getInstance()
      const b = OfflineSyncService.getInstance()
      expect(a).toBe(b)
    })

    it('resetInstance creates a new instance on next getInstance()', () => {
      const a = OfflineSyncService.getInstance()
      OfflineSyncService.resetInstance()
      const b = OfflineSyncService.getInstance()
      expect(a).not.toBe(b)
    })
  })

  // --- enqueue ------------------------------------------------------------

  describe('enqueue', () => {
    it('stores an action and returns it with an id', async () => {
      const service = OfflineSyncService.getInstance()
      const result = await service.enqueue(makeActionInput('note', { text: 'hello' }))

      expect(result.id).toBeDefined()
      expect(result.type).toBe('note')
      expect(result.payload).toEqual({ text: 'hello' })
      expect(result.createdAt).toBeDefined()
      expect(result.retryCount).toBe(0)
    })

    it('generates unique ids for different actions', async () => {
      const service = OfflineSyncService.getInstance()
      const a = await service.enqueue(makeActionInput())
      const b = await service.enqueue(makeActionInput())
      expect(a.id).not.toBe(b.id)
    })

    it('sets createdAt as ISO string', async () => {
      const service = OfflineSyncService.getInstance()
      const result = await service.enqueue(makeActionInput())
      expect(() => new Date(result.createdAt).toISOString()).not.toThrow()
    })

    it('sets retryCount to 0 on new actions', async () => {
      const service = OfflineSyncService.getInstance()
      const result = await service.enqueue(makeActionInput())
      expect(result.retryCount).toBe(0)
    })

    it('persists the action to IndexedDB', async () => {
      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('appointment', { date: '2025-01-01' }))
      const queue = await service.getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0]?.type).toBe('appointment')
    })

    it('handles different action types', async () => {
      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('note'))
      await service.enqueue(makeActionInput('appointment'))
      await service.enqueue(makeActionInput('message'))
      const queue = await service.getQueue()
      expect(queue).toHaveLength(3)
      expect(queue.map((a) => a.type)).toContain('note')
      expect(queue.map((a) => a.type)).toContain('appointment')
      expect(queue.map((a) => a.type)).toContain('message')
    })

    it('returns action even when IndexedDB is unavailable', async () => {
      delete (globalThis as Record<string, unknown>)['indexedDB']
      const service = OfflineSyncService.getInstance()
      const result = await service.enqueue(makeActionInput())
      expect(result.id).toBeDefined()
      expect(result.type).toBe('note')
    })
  })

  // --- dequeue ------------------------------------------------------------

  describe('dequeue', () => {
    it('returns null when queue is empty', async () => {
      const service = OfflineSyncService.getInstance()
      const result = await service.dequeue()
      expect(result).toBeNull()
    })

    it('returns the oldest action (by createdAt)', async () => {
      const service = OfflineSyncService.getInstance()
      const first = await service.enqueue(makeActionInput('note', { order: 1 }))
      await new Promise((r) => setTimeout(r, 5))
      await service.enqueue(makeActionInput('note', { order: 2 }))

      const dequeued = await service.dequeue()
      expect(dequeued).not.toBeNull()
      expect(dequeued?.id).toBe(first.id)
    })

    it('removes the dequeued action from the queue', async () => {
      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())
      await service.dequeue()
      const queue = await service.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('returns null when IndexedDB is unavailable', async () => {
      delete (globalThis as Record<string, unknown>)['indexedDB']
      const service = OfflineSyncService.getInstance()
      const result = await service.dequeue()
      expect(result).toBeNull()
    })
  })

  // --- getQueue -----------------------------------------------------------

  describe('getQueue', () => {
    it('returns empty array when queue is empty', async () => {
      const service = OfflineSyncService.getInstance()
      const queue = await service.getQueue()
      expect(queue).toEqual([])
    })

    it('returns all queued actions', async () => {
      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('note'))
      await service.enqueue(makeActionInput('message'))
      const queue = await service.getQueue()
      expect(queue).toHaveLength(2)
    })

    it('returns empty array when IndexedDB is unavailable', async () => {
      delete (globalThis as Record<string, unknown>)['indexedDB']
      const service = OfflineSyncService.getInstance()
      const queue = await service.getQueue()
      expect(queue).toEqual([])
    })
  })

  // --- clearQueue ---------------------------------------------------------

  describe('clearQueue', () => {
    it('removes all actions from the queue', async () => {
      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())
      await service.enqueue(makeActionInput())
      await service.clearQueue()
      const queue = await service.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('does not throw when queue is already empty', async () => {
      const service = OfflineSyncService.getInstance()
      await expect(service.clearQueue()).resolves.toBeUndefined()
    })

    it('does not throw when IndexedDB is unavailable', async () => {
      delete (globalThis as Record<string, unknown>)['indexedDB']
      const service = OfflineSyncService.getInstance()
      await expect(service.clearQueue()).resolves.toBeUndefined()
    })
  })

  // --- syncAll ------------------------------------------------------------

  describe('syncAll', () => {
    it('returns empty result when queue is empty', async () => {
      const service = OfflineSyncService.getInstance()
      const result = await service.syncAll()
      expect(result.succeeded).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.skipped).toHaveLength(0)
    })

    it('succeeds for actions that return OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200))

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('note'))
      const result = await service.syncAll()

      expect(result.succeeded).toHaveLength(1)
      expect(result.failed).toHaveLength(0)
      expect(result.skipped).toHaveLength(0)
    })

    it('removes successful actions from the queue', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(200))

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())
      await service.syncAll()
      const queue = await service.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('increments retryCount on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(500))

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())
      const result = await service.syncAll()

      expect(result.succeeded).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      const queue = await service.getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0]?.retryCount).toBe(1)
    })

    it('increments retryCount on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new TypeError('Failed to fetch'),
      )

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())
      const result = await service.syncAll()

      expect(result.failed).toHaveLength(1)
      const queue = await service.getQueue()
      expect(queue[0]?.retryCount).toBe(1)
    })

    it('removes action after MAX_RETRIES (3) is reached', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(500))

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())

      // First sync: retryCount 0 -> 1
      await service.syncAll()
      let queue = await service.getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0]?.retryCount).toBe(1)

      // Second sync: retryCount 1 -> 2
      await service.syncAll()
      queue = await service.getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0]?.retryCount).toBe(2)

      // Third sync: retryCount 2 -> 3
      await service.syncAll()
      queue = await service.getQueue()
      expect(queue).toHaveLength(1)
      expect(queue[0]?.retryCount).toBe(3)

      // Fourth sync: retryCount >= 3, action is skipped and removed
      const result = await service.syncAll()
      expect(result.skipped).toHaveLength(1)
      queue = await service.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('sends POST request with correct endpoint for note type', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(200))
      globalThis.fetch = fetchMock

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('note', { text: 'test note' }))
      await service.syncAll()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/notes')
      expect((opts as RequestInit).method).toBe('POST')
    })

    it('sends POST request with correct endpoint for appointment type', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(200))
      globalThis.fetch = fetchMock

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('appointment'))
      await service.syncAll()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/appointments')
    })

    it('sends POST request with correct endpoint for message type', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(200))
      globalThis.fetch = fetchMock

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('message'))
      await service.syncAll()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toBe('/api/messages')
    })

    it('sends payload as JSON body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(200))
      globalThis.fetch = fetchMock

      const service = OfflineSyncService.getInstance()
      const payload = { content: 'hello world', patientId: 'p-123' }
      await service.enqueue(makeActionInput('note', payload))
      await service.syncAll()

      const opts = fetchMock.mock.calls[0][1] as RequestInit
      expect(opts.body).toBe(JSON.stringify(payload))
      const headers = opts.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('handles mixed success and failure in one sync', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(mockResponse(200))
        }
        return Promise.resolve(mockResponse(500))
      })

      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput('note'))
      await service.enqueue(makeActionInput('message'))
      const result = await service.syncAll()

      expect(result.succeeded).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
    })

    it('returns empty result when IndexedDB is unavailable', async () => {
      delete (globalThis as Record<string, unknown>)['indexedDB']
      const service = OfflineSyncService.getInstance()
      const result = await service.syncAll()
      expect(result.succeeded).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.skipped).toHaveLength(0)
    })
  })

  // --- Integration: enqueue + dequeue + clearQueue ------------------------

  describe('integration', () => {
    it('enqueue then dequeue returns the same action', async () => {
      const service = OfflineSyncService.getInstance()
      const enqueued = await service.enqueue(
        makeActionInput('note', { text: 'integration test' }),
      )
      const dequeued = await service.dequeue()
      expect(dequeued).not.toBeNull()
      expect(dequeued?.id).toBe(enqueued.id)
      expect(dequeued?.type).toBe(enqueued.type)
      expect(dequeued?.payload).toEqual(enqueued.payload)
    })

    it('clearQueue after enqueue empties the queue', async () => {
      const service = OfflineSyncService.getInstance()
      await service.enqueue(makeActionInput())
      await service.enqueue(makeActionInput())
      await service.enqueue(makeActionInput())
      await service.clearQueue()
      const queue = await service.getQueue()
      expect(queue).toHaveLength(0)
    })

    it('dequeue processes in FIFO order', async () => {
      const service = OfflineSyncService.getInstance()
      const first = await service.enqueue(makeActionInput('note', { seq: 1 }))
      await new Promise((r) => setTimeout(r, 5))
      const second = await service.enqueue(makeActionInput('note', { seq: 2 }))
      await new Promise((r) => setTimeout(r, 5))
      const third = await service.enqueue(makeActionInput('note', { seq: 3 }))

      const d1 = await service.dequeue()
      const d2 = await service.dequeue()
      const d3 = await service.dequeue()

      expect(d1?.id).toBe(first.id)
      expect(d2?.id).toBe(second.id)
      expect(d3?.id).toBe(third.id)
    })
  })
})
