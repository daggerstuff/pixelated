import { verifyServerAuth, protectRoute } from '../serverAuth'
import { getCurrentUser, isAuthenticated } from '../auth'
import { createResourceAuditLog } from '../../audit/log'
import type { AuthUser } from '../../auth'

// Define interface for our mock redis methods
interface MockRedisMethods {
  incr: ReturnType<typeof vi.fn>
  expire: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
  exists: ReturnType<typeof vi.fn>
}

// Mock dependencies
vi.mock('../auth', () => ({
  getCurrentUser: vi.fn(),
  isAuthenticated: vi.fn(),
}))

vi.mock('../../audit/log', () => ({
  createResourceAuditLog: vi.fn(),
}))

// Create a mock implementation of RedisService that exposes the methods we need
const mockRedisMethods: MockRedisMethods = {
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(true),
  get: vi.fn(),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
}

vi.mock('../../services/redis/RedisService', () => {
  return {
    RedisService: vi.fn().mockImplementation(() => ({
      // Expose methods directly instead of through client
      incr: mockRedisMethods.incr,
      expire: mockRedisMethods.expire,
      get: mockRedisMethods.get,
      set: mockRedisMethods.set,
      del: mockRedisMethods.del,
      exists: mockRedisMethods.exists,
    })),
  }
})

vi.mock('../../logging', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('serverAuth', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
  }

  const mockRequest = {
    url: 'https://example.com/api/test',
    method: 'GET',
    headers: {
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'user-agent') {
          return 'Mozilla/5.0 Test Agent'
        }
        if (name === 'x-forwarded-for') {
          return '192.168.1.1'
        }
        return null
      }),
    },
  } as unknown as Request

  const mockCookies = {
    get: vi.fn(),
  }

  const mockRequestIp = '192.168.1.1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('verifyServerAuth', () => {
    it('should return authenticated false when isAuthenticated returns false', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(false)

      // Act
      const result = await verifyServerAuth({
        cookies: mockCookies as unknown,
        request: mockRequest,
        requestIp: mockRequestIp,
      })

      // Assert
      expect(result.authenticated).toBe(false)
      expect(result.user).toBeNull()
      expect(result.reason).toBe('not_authenticated')
    })

    it('should return authenticated false when getCurrentUser returns null', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      // Act
      const result = await verifyServerAuth({
        cookies: mockCookies as unknown,
        request: mockRequest,
        requestIp: mockRequestIp,
      })

      // Assert
      expect(result.authenticated).toBe(false)
      expect(result.user).toBeNull()
      expect(result.reason).toBe('user_not_found')
    })

    it('should return authenticated true with valid user when auth checks pass', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown)

      // Act
      const result = await verifyServerAuth({
        cookies: mockCookies as unknown,
        request: mockRequest,
        requestIp: mockRequestIp,
      })

      // Assert
      expect(result.authenticated).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(createResourceAuditLog).toHaveBeenCalled()
    })

    it('should check role when requiredRole is provided', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue({
        ...mockUser,
        role: 'user',
      } as unknown)

      // Act
      const result = await verifyServerAuth({
        cookies: mockCookies as unknown,
        request: mockRequest,
        requestIp: mockRequestIp,
        requiredRole: 'admin',
      })

      // Assert
      expect(result.authenticated).toBe(false)
      expect(result.reason).toBe('insufficient_permissions')
      expect(createResourceAuditLog).toHaveBeenCalledWith(
        'server_auth_denied',
        expect.any(String),
        expect.objectContaining({ type: 'route' }),
        expect.objectContaining({ reason: 'insufficient_permissions' }),
      )
    })

    it('should check IP match when validateIPMatch is true', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown)

      // Simulate a previous IP being stored
      mockRedisMethods.get.mockImplementation((key: string) => {
        if (key === `user_ip:${mockUser.id}`) {
          return Promise.resolve('10.0.0.1')
        }
        return Promise.resolve(null)
      })

      // Act
      const result = await verifyServerAuth({
        cookies: mockCookies as unknown,
        request: mockRequest,
        requestIp: mockRequestIp,
        validateIPMatch: true,
      })

      // Assert
      expect(result.authenticated).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(createResourceAuditLog).toHaveBeenCalledWith(
        'suspicious_ip_change',
        expect.any(String),
        expect.objectContaining({ type: 'user' }),
        expect.objectContaining({
          previousIp: '10.0.0.1',
          currentIp: mockRequestIp,
        }),
      )
      expect(mockRedisMethods.set).toHaveBeenCalledWith(
        `user_ip:${mockUser.id}`,
        mockRequestIp,
      )
    })

    it('should check user agent match when validateUserAgent is true', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown)

      // Simulate a previous user agent being stored
      mockRedisMethods.get.mockImplementation((key: string) => {
        if (key === `user_agent:${mockUser.id}`) {
          return Promise.resolve('Different Agent')
        }
        return Promise.resolve(null)
      })

      // Act
      const result = await verifyServerAuth({
        cookies: mockCookies as unknown,
        request: mockRequest,
        requestIp: mockRequestIp,
        validateUserAgent: true,
      })

      // Assert
      expect(result.authenticated).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(createResourceAuditLog).toHaveBeenCalledWith(
        'suspicious_user_agent_change',
        expect.any(String),
        expect.objectContaining({ type: 'user' }),
        expect.objectContaining({
          previousUserAgent: 'Different Agent',
          currentUserAgent: 'Mozilla/5.0 Test Agent',
        }),
      )
      expect(mockRedisMethods.set).toHaveBeenCalledWith(
        `user_agent:${mockUser.id}`,
        'Mozilla/5.0 Test Agent',
      )
    })
  })

  describe('protectRoute', () => {
    it('should create an API route handler that uses verifyServerAuth', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown)

      const astroContext = {
        request: mockRequest,
        cookies: mockCookies,
        locals: {} as { user?: AuthUser },
        render: vi.fn().mockResolvedValue(new Response('ok')),
      }

      // Create a protected route
      const protectedHandler = protectRoute({
        requiredRole: 'user',
      })

      // Create a handler to pass to the protected route
      const mockRouteHandler = vi
        .fn()
        .mockResolvedValue(new Response('protected content'))

      // Act - call the outer function to get the APIRoute, then call that with the context
      const apiRoute = protectedHandler(mockRouteHandler)
      const result = await apiRoute(astroContext as unknown)

      // Assert
      expect(result).toBeDefined()
      expect(astroContext.locals.user).toEqual(mockUser)
      expect(mockRouteHandler).toHaveBeenCalledWith(astroContext)
    })

    it('should return a 401 response when not authenticated', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(false)

      const astroContext = {
        request: mockRequest,
        cookies: mockCookies,
        locals: {} as { user?: AuthUser },
        render: vi.fn(),
      }

      // Create a protected route
      const protectedHandler = protectRoute({})
      const mockRouteHandler = vi.fn()

      // Act - call the outer function to get the APIRoute, then call that with the context
      const apiRoute = protectedHandler(mockRouteHandler)
      const response = await apiRoute(astroContext as unknown)

      // Assert
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(401)

      // Check JSON response
      const jsonResponse = await response.json()
      expect(jsonResponse).toHaveProperty('error', 'Authentication required')

      // Verify the handler was not called
      expect(mockRouteHandler).not.toHaveBeenCalled()
    })

    it('should return a 403 response when role is insufficient', async () => {
      // Arrange
      vi.mocked(isAuthenticated).mockResolvedValue(true)
      vi.mocked(getCurrentUser).mockResolvedValue({
        ...mockUser,
        role: 'user',
      } as unknown)

      const astroContext = {
        request: mockRequest,
        cookies: mockCookies,
        locals: {} as { user?: AuthUser },
        render: vi.fn(),
      }

      // Create a protected route requiring admin role
      const protectedHandler = protectRoute({
        requiredRole: 'admin',
      })
      const mockRouteHandler = vi.fn()

      // Act - call the outer function to get the APIRoute, then call that with the context
      const apiRoute = protectedHandler(mockRouteHandler)
      const response = await apiRoute(astroContext as unknown)

      // Assert
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(403)

      // Check JSON response
      const jsonResponse = await response.json()
      expect(jsonResponse).toHaveProperty('error', 'Insufficient permissions')

      // Verify the handler was not called
      expect(mockRouteHandler).not.toHaveBeenCalled()
    })
  })
})
