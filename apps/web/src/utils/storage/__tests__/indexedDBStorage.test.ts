import { type IDBPDatabase } from 'idb'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import IndexedDBStorage from '../indexedDBStorage'

// Mock indexedDB for testing
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn(),
}

describe('IndexedDBStorage', () => {
  let storage: IndexedDBStorage
  let mockDb: IDBPDatabase<any>
  let mockTransaction: IDBTransaction
  let mockPut: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>
  let mockDelete: ReturnType<typeof vi.fn>
  let mockClear: ReturnType<typeof vi.fn>
  let mockGetAllKeys: ReturnType<typeof vi.fn>
  let mockCount: ReturnType<typeof vi.fn>
  let mockTransactionFn: ReturnType<typeof vi.fn>
  let mockObjectStoreFn: ReturnType<typeof vi.fn>
  let mockObjectStore: IDBObjectStore

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock indexedDB
    global.indexedDB = mockIndexedDB as any

    // Setup mock functions separately to preserve mock methods through type casts
    mockPut = vi.fn()
    mockGet = vi.fn()
    mockDelete = vi.fn()
    mockClear = vi.fn()
    mockGetAllKeys = vi.fn()
    mockCount = vi.fn()
    mockTransactionFn = vi.fn(() => mockTransaction)
    mockObjectStoreFn = vi.fn(() => mockObjectStore)

    // Setup mock database objects
    mockObjectStore = {
      put: mockPut,
      get: mockGet,
      delete: mockDelete,
      clear: mockClear,
      getAllKeys: mockGetAllKeys,
      count: mockCount,
    } as unknown as IDBObjectStore

    mockTransaction = {
      objectStore: mockObjectStoreFn,
      oncomplete: null,
      onerror: null,
    } as unknown as IDBTransaction

    mockDb = {
      transaction: mockTransactionFn,
      createObjectStore: vi.fn(),
      close: vi.fn(),
    } as unknown as IDBPDatabase<any>

    // Create storage instance
    storage = new IndexedDBStorage({
      dbName: 'test_db',
      version: 1,
      storeName: 'test_store',
    })
  })

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(storage).toBeDefined()
      // Accessing private properties for testing (necessary for unit testing private fields)
      expect((storage as any).dbName).toBe('test_db')
      expect((storage as any).version).toBe(1)
      expect((storage as any).storeName).toBe('test_store')
    })
  })

  describe('init', () => {
    it('should initialize the database connection', async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      expect(mockIndexedDB.open).toHaveBeenCalledWith('test_db', 1)
      // Accessing private properties for testing
      expect((storage as any).initialized).toBe(true)
      expect((storage as any).db).toBe(mockDb)
    })

    it('should not reinitialize if already initialized', async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      // Mark as initialized
      ;(storage as any).initialized = true
      await storage['init']()

      // Should only be called once
      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1)
    })
  })

  describe('set', () => {
    it('should store a value', async () => {
      const testKey = 'test-key'
      const testValue = { foo: 'bar' }

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the put operation
      const putRequest = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest

      mockPut.mockReturnValue(putRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(putRequest.onsuccess as () => void)?.()
      }, 0)

      await storage.set(testKey, testValue)

      // Verify transaction was created
      expect(mockTransactionFn).toHaveBeenCalledWith(
        ['test_store'],
        'readwrite',
      )
      expect(mockObjectStoreFn).toHaveBeenCalledWith('test_store')
      expect(mockPut).toHaveBeenCalledWith({
        id: testKey,
        value: testValue,
      })
      expect(mockPut).toHaveBeenCalled()
    })

    it('should reject if database is not initialized', async () => {
      // Ensure not initialized
      ;(storage as any).initialized = false
      ;(storage as any).db = null

      await expect(storage.set('key', 'value')).rejects.toThrow(
        'Database not initialized',
      )
    })
  })

  describe('get', () => {
    it('should retrieve a value', async () => {
      const testKey = 'test-key'
      const testValue = { foo: 'bar' }
      const mockResult = { id: testKey, value: testValue }

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the get operation
      const getRequest = {
        result: mockResult,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest

      mockGet.mockReturnValue(getRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(getRequest.onsuccess as () => void)?.()
      }, 0)

      const result = await storage.get(testKey)

      expect(result).toEqual(testValue)
      expect(mockGet).toHaveBeenCalledWith(testKey)
    })

    it('should return undefined for non-existent key', async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the get operation to return undefined
      const getRequest = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest

      mockGet.mockReturnValue(getRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(getRequest.onsuccess as () => void)?.()
      }, 0)

      const result = await storage.get('non-existent-key')

      expect(result).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('should remove a value', async () => {
      const testKey = 'test-key'

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the delete operation
      const deleteRequest = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest

      mockDelete.mockReturnValue(deleteRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(deleteRequest.onsuccess as () => void)?.()
      }, 0)

      await storage.remove(testKey)

      expect(mockTransactionFn).toHaveBeenCalledWith(
        ['test_store'],
        'readwrite',
      )
      expect(mockObjectStoreFn).toHaveBeenCalledWith('test_store')
      expect(mockDelete).toHaveBeenCalledWith(testKey)
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('should clear all values', async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the clear operation
      const clearRequest = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest

      mockClear.mockReturnValue(clearRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(clearRequest.onsuccess as () => void)?.()
      }, 0)

      await storage.clear()

      expect(mockTransactionFn).toHaveBeenCalledWith(
        ['test_store'],
        'readwrite',
      )
      expect(mockObjectStoreFn).toHaveBeenCalledWith('test_store')
      expect(mockClear).toHaveBeenCalled()
      expect(mockClear).toHaveBeenCalled()
    })
  })

  describe('getAllKeys', () => {
    it('should return all keys', async () => {
      const testKeys = ['key1', 'key2', 'key3']

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the getAllKeys operation
      const getAllKeysRequest = {
        result: testKeys,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<IDBValidKey[]>

      mockGetAllKeys.mockReturnValue(getAllKeysRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(getAllKeysRequest.onsuccess as () => void)?.()
      }, 0)

      const result = await storage.getAllKeys()

      expect(result).toEqual(testKeys)
      expect(mockGetAllKeys).toHaveBeenCalled()
    })
  })

  describe('count', () => {
    it('should return the count of items', async () => {
      const testCount = 5

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest

      mockIndexedDB.open.mockImplementation((_dbName, _version) => {
        // Immediately trigger success
        setTimeout(() => {
          ;(openRequest.onsuccess as () => void)?.()
        }, 0)
        return openRequest
      })

      await storage['init']()

      // Setup the mock for the count operation
      const countRequest = {
        result: testCount,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<number>

      mockCount.mockReturnValue(countRequest)

      // Trigger success after a short delay
      setTimeout(() => {
        ;(countRequest.onsuccess as () => void)?.()
      }, 0)

      const result = await storage.count()

      expect(result).toBe(testCount)
      expect(mockCount).toHaveBeenCalled()
    })
  })
})
