import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock HTMLElement methods using spies instead of modifying the prototype
// Create mock functions that can be used in tests
const mockScrollIntoView = vi.fn()
const mockHasPointerCapture = vi.fn()
const mockReleasePointerCapture = vi.fn()

// Use vi.spyOn instead of directly modifying the prototype
vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(mockScrollIntoView)
vi.spyOn(HTMLElement.prototype, 'hasPointerCapture').mockImplementation(mockHasPointerCapture)
vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementation(mockReleasePointerCapture)

// Mock document methods
document.createRange = vi.fn(() => ({
  setStart: vi.fn(),
  setEnd: vi.fn(),
  commonAncestorContainer: document.createElement('div'),
  cloneContents: vi.fn(() => document.createElement('div')),
  selectNodeContents: vi.fn(),
  collapse: vi.fn(),
})) as any

// Mock getComputedStyle
window.getComputedStyle = vi.fn(() => ({
  getPropertyValue: vi.fn(() => ''),
})) as any
