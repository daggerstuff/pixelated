import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TabSyncManager } from "./tabSyncManager"
import type { SyncMessage } from "./tabSyncManager"

// Mock the dependencies of tabSyncManager
vi.mock("@/utils/storage/storageManager", () => ({
  default: {
    get: vi.fn<any>(),
    set: vi.fn<any>()
  }
}))

vi.mock("@/utils/object", () => ({
  mergeValues: vi.fn<any>(),
  deepEqual: vi.fn<any>()
}))

describe("TabSyncManager", () => {
  let manager: TabSyncManager

  beforeEach(() => {
    manager = new TabSyncManager({
      channelName: "test-channel",
      heartbeatInterval: 1000
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    manager.destroy()
  })

  describe("BroadcastChannel Error Handling", () => {
    it("should handle BroadcastChannel initialization error gracefully", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      vi.stubGlobal("window", {
        BroadcastChannel: class {
          constructor() {
            throw new Error("Simulated BroadcastChannel Error")
          }
        },
      })

      vi.stubGlobal("BroadcastChannel", class {
        constructor() {
          throw new Error("Simulated BroadcastChannel Error")
        }
      })

      manager.init()

      // When init fails, the manager shouldn't completely fail or throw,
      // it just marks itself as not fully available across tabs
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "MessagingTransport: Failed to initialize",
        expect.any(Error)
      )
      expect(manager.isAvailable()).toBe(false)
    })

    it("should initialize BroadcastChannel successfully", () => {
      const mockAddEventListener = vi.fn<any>()
      const mockPostMessage = vi.fn<any>()
      const mockClose = vi.fn<any>()

      class MockBroadcastChannel {
        name: string
        addEventListener = mockAddEventListener
        postMessage = mockPostMessage
        close = mockClose

        constructor(name: string) {
          this.name = name
        }
      }

      vi.stubGlobal("window", {
        BroadcastChannel: MockBroadcastChannel,
        addEventListener: vi.fn<any>(),
        removeEventListener: vi.fn<any>(),
      })

      vi.stubGlobal("BroadcastChannel", MockBroadcastChannel)

      manager.init()

      expect(manager.isAvailable()).toBe(true)
      expect(mockAddEventListener).toHaveBeenCalledWith("message", expect.any(Function))
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: "TAB_JOIN",
        tabId: expect.any(String)
      }))
    })
  })
})
