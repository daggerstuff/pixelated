import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import IndexedDBStorage from "../indexedDBStorage";
import { type IDBPDatabase } from "idb";

// Mock indexedDB for testing
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn(),
};

describe("IndexedDBStorage", () => {
  let storage: IndexedDBStorage;
  let mockDb: IDBPDatabase<any>;
  let mockTransaction: IDBTransaction;
  let mockObjectStore: IDBObjectStore;
  let mockRequest: IDBRequest<any>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock indexedDB
    global.indexedDB = mockIndexedDB as any;

    // Setup mock database objects
    mockRequest = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    } as unknown as IDBRequest<any>;

    mockObjectStore = {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getAllKeys: vi.fn(),
      count: vi.fn(),
    } as unknown as IDBObjectStore;

    mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
      oncomplete: null,
      onerror: null,
    } as unknown as IDBTransaction;

    mockDb = {
      transaction: vi.fn(() => mockTransaction),
      createObjectStore: vi.fn(),
      close: vi.fn(),
    } as unknown as IDBPDatabase<any>;

    // Create storage instance
    storage = new IndexedDBStorage({
      dbName: "test_db",
      version: 1,
      storeName: "test_store",
    });
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(storage).toBeDefined();
      // Accessing private properties for testing (necessary for unit testing private fields)
      expect((storage as any).dbName).toBe("test_db");
      expect((storage as any).version).toBe(1);
      expect((storage as any).storeName).toBe("test_store");
    });
  });

  describe("init", () => {
    it("should initialize the database connection", async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      expect(mockIndexedDB.open).toHaveBeenCalledWith("test_db", 1);
      // Accessing private properties for testing
      expect((storage as any).initialized).toBe(true);
      expect((storage as any).db).toBe(mockDb);
    });

    it("should not reinitialize if already initialized", async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      // Mark as initialized
      (storage as any).initialized = true;
      await storage["init"]();

      // Should only be called once
      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1);
    });
  });

  describe("set", () => {
    it("should store a value", async () => {
      const testKey = "test-key";
      const testValue = { foo: "bar" };

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the put operation
      const putRequest = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<any>;

      mockObjectStore.put.mockReturnValue(putRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        putRequest.onsuccess?.();
      }, 0);

      await storage.set(testKey, testValue);

      // Verify transaction was created
      expect(mockDb.transaction).toHaveBeenCalledWith(["test_store"], "readwrite");
      expect(mockTransaction.objectStore).toHaveBeenCalledWith("test_store");
      expect(mockObjectStore.put).toHaveBeenCalledWith({
        id: testKey,
        value: testValue,
      });
      expect(mockObjectStore.put).toHaveBeenCalled();
    });

    it("should reject if database is not initialized", async () => {
      // Ensure not initialized
      (storage as any).initialized = false;
      (storage as any).db = null;

      await expect(storage.set("key", "value")).rejects.toThrow("Database not initialized");
    });
  });

  describe("get", () => {
    it("should retrieve a value", async () => {
      const testKey = "test-key";
      const testValue = { foo: "bar" };
      const mockResult = { id: testKey, value: testValue };

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the get operation
      const getRequest = {
        result: mockResult,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<any>;

      mockObjectStore.get.mockReturnValue(getRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        getRequest.onsuccess?.();
      }, 0);

      const result = await storage.get(testKey);

      expect(result).toEqual(testValue);
      expect(mockObjectStore.get).toHaveBeenCalledWith(testKey);
    });

    it("should return undefined for non-existent key", async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the get operation to return undefined
      const getRequest = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<any>;

      mockObjectStore.get.mockReturnValue(getRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        getRequest.onsuccess?.();
      }, 0);

      const result = await storage.get("non-existent-key");

      expect(result).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("should remove a value", async () => {
      const testKey = "test-key";

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the delete operation
      const deleteRequest = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<any>;

      mockObjectStore.delete.mockReturnValue(deleteRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        deleteRequest.onsuccess?.();
      }, 0);

      await storage.remove(testKey);

      expect(mockDb.transaction).toHaveBeenCalledWith(["test_store"], "readwrite");
      expect(mockTransaction.objectStore).toHaveBeenCalledWith("test_store");
      expect(mockObjectStore.delete).toHaveBeenCalledWith(testKey);
      expect(mockObjectStore.delete).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should clear all values", async () => {
      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the clear operation
      const clearRequest = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<any>;

      mockObjectStore.clear.mockReturnValue(clearRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        clearRequest.onsuccess?.();
      }, 0);

      await storage.clear();

      expect(mockDb.transaction).toHaveBeenCalledWith(["test_store"], "readwrite");
      expect(mockTransaction.objectStore).toHaveBeenCalledWith("test_store");
      expect(mockObjectStore.clear).toHaveBeenCalled();
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });
  });

  describe("getAllKeys", () => {
    it("should return all keys", async () => {
      const testKeys = ["key1", "key2", "key3"];

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the getAllKeys operation
      const getAllKeysRequest = {
        result: testKeys,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<IDBValidKey[]>;

      mockObjectStore.getAllKeys.mockReturnValue(getAllKeysRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        getAllKeysRequest.onsuccess?.();
      }, 0);

      const result = await storage.getAllKeys();

      expect(result).toEqual(testKeys);
      expect(mockObjectStore.getAllKeys).toHaveBeenCalled();
    });
  });

  describe("count", () => {
    it("should return the count of items", async () => {
      const testCount = 5;

      // Setup the mock to resolve the open request
      const openRequest = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      } as unknown as IDBOpenDBRequest;

      mockIndexedDB.open.mockImplementation((dbName, version) => {
        // Immediately trigger success
        setTimeout(() => {
          openRequest.onsuccess?.();
        }, 0);
        return openRequest;
      });

      await storage["init"]();

      // Setup the mock for the count operation
      const countRequest = {
        result: testCount,
        error: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBRequest<number>;

      mockObjectStore.count.mockReturnValue(countRequest);

      // Trigger success after a short delay
      setTimeout(() => {
        countRequest.onsuccess?.();
      }, 0);

      const result = await storage.count();

      expect(result).toBe(testCount);
      expect(mockObjectStore.count).toHaveBeenCalled();
    });
  });
});
