/**
 * Test setup for React Testing Library
 * This file is automatically loaded by Vitest before tests are run
 */

import { cleanup } from '@testing-library/react'
import * as React from 'react'
import { vi } from 'vitest'

// React 19 compatibility: delegate to setup-react19.ts which has proper error handling
import { act } from './setup-react19'

import '@testing-library/jest-dom'

// Keep auth-config imports from exploding in test/bootstrap contexts.
process.env.JWT_SECRET ??= 'test-jwt-secret'

const reactCompat = React as typeof React & {
  act?: typeof act
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const patchedAct = typeof actual.act === 'function' ? actual.act : act
  return {
    ...actual,
    act: patchedAct,
    default: {
      ...(actual.default ?? actual),
      act: patchedAct,
    },
  }
})

vi.mock('react-dom/test-utils', () => ({
  act,
}))

// Make act available on React for components that import it directly
if (!reactCompat.act || typeof reactCompat.act !== 'function') {
  try {
    Object.defineProperty(reactCompat, 'act', {
      value: act,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  } catch {
    // React.act may already be defined in React 19.2.4 - safe to skip
  }
}

// Add type declarations for DOM testing matchers
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toBeInTheDocument(): T
    toHaveAttribute(attr: string, value?: string): T
    toHaveClass(...classNames: string[]): T
    toHaveValue(value?: string | number): T
    toBeVisible(): T
    toBeDisabled(): T
    toBeEnabled(): T
    toHaveTextContent(text: string | RegExp): T
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): T
    toBeChecked(): T
    toHaveFocus(): T
    toBeRequired(): T
    toBeInvalid(): T
    toBeValid(): T
    toHaveStyle(css: string | Record<string, unknown>): T
    toHaveAccessibleName(name?: string | RegExp): T
    toHaveAccessibleDescription(description?: string | RegExp): T
  }
}

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
global.IntersectionObserver = class MockIntersectionObserver {
  root: Element | Document | null = null
  rootMargin = '0px'
  thresholds: ReadonlyArray<number> = [0]

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
} as unknown as typeof IntersectionObserver

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
  cleanup()
  vi.restoreAllMocks()
})
