import { describe, it, expect, afterEach } from "vitest"
import { StorageManager } from "./storageManager"

describe("StorageManager quota estimation fallback", () => {
  const originalNavigator = global.navigator

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it("should use default maxStorageSize when navigator.storage is undefined", () => {
    Object.defineProperty(global, "navigator", {
      value: { storage: undefined },
      writable: true,
      configurable: true,
    })

    const manager = new StorageManager({ maxStorageSize: 2048 })
    expect(manager.getStorageInfo().quota).toBe(2048)
  })

  it("should use default maxStorageSize when accessing storage throws", () => {
    Object.defineProperty(global, "navigator", {
      value: {
        get storage() {
          throw new Error("Access denied")
        }
      },
      writable: true,
      configurable: true,
    })

    const manager = new StorageManager({ maxStorageSize: 1024 })
    expect(manager.getStorageInfo().quota).toBe(1024)
  })
})
