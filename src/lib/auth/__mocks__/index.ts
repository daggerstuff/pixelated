import { vi } from 'vitest'

export const getCurrentUser = vi.fn()
export const isAuthenticated = vi.fn()
export const hasRole = vi.fn()
export const requireAuth = vi.fn()

export const auth = {
  getCurrentUser,
  isAuthenticated,
  hasRole,
}
