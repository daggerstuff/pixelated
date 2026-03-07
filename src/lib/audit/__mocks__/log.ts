import { vi } from 'vitest'

export const getLogger = vi.fn(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

// Mock of the generateUniqueId function
export const generateUniqueId = vi.fn(() => {
  return `mock-uuid-${Math.random().toString(36).substring(2, 9)}`
})

// Ensure we also mock generateUUID from utils/ids since audit.log uses it
vi.mock('../utils/ids', () => ({
  generateUUID: vi.fn(
    () => `mock-uuid-${Math.random().toString(36).substring(2, 9)}`,
  ),
}))

// Mock of the logAuditEvent function
export const logAuditEvent = vi.fn().mockResolvedValue(undefined)

// Mock of the createResourceAuditLog function
export const createResourceAuditLog = vi
  .fn()
  .mockImplementation((action, userId, resource, metadata) => {
    const timestamp = new Date()
    const id = generateUniqueId()

    return Promise.resolve({
      id,
      timestamp,
      action,
      userId,
      resource,
      metadata,
    })
  })

// Mock other exported functions as needed
export const getUserAuditLogs = vi.fn().mockResolvedValue([])
export const getActionAuditLogs = vi.fn().mockResolvedValue([])
export const getAuditLogsByUser = vi.fn().mockResolvedValue([])
export const getAuditLogs = vi.fn().mockResolvedValue([])

// Default export
export default {
  generateUniqueId,
  logAuditEvent,
  createResourceAuditLog,
  getUserAuditLogs,
  getActionAuditLogs,
  getAuditLogsByUser,
  getAuditLogs,
}
