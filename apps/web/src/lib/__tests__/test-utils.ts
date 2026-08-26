// Reusable mocking utilities for test suites
import { vi } from 'vitest'

type MockWebSocketInstance = {
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  dispatchEvent: (event: Event) => boolean
  readyState: WebSocket['readyState']
  url: string
  binaryType: BinaryType
  bufferedAmount: number
  extensions: string
  protocol: string
  onclose: WebSocket['onclose']
  onerror: WebSocket['onerror']
  onmessage: WebSocket['onmessage']
  onopen: WebSocket['onopen']
}

type MockResponseOptions = {
  status?: number
  statusText?: string
  headers?: HeadersInit
}

type TimerHandle = {
  id: number
  active: boolean
}

// Type-safe global mocking helper
export function mockGlobal<T extends keyof typeof globalThis>(
  property: T,
  mockImplementation: (typeof globalThis)[T],
): { restore: () => void } {
  const original = globalThis[property]
  globalThis[property] = mockImplementation

  return {
    restore: () => {
      globalThis[property] = original
    },
  }
}

// WebSocket mocking with proper typing
export function createMockWebSocket(): {
  instance: MockWebSocketInstance
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
} {
  const send =
    vi.fn<(data: string | ArrayBufferLike | Blob | ArrayBufferView) => void>()
  const close = vi.fn<(code?: number, reason?: string) => void>()
  const addEventListener =
    vi.fn<
      (
        type: string,
        listener: EventListener | ((event: MessageEvent) => void),
        options?: AddEventListenerOptions,
      ) => void
    >()
  const removeEventListener =
    vi.fn<(type: string, listener: EventListener) => void>()

  const mockWebSocket: MockWebSocketInstance = {
    send,
    close,
    addEventListener,
    removeEventListener,
    readyState: 1, // WebSocket.OPEN
    url: 'ws://test.example.com',
    binaryType: 'blob' as const,
    bufferedAmount: 0,
    extensions: '',
    onclose: null,
    onerror: null,
    onmessage: null,
    onopen: null,
    protocol: '',
    dispatchEvent: () => true,
  }

  return {
    instance: mockWebSocket,
    send,
    close,
    addEventListener,
    removeEventListener,
  }
}

// Fetch mocking with proper Response typing
export function createMockResponse(
  data: unknown,
  options: MockResponseOptions = {},
): Response {
  const { status = 200, statusText = 'OK', headers = new Headers() } = options
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  return new Response(content, {
    status,
    statusText,
    headers,
  })
}

// URL mocking utilities
export function mockURLMethods(): { restore: () => void } {
  const originals = {
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),
  }

  const createObjectURL = vi
    .fn<(obj: Blob | MediaSource) => string>()
    .mockReturnValue('blob:test-url')
  const revokeObjectURL = vi.fn<(url: string) => void>()

  URL.createObjectURL = (obj) => createObjectURL(obj)
  URL.revokeObjectURL = (url) => revokeObjectURL(url)

  return {
    restore: () => {
      URL.createObjectURL = originals.createObjectURL
      URL.revokeObjectURL = originals.revokeObjectURL
    },
  }
}

// Timer mocking with proper cleanup
export function createMockTimer(): {
  mockSetInterval: ReturnType<typeof vi.fn>
  mockSetTimeout: ReturnType<typeof vi.fn>
  currentTime: number
  advanceTime: (ms: number) => void
  cleanup: () => void
} {
  let currentTime = 0

  const mockSetInterval = vi
    .fn<
      (callback: () => void, _delay: number, ..._args: unknown[]) => TimerHandle
    >()
    .mockImplementation((callback) => {
      const intervalId: TimerHandle = { id: Math.random(), active: true }
      const wrappedFn = () => callback()
      // Simulate immediate execution for testing
      wrappedFn()
      return intervalId
    })

  const mockSetTimeout = vi
    .fn<
      (callback: () => void, delay: number, ..._args: unknown[]) => TimerHandle
    >()
    .mockImplementation((callback, delay) => {
      const timeoutId: TimerHandle = { id: Math.random(), active: true }
      setTimeout(() => {
        if (timeoutId.active) {
          currentTime += delay
          callback()
        }
      }, 0)
      return timeoutId
    })

  return {
    mockSetInterval,
    mockSetTimeout,
    currentTime,
    advanceTime: (ms: number) => {
      currentTime += ms
    },
    cleanup: () => {
      mockSetInterval.mockRestore()
      mockSetTimeout.mockRestore()
    },
  }
}

// Crypto mocking for UUID generation
export function mockCrypto(): { restore: () => void } {
  const originalCrypto = global.crypto

  const randomUUID = vi
    .fn()
    .mockReturnValue('550e8400-e29b-41d4-a716-446655440000')
  const mockCrypto = new Proxy(originalCrypto, {
    get(target, property): unknown {
      if (property === 'randomUUID') {
        return randomUUID
      }

      return Reflect.get(target, property)
    },
  })

  global.crypto = mockCrypto

  return {
    restore: () => {
      global.crypto = originalCrypto
    },
  }
}

// LocalStorage mocking
export function mockLocalStorage(): {
  storage: Map<string, string>
  mockGetItem: ReturnType<typeof vi.fn>
  mockSetItem: ReturnType<typeof vi.fn>
  mockRemoveItem: ReturnType<typeof vi.fn>
  mockClear: ReturnType<typeof vi.fn>
  restore: () => void
} {
  const storage = new Map<string, string>()

  const mockGetItem = vi
    .fn()
    .mockImplementation((key: string) => storage.get(key) ?? null)
  const mockSetItem = vi
    .fn()
    .mockImplementation((key: string, value: string) => storage.set(key, value))
  const mockRemoveItem = vi
    .fn()
    .mockImplementation((key: string) => storage.delete(key))
  const mockClear = vi
    .fn<() => void>()
    .mockImplementation(() => storage.clear())

  const mocklocalStorage = {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
    clear: mockClear,
    key: vi
      .fn<(index: number) => string | null>()
      .mockImplementation((index: number) => Array.from(storage.keys())[index]),
  }

  Object.defineProperty(mocklocalStorage, 'length', {
    get: () => storage.size,
    enumerable: false,
    configurable: true,
  })

  const originalLocalStorage = global.localStorage
  Object.assign(global, { localStorage: mocklocalStorage })

  return {
    storage,
    mockGetItem,
    mockSetItem,
    mockRemoveItem,
    mockClear,
    restore: () => {
      Object.assign(global, { localStorage: originalLocalStorage })
    },
  }
}

// Console mocking for testing error messages and warnings
export function mockConsole(): {
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  log: ReturnType<typeof vi.fn>
  restore: () => void
} {
  const originalConsole = {
    warn: console.warn,
    error: console.error,
    log: console.log,
  }

  const warn = vi.fn<(...args: unknown[]) => void>()
  const error = vi.fn<(...args: unknown[]) => void>()
  const log = vi.fn<(...args: unknown[]) => void>()

  console.warn = warn
  console.error = error
  console.log = log

  return {
    warn,
    error,
    log,
    restore: () => {
      console.warn = originalConsole.warn
      console.error = originalConsole.error
      console.log = originalConsole.log
    },
  }
}
