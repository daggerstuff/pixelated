// Reusable mocking utilities for test suites
import { vi } from 'vitest'

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
  instance: WebSocket
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
} {
  const send = vi.fn()
  const close = vi.fn()
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()

  const mockWebSocket = {
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
  } as WebSocket & {
    send: typeof send
    close: typeof close
    addEventListener: typeof addEventListener
    removeEventListener: typeof removeEventListener
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
  options: Partial<Omit<Response, 'clone' | 'bodyUsed'>> & {
    status?: number
  } = {},
): Response {
  const {
    status = 200,
    statusText = 'OK',
    headers = new Headers({ 'content-type': 'application/json' }),
    ...rest
  } = options

  return {
    ...rest,
    status,
    statusText,
    headers:
      headers instanceof Headers
        ? headers
        : new Headers(headers as Record<string, string>),
    ok: status >= 200 && status < 300,
    clone: vi.fn(() => createMockResponse(data, { ...options, status })),
    bodyUsed: false,
    json: vi.fn().mockResolvedValue(data),
    text: vi
      .fn()
      .mockResolvedValue(
        typeof data === 'string' ? data : JSON.stringify(data),
      ),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: vi.fn().mockResolvedValue(new Blob()),
    formData: vi.fn().mockResolvedValue(new FormData()),
  } as Response
}

// URL mocking utilities
export function mockURLMethods(): { restore: () => void } {
  const originals = {
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  }

  const createObjectURL = vi.fn().mockReturnValue('blob:test-url')
  const revokeObjectURL = vi.fn()

  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL

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
    .fn()
    .mockImplementation((fn: (...args: any[]) => void, _delay: number) => {
      const intervalId = { id: Math.random(), active: true }
      const wrappedFn = () => fn()
      // Simulate immediate execution for testing
      wrappedFn()
      return intervalId
    })

  const mockSetTimeout = vi
    .fn()
    .mockImplementation((fn: (...args: any[]) => void, delay: number) => {
      const timeoutId = { id: Math.random(), active: true }
      setTimeout(() => {
        if (timeoutId.active) {
          currentTime += delay
          fn()
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

  const mockCrypto = {
    ...originalCrypto,
    randomUUID: vi.fn().mockReturnValue('test-uuid-123'),
  } as Crypto

  Object.assign(global, { crypto: mockCrypto })

  return {
    restore: () => {
      Object.assign(global, { crypto: originalCrypto })
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
  const mockClear = vi.fn().mockImplementation(() => storage.clear())

  const mocklocalStorage = {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
    clear: mockClear,
    key: vi
      .fn()
      .mockImplementation((index: number) => Array.from(storage.keys())[index]),
    length: vi.fn().mockImplementation(() => storage.size),
  } as Storage

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

  const warn = vi.fn()
  const error = vi.fn()
  const log = vi.fn()

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
