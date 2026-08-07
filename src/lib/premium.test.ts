import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PREMIUM_STORAGE_KEY,
  clearPremium,
  isPremium,
  setPremium,
} from '../../lib/premium'

function createLocalStorageMock() {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    key: vi.fn(),
    length: 0,
  }
}

describe('premium storage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when premium is not set', () => {
    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    })

    expect(isPremium()).toBe(false)
  })

  it('persists premium unlock state in localStorage', () => {
    const localStorageMock = createLocalStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    setPremium(true)

    expect(localStorageMock.getItem(PREMIUM_STORAGE_KEY)).toBe('true')
    expect(isPremium()).toBe(true)
  })

  it('clears premium state from localStorage', () => {
    const localStorageMock = createLocalStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    setPremium(true)
    clearPremium()

    expect(localStorageMock.getItem(PREMIUM_STORAGE_KEY)).toBeNull()
    expect(isPremium()).toBe(false)
  })
})
