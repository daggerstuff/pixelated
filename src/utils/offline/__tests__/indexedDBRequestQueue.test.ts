import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock indexedDB globally before importing the module under test
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  cmp: vi.fn(),
};
global.indexedDB = mockIndexedDB as any;

import { IndexedDBRequestQueue } from "../indexedDBRequestQueue";
import { type IDBPDatabase } from "idb";

describe("IndexedDBRequestQueue", () => {
  let queue: IndexedDBRequestQueue;
  let mockDb: IDBPDatabase<any>;
  let mockTransaction: IDBTransaction;
  let mockObjectStore: IDBObjectStore;
  let mockRequest: IDBRequest<any>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset the mock implementation for indexedDB.open
    mockIndexedDB.open.mockReset();

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

    // Create queue instance
    queue = new IndexedDBRequestQueue();
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with default options", () => {
      expect(queue).toBeDefined();
      // @ts-ignore
      expect((queue as any).options.maxQueueSize).toBe(1000);
      // @ts-ignore
      expect((queue as any).options.maxRetries).toBe(3);
      // @ts-ignore
      expect((queue as any).options.retryDelay).toBe(1000);
    });
  });

  describe("initDB", () => {
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

      // Access private method for testing
      // @ts-ignore
      await (queue as any).initDB();

      expect(mockIndexedDB.open).toHaveBeenCalledWith("pixelated_offline_queue", 1);
      // @ts-ignore
      expect((queue as any).initialized).toBe(true);
      // @ts-ignore
      expect((queue as any).db).toBe(mockDb);
    });
  });

  describe("add", () => {
    it("should add a request to the queue", () => {
      const request = {
        url: "/test",
        method: "GET" as const,
        headers: {},
        priority: "normal" as const,
        maxRetries: 3,
      };

      const result = queue.add(request);

      expect(result).toBe(true);
      // @ts-ignore
      expect((queue as any).queue.length).toBe(1);
      // @ts-ignore
      expect((queue as any).queue[0]).toMatchObject({
        url: "/test",
        method: "GET",
        headers: {},
        priority: "normal",
        maxRetries: 3,
        retryCount: 0,
      });
      // @ts-ignore
      expect((queue as any).queue[0].id).toMatch(/^req_\d+_/);
    });

    it("should respect max queue size", () => {
      // Fill queue to max size
      for (let i = 0; i < 1000; i++) {
        queue.add({
          url: `/test${i}`,
          method: "GET" as const,
          headers: {},
          priority: "low" as const,
          maxRetries: 3,
        });
      }

      // Try to add one more - should remove oldest low priority
      const result = queue.add({
        url: "/overflow",
        method: "POST" as const,
        headers: {},
        priority: "high" as const,
        maxRetries: 3,
      });

      expect(result).toBe(true);
      // @ts-ignore
      expect((queue as any).queue.length).toBe(1000);
      // Should have removed a low priority item
      // @ts-ignore
      expect((queue as any).queue.some((req: any) => req.url === "/overflow")).toBe(true);
    });
  });

  describe("processQueue", () => {
    it("should process requests when online", async () => {
      // Add a request
      queue.add({
        url: "/test",
        method: "GET" as const,
        headers: {},
        priority: "normal" as const,
        maxRetries: 3,
      });

      // Mock fetch to succeed
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // Process queue
      await queue.processQueue();

      // Verify request was processed
      expect(fetch).toHaveBeenCalledWith("/test", {
        method: "GET",
        headers: {},
        body: undefined,
      });
      // @ts-ignore
      expect((queue as any).queue.length).toBe(0);
    });

    it("should retry failed requests", async () => {
      // Add a request
      queue.add({
        url: "/test",
        method: "GET" as const,
        headers: {},
        priority: "normal" as const,
        maxRetries: 2,
      });

      // Mock fetch to fail first time, succeed second time
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      // Process queue
      await queue.processQueue();

      // Verify request was retried
      expect(fetch).toHaveBeenCalledTimes(2);
      // @ts-ignore
      expect((queue as any).queue.length).toBe(0);
    });

    it("should remove requests after max retries", async () => {
      // Add a request
      queue.add({
        url: "/test",
        method: "GET" as const,
        headers: {},
        priority: "normal" as const,
        maxRetries: 1,
      });

      // Mock fetch to always fail
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      // Process queue
      await queue.processQueue();

      // Verify request was removed after max retries
      expect(fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
      // @ts-ignore
      expect((queue as any).queue.length).toBe(0);
    });
  });

  describe("remove", () => {
    it("should remove a request by ID", () => {
      // Add a request
      const request = {
        url: "/test",
        method: "GET",
        headers: {},
      };
      queue.add(request);

      // Get the ID of the added request
      // @ts-ignore
      const id = (queue as any).queue[0].id;

      // Remove the request
      const result = queue.remove(id);

      expect(result).toBe(true);
      // @ts-ignore
      expect((queue as any).queue.length).toBe(0);
    });

    it("should return false for non-existent ID", () => {
      const result = queue.remove("non-existent-id");
      expect(result).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all requests", () => {
      // Add some requests
      queue.add({ url: "/test1", method: "GET", headers: {} });
      queue.add({ url: "/test2", method: "POST", headers: {} });

      // Clear queue
      queue.clear();

      // @ts-ignore
      expect((queue as any).queue.length).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      // Add requests with different priorities
      queue.add({
        url: "/critical",
        method: "GET",
        headers: {},
        priority: "critical",
      });
      queue.add({ url: "/high", method: "GET", headers: {}, priority: "high" });
      queue.add({
        url: "/normal1",
        method: "GET",
        headers: {},
        priority: "normal",
      });
      queue.add({
        url: "/normal2",
        method: "GET",
        headers: {},
        priority: "normal",
      });
      queue.add({ url: "/low", method: "GET", headers: {}, priority: "low" });

      const stats = queue.getStats();

      expect(stats.total).toBe(5);
      expect(stats.byPriority.critical).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.normal).toBe(2);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.oldestRequest).toBeGreaterThan(0);
      expect(stats.newestRequest).toBeGreaterThan(stats.oldestRequest);
    });
  });

  describe("hasPendingRequests", () => {
    it("should return true when queue has items", () => {
      queue.add({ url: "/test", method: "GET", headers: {} });
      expect(queue.hasPendingRequests()).toBe(true);
    });

    it("should return false when queue is empty", () => {
      expect(queue.hasPendingRequests()).toBe(false);
    });
  });
});
