import { describe, it, expect, vi, afterEach } from "vitest"
import { prefersDarkMode } from "./request"

describe("prefersDarkMode", () => {
  const originalMatchMedia = global.window?.matchMedia
  const originalWindow = global.window

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalWindow !== undefined) {
      if (global.window) {
        global.window.matchMedia = originalMatchMedia
      }
    } else {
      // @ts-expect-error - reset window
      delete global.window
    }
  })

  it("should return false in SSR environment", () => {
    const backup = global.window
    // @ts-expect-error - testing SSR
    delete global.window

    expect(prefersDarkMode()).toBe(false)

    global.window = backup
  })

  it("should return true when matchMedia matches dark color scheme", () => {
    if (!global.window) {
      // @ts-expect-error - mocking for tests
      global.window = {}
    }

    global.window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    expect(prefersDarkMode()).toBe(true)
  })

  it("should return false when matchMedia does not match dark color scheme", () => {
    if (!global.window) {
      // @ts-expect-error - mocking for tests
      global.window = {}
    }

    global.window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    expect(prefersDarkMode()).toBe(false)
  })
})
