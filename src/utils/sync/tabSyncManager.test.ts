import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { MessagingTransport } from "./tabSyncManager"
import type { SyncMessage } from "./tabSyncManager"

describe("MessagingTransport", () => {
  let transport: MessagingTransport

  beforeEach(() => {
    transport = new MessagingTransport("test-channel", 1000, "test-tab-id")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    transport.destroy()
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

    const onMessage = vi.fn<(message: SyncMessage) => void>()
    const success = transport.init(onMessage)

    expect(success).toBe(true)
    expect(mockAddEventListener).toHaveBeenCalledWith("message", expect.any(Function))
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "TAB_JOIN",
      tabId: "test-tab-id"
    }))
  })

  it("should handle BroadcastChannel initialization error", () => {
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

    const onMessage = vi.fn<(message: SyncMessage) => void>()
    const success = transport.init(onMessage)

    expect(success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "MessagingTransport: Failed to initialize",
      expect.any(Error)
    )
  })
})
