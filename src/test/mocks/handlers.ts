/**
 * Simple Mock Handlers for Testing
 * This file provides basic mock responses for API calls
 */

import { vi } from 'vitest'

const mockDashboardData = {
  summary: {
    totalUsers: 1234,
    activeUsers: 567,
    revenue: 89012,
    growth: 12.5,
  },
  charts: {
    userGrowth: [
      { month: 'Jan', users: 100 },
      { month: 'Feb', users: 150 },
      { month: 'Mar', users: 200 },
    ],
  },
}

// Simple mock handlers
export const handlers = [
  // Mock API responses can be added here if needed
]

// Mock HTTP response helper
export const HttpResponse = {
  json: <T>(data: T) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }),
  text: (text: string) => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(text),
  }),
}

// Mock http helper
export const http = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

export { mockDashboardData }
