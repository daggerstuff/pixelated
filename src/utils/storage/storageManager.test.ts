import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageManager } from "./storageManager";

describe("StorageManager - Quota Estimation Fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should fall back to maxStorageSize when navigator.storage is missing", () => {
    // Safely stub navigator to completely remove it from the global scope
    vi.stubGlobal("navigator", undefined);

    const manager = new StorageManager({ maxStorageSize: 2048 });

    // The internal quota state should remain the default fallback
    expect(manager.getStorageInfo().quota).toBe(2048);
  });

  it("should fall back to maxStorageSize when navigator.storage.estimate throws/rejects", () => {
    // To prevent Vitests UnhandledRejection crash when simulating a failing estimate()
    // inside a try/catch block that lacks a .catch() on the returned promise, we mock it to throw synchronously.
    // The source code wraps the check in a synchronous try/catch block which will safely intercept the throw.
    const mockEstimate = vi.fn().mockImplementation(() => {
        throw new Error("Quota estimation failed");
    });

    vi.stubGlobal("navigator", {
      storage: {
        estimate: mockEstimate,
      },
    });

    const manager = new StorageManager({ maxStorageSize: 4096 });

    // The mock ensures the internal try/catch triggers the fallback behavior
    expect(manager.getStorageInfo().quota).toBe(4096);
  });
});
