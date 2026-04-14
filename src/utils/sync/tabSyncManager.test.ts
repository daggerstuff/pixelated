import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { MessagingTransport } from './tabSyncManager'

describe('MessagingTransport', () => {
  const OriginalBroadcastChannel = global.BroadcastChannel

  beforeEach(() => {
    vi.clearAllMocks()
    global.BroadcastChannel = OriginalBroadcastChannel
  })

  afterEach(() => {
    global.BroadcastChannel = OriginalBroadcastChannel
    vi.restoreAllMocks()
  })

  it('should catch and log errors during BroadcastChannel initialization', () => {
    class MockBroadcastChannel {
      constructor() {
        throw new Error('Simulated BroadcastChannel failure')
      }
    }
    global.BroadcastChannel = MockBroadcastChannel as any

    const transport = new MessagingTransport('test_channel', 1000, 'tab_123')
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const success = transport.init(() => {})

    expect(success).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'MessagingTransport: Failed to initialize',
      expect.any(Error),
    )
    expect(consoleErrorSpy.mock.calls[0][1].message).toBe(
      'Simulated BroadcastChannel failure',
    )
  })

  it('should handle BroadcastChannel missing support', () => {
    const origWindow = global.window
    Object.defineProperty(global, 'window', {
      value: { ...origWindow },
      writable: true,
      configurable: true,
    })
    delete (global.window as any).BroadcastChannel

    const transport = new MessagingTransport('test_channel', 1000, 'tab_123')
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    const success = transport.init(() => {})

    expect(success).toBe(false)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'MessagingTransport: BroadcastChannel not supported',
    )

    Object.defineProperty(global, 'window', {
      value: origWindow,
      writable: true,
      configurable: true,
    })
  })
})
