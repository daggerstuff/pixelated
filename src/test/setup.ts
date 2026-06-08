/**
 * Test setup for React Testing Library
 * This file is automatically loaded by Vitest before tests are run
 */

import { flushSync } from 'react-dom'
import { vi } from 'vitest'

import './patch-react-act.cjs'

// React 19 compatibility shim for environments that do not provide `act` directly.
const act = async (callback: () => void | Promise<void>): Promise<void> => {
  const result =
    typeof flushSync === 'function' ? flushSync(callback) : callback()
  if (result && typeof result === 'object' && 'then' in result) {
    await Promise.resolve(result)
  }

  if (typeof queueMicrotask !== 'undefined') {
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve())
    })
  }

  return
}

import '@testing-library/jest-dom'

// Keep auth-config imports from exploding in test/bootstrap contexts.
process.env['JWT_SECRET'] ??= 'test-jwt-secret'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const patchedAct = typeof actual.act === 'function' ? actual.act : act

  return {
    ...actual,
    act: patchedAct,
  }
})

vi.mock('react-dom/test-utils', async () => {
  const actual = await vi.importActual<typeof import('react-dom/test-utils')>(
    'react-dom/test-utils',
  )
  return {
    ...actual,
    act,
  }
})

void import('react')
  .then((reactModule) => {
    if (!('act' in reactModule) || reactModule.act !== act) {
      Object.defineProperty(reactModule, 'act', {
        value: act,
        writable: true,
        configurable: true,
        enumerable: false,
      })
    }
  })
  .catch((error: unknown) => {
    console.debug('Failed to define React act helper', error)
  })

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  })
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      canvas: {},
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: [] })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => []),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    })),
    writable: true,
    configurable: true,
  })
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
const MockIntersectionObserver = class {
  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}
  root: Element | Document | null = null
  rootMargin = '0px'
  thresholds: ReadonlyArray<number> = [0]

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
  configurable: true,
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
  })
}

// Mock URL methods
global.URL.createObjectURL = vi.fn()
global.URL.revokeObjectURL = vi.fn()

// Mock console methods to reduce noise in tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  void import('@testing-library/react')
    .then(({ cleanup }) => cleanup())
    .catch(() => {})
  vi.restoreAllMocks()
})
