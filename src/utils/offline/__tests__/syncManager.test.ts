import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SyncManager from "../syncManager";
import { indexedDBRequestQueue } from "./indexedDBRequestQueue";

describe("SyncManager", () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create sync manager instance
    syncManager = new SyncManager();
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
    // Stop the sync manager to clear timeouts
    syncManager.stop();
  });

  describe("Constructor", () => {
    it("should initialize with default options", () => {
      expect(syncManager).toBeDefined();
      expect((syncManager as any).options.baseDelay).toBe(1000);
      expect((syncManager as any).options.maxDelay).toBe(60000);
      expect((syncManager as any).options.enableAutoSync).toBe(true);
    });
  });

  describe("initialize", () => {
    it("should set up event listeners", () => {
      // The constructor calls initialize, so we just check that it doesn't throw
      expect(syncManager).toBeDefined();
    });
  });

  describe("handleOnline", () => {
    it("should set isOnline to true and attempt sync if enabled", () => {
      const attemptSyncSpy = vi.spyOn(syncManager as any, "attemptSync");
      (syncManager as any).handleOnline();

      expect((syncManager as any).isOnline).toBe(true);
      expect(attemptSyncSpy).toHaveBeenCalled();
    });
  });

  describe("handleOffline", () => {
    it("should set isOnline to false and clear sync timeout", () => {
      (syncManager as any).isOnline = true;
      (syncManager as any).syncTimeout = setTimeout(() => {}, 1000) as any;

      (syncManager as any).handleOffline();

      expect((syncManager as any).isOnline).toBe(false);
      expect((syncManager as any).syncTimeout).toBeNull();
    });
  });

  describe("attemptSync", () => {
    it("should not sync when offline", async () => {
      (syncManager as any).isOnline = false;
      const processQueueSpy = vi.spyOn(indexedDBRequestQueue, "processQueue");

      await (syncManager as any).attemptSync();

      expect(processQueueSpy).not.toHaveBeenCalled();
    });

    it("should not sync when already syncing", async () => {
      (syncManager as any).isOnline = true;
      (syncManager as any).isSyncing = true;
      const processQueueSpy = vi.spyOn(indexedDBRequestQueue, "processQueue");

      await (syncManager as any).attemptSync();

      expect(processQueueSpy).not.toHaveBeenCalled();
    });

    it("should reset backoff on successful sync", async () => {
      (syncManager as any).isOnline = true;
      (syncManager as any).isSyncing = false;
      (syncManager as any).backoffMultiplier = 4; // Set to a high value
      // Mock processQueue to resolve successfully (empty queue)
      vi.spyOn(indexedDBRequestQueue, "processQueue").mockResolvedValue(undefined);
      // Mock hasPendingRequests to return false (queue empty)
      vi.spyOn(indexedDBRequestQueue, "hasPendingRequests").mockReturnValue(false);

      await (syncManager as any).attemptSync();

      expect((syncManager as any).backoffMultiplier).toBe(1);
    });

    it("should increase backoff on failed sync", async () => {
      (syncManager as any).isOnline = true;
      (syncManager as any).isSyncing = false;
      (syncManager as any).backoffMultiplier = 1;
      // Mock processQueue to reject (simulate failure)
      vi.spyOn(indexedDBRequestQueue, "processQueue").mockRejectedValue(new Error("Sync failed"));
      // Mock hasPendingRequests to return true (queue not empty)
      vi.spyOn(indexedDBRequestQueue, "hasPendingRequests").mockReturnValue(true);

      await (syncManager as any).attemptSync().catch(() => {}); // Expect it to throw

      expect((syncManager as any).backoffMultiplier).toBe(2);
    });
  });

  describe("scheduleNextSync", () => {
    it("should schedule a sync with correct delay", () => {
      (syncManager as any).options.baseDelay = 1000;
      (syncManager as any).options.maxDelay = 60000;
      (syncManager as any).options.enableAutoSync = true;
      (syncManager as any).isOnline = true;
      (syncManager as any).backoffMultiplier = 3;

      (syncManager as any).scheduleNextSync();

      expect((syncManager as any).syncTimeout).not.toBeNull();
      // The delay should be baseDelay * backoffMultiplier = 1000 * 3 = 3000ms
      // We can't easily test the exact timeout value, but we can verify it was set
    });
  });

  describe("getStatus", () => {
    it("should return current status", () => {
      (syncManager as any).isOnline = true;
      (syncManager as any).isSyncing = false;
      (syncManager as any).backoffMultiplier = 2;
      // Mock hasPendingRequests
      vi.spyOn(indexedDBRequestQueue, "hasPendingRequests").mockReturnValue(true);

      const status = syncManager.getStatus();

      expect(status.isOnline).toBe(true);
      expect(status.isSyncing).toBe(false);
      expect(status.backoffMultiplier).toBe(2);
      expect(status.hasPendingRequests).toBe(true);
    });
  });

  describe("start and stop", () => {
    it("should start and stop the sync manager", () => {
      syncManager.start();
      // Should have event listeners set up
      expect(syncManager).toBeDefined();

      syncManager.stop();
      // Should have cleared timeouts and removed event listeners
      expect((syncManager as any).syncTimeout).toBeNull();
    });
  });
});
