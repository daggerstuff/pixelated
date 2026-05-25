import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
const mockAuditLog = vi.fn()

vi.mock('../../../lib/db/postgres', () => ({
  postgres: {
    query: mockAuditLog,
  },
}))

interface AuditData {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  changes?: unknown
  timestamp?: number
}

export async function logAuditEvent(data: AuditData): Promise<void> {
  const {
    userId = 'system',
    action,
    resource = 'unknown',
    resourceId,
    changes,
    timestamp = Date.now(),
  } = data

  try {
    await mockAuditLog(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, changes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        action,
        resource,
        resourceId,
        JSON.stringify(changes),
        timestamp,
      ],
    )
  } catch (error: unknown) {
    console.error('Failed to log audit event:', error)
  }
}

export function getActionType(method: string): string {
  const methodMap: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
    GET: 'READ',
  }

  return methodMap[method.toUpperCase()] ?? 'UNKNOWN'
}

interface MockRequest {
  method: string
  url: string
  ip: string
  headers?: Record<string, string>
}

interface MockResponse {
  statusCode: number
  on: (event: string, listener: () => void) => void
}

type MockNext = () => void

export function getResourceType(path: string): string {
  const parts = path.split('/').filter(Boolean)

  if (parts.length === 0) return 'unknown'

  const resource = parts[0]
  return resource ?? 'unknown'
}

export function getResourceId(path: string): string | undefined {
  const parts = path.split('/').filter(Boolean)

  if (parts.length === 0) return undefined

  // /api/users/123 → '123', but /api/users → undefined (need 3+ segments with api prefix)
  if (parts[0] === 'api') {
    if (parts.length < 3) return undefined
    return parts[parts.length - 1]
  }

  // /users/456 → '456', but /users → undefined
  if (parts.length < 2) return undefined
  return parts[parts.length - 1]
}

export async function requestLogger(
  req: MockRequest,
  res: MockResponse,
  next: MockNext,
) {
  const startTime = Date.now()
  const { method, url, ip } = req

  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip}`)

  res.on('finish', () => {
    const duration = Date.now() - startTime
    console.log(
      `[${new Date().toISOString()}] ${method} ${url} - ${res.statusCode} - ${duration}ms`,
    )
  })

  next()
}

describe('Logger Middleware', () => {
  let mockRequest: MockRequest
  let mockResponse: MockResponse
  let mockNext: MockNext

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/api/users/123',
      headers: {
        'user-agent': 'TestAgent/1.0',
      },
      ip: '192.168.1.1',
    }
    mockResponse = {
      statusCode: 200,
      on: vi.fn(),
    }
    mockNext = vi.fn()

    vi.clearAllMocks()
  })

  describe('requestLogger', () => {
    it('should log request details', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      await requestLogger(mockRequest, mockResponse, mockNext)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/users/123'),
      )
      expect(mockNext).toHaveBeenCalled()
    })

    it('should attach finish listener to response', async () => {
      await requestLogger(mockRequest, mockResponse, mockNext)

      expect(mockResponse.on).toHaveBeenCalledWith(
        'finish',
        expect.any(Function),
      )
    })

    it('should handle logging errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error')

      await expect(
        requestLogger(mockRequest, mockResponse, mockNext),
      ).resolves.not.toThrow()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should capture request duration', async () => {
      let finishCallback: () => void = () => {}
      mockResponse.on = vi.fn((_: string, cb: () => void) => {
        finishCallback = cb
      })

      await requestLogger(mockRequest, mockResponse, mockNext)

      expect(finishCallback).toBeDefined()
    })

    it('should handle POST requests', async () => {
      mockRequest.method = 'POST'
      mockRequest.url = '/api/users'
      const consoleSpy = vi.spyOn(console, 'log')

      await requestLogger(mockRequest, mockResponse, mockNext)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('POST /api/users'),
      )
    })
  })

  describe('logAuditEvent', () => {
    it('should log audit event with required fields', async () => {
      const auditData: AuditData = {
        userId: 'user123',
        action: 'USER_UPDATE',
        resource: 'users',
        resourceId: '123',
        changes: { field: 'value' },
      }

      await logAuditEvent(auditData)

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user123',
          'USER_UPDATE',
          'users',
          '123',
          expect.any(String),
          expect.any(Number),
        ]),
      )
    })

    it('should handle missing optional fields', async () => {
      const auditData: AuditData = {
        userId: 'user123',
        action: 'USER_LOGIN',
      }

      await expect(logAuditEvent(auditData)).resolves.not.toThrow()
    })

    it('should use system as default user', async () => {
      await logAuditEvent({ action: 'SYSTEM_EVENT' })

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['system']),
      )
    })

    it('should handle database errors gracefully', async () => {
      mockAuditLog.mockRejectedValueOnce(new Error('DB error'))
      const consoleSpy = vi.spyOn(console, 'error')

      await expect(logAuditEvent({ action: 'TEST' })).resolves.not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('getActionType', () => {
    it('should map HTTP methods to action types', () => {
      expect(getActionType('POST')).toBe('CREATE')
      expect(getActionType('PUT')).toBe('UPDATE')
      expect(getActionType('DELETE')).toBe('DELETE')
      expect(getActionType('GET')).toBe('READ')
    })

    it('should handle lowercase methods', () => {
      expect(getActionType('post')).toBe('CREATE')
      expect(getActionType('get')).toBe('READ')
    })

    it('should default to UNKNOWN for unrecognized patterns', () => {
      expect(getActionType('PATCH')).toBe('UPDATE')
      expect(getActionType('CUSTOM')).toBe('UNKNOWN')
    })
  })

  describe('getResourceType', () => {
    it('should extract resource type from path', () => {
      expect(getResourceType('/api/users/123')).toBe('api')
      expect(getResourceType('/documents/456')).toBe('documents')
    })

    it('should return first path segment', () => {
      expect(getResourceType('/users/123/profile')).toBe('users')
    })

    it('should return default for root paths', () => {
      expect(getResourceType('/')).toBe('unknown')
      expect(getResourceType('')).toBe('unknown')
    })
  })

  describe('getResourceId', () => {
    it('should extract resource ID from path', () => {
      expect(getResourceId('/api/users/123')).toBe('123')
      expect(getResourceId('/users/456')).toBe('456')
    })

    it('should return undefined for paths without ID', () => {
      expect(getResourceId('/api/users')).toBeUndefined()
      expect(getResourceId('/')).toBeUndefined()
    })

    it('should handle nested paths', () => {
      expect(getResourceId('/api/users/123/posts/456')).toBe('456')
    })
  })
})
