/**
 * Admin Service for Therapy Chat System
 *
 * Provides administrative capabilities for managing users, monitoring system usage,
 * and maintaining security across the application.
 */

import type { User } from '../../types/user.js'
import type { BaseAPIContext } from '../auth/apiRouteTypes.js'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { verifyToken } from '../security/verification.js'

/**
 * Returns an admin logger instance.
 * This avoids top-level initialization and breaks circular dependencies.
 */
function getAdminLogger() {
  return createBuildSafeLogger('admin')
}
const logger = getAdminLogger()

/**
 * Admin roles with different permission levels
 */
export enum AdminRole {
  SUPER_ADMIN = 'super_admin', // Full system access
  CLINICAL_ADMIN = 'clinical_admin', // Access to therapist accounts and clinical data
  SECURITY_ADMIN = 'security_admin', // Manage security settings and audit logs
  SUPPORT_ADMIN = 'support_admin', // Limited access for customer support,
}

/**
 * Admin permission types
 */
export enum AdminPermission {
  // User managemen
  VIEW_USERS = 'view_users',
  CREATE_USER = 'create_user',
  UPDATE_USER = 'update_user',
  DELETE_USER = 'delete_user',

  // Session managemen
  VIEW_SESSIONS = 'view_sessions',
  MANAGE_SESSIONS = 'manage_sessions',

  // Security managemen
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SECURITY = 'manage_security',
  ROTATE_KEYS = 'rotate_keys',

  // System managemen
  VIEW_METRICS = 'view_metrics',
  CONFIGURE_SYSTEM = 'configure_system',
}

/**
 * Interface for therapy session data
 */
export interface SessionsResult {
  sessions: MockSession[]
  total: number
}

/**
 * Mock session status type
 */
export type MockSessionStatus = 'active' | 'completed' | 'cancelled'

/**
 * Mock session record for in-memory admin operations.
 * In a production system these would be DB rows; the admin module
 * currently uses mock data throughout (see getMockAdminUser, getSystemMetrics).
 */
export interface MockSession {
  sessionId: string
  clientId: string
  therapistId: string
  startTime: string
  endTime?: string
  status: MockSessionStatus
  locked: boolean
  archived: boolean
}

/**
 * In-memory session store seeded with mock data.
 * This mirrors the mock-data pattern used by getMockAdminUser and getSystemMetrics.
 * A real implementation would query the sessions table via `../db/index`.
 */
const mockSessions: MockSession[] = [
  {
    sessionId: 'session-001',
    clientId: 'client-001',
    therapistId: 'therapist-001',
    startTime: '2026-08-15T10:00:00Z',
    endTime: '2026-08-15T11:00:00Z',
    status: 'completed',
    locked: false,
    archived: false,
  },
  {
    sessionId: 'session-002',
    clientId: 'client-002',
    therapistId: 'therapist-001',
    startTime: '2026-08-20T14:00:00Z',
    status: 'active',
    locked: false,
    archived: false,
  },
  {
    sessionId: 'session-003',
    clientId: 'client-003',
    therapistId: 'therapist-002',
    startTime: '2026-08-25T09:00:00Z',
    status: 'active',
    locked: false,
    archived: false,
  },
]

/**
 * Role-based permissions matrix
 */
const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  [AdminRole.SUPER_ADMIN]: Object.values(AdminPermission),
  [AdminRole.CLINICAL_ADMIN]: [
    AdminPermission.VIEW_USERS,
    AdminPermission.CREATE_USER,
    AdminPermission.UPDATE_USER,
    AdminPermission.VIEW_SESSIONS,
    AdminPermission.MANAGE_SESSIONS,
    AdminPermission.VIEW_METRICS,
  ],
  [AdminRole.SECURITY_ADMIN]: [
    AdminPermission.VIEW_AUDIT_LOGS,
    AdminPermission.MANAGE_SECURITY,
    AdminPermission.ROTATE_KEYS,
    AdminPermission.VIEW_METRICS,
  ],
  [AdminRole.SUPPORT_ADMIN]: [
    AdminPermission.VIEW_USERS,
    AdminPermission.VIEW_SESSIONS,
    AdminPermission.VIEW_METRICS,
  ],
}

/**
 * User with admin role
 */
export interface AdminUser extends User {
  role: AdminRole
  permissions?: AdminPermission[]
}

/**
 * Admin service for user management and system administration
 */
export class AdminService {
  private static instance: AdminService

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService()
    }
    return AdminService.instance
  }

  /**
   * Get therapy sessions with filtering options.
   * Returns sessions from the in-memory mock store, excluding archived sessions.
   */
  async getSessions(options: {
    limit: number
    offset: number
    therapistId?: string
    clientId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<SessionsResult> {
    console.debug('getSessions called with options:', options)
    try {
      let filtered = mockSessions.filter((s) => !s.archived)

      if (options.therapistId) {
        filtered = filtered.filter((s) => s.therapistId === options.therapistId)
      }
      if (options.clientId) {
        filtered = filtered.filter((s) => s.clientId === options.clientId)
      }
      if (options.startDate) {
        const startMs = options.startDate.getTime()
        filtered = filtered.filter(
          (s) => new Date(s.startTime).getTime() >= startMs,
        )
      }
      if (options.endDate) {
        const endMs = options.endDate.getTime()
        filtered = filtered.filter(
          (s) => new Date(s.startTime).getTime() <= endMs,
        )
      }

      const total = filtered.length
      const offset = Math.max(0, options.offset)
      const limit = Math.max(0, options.limit)
      const paginated = filtered.slice(offset, offset + limit)

      return { sessions: paginated, total }
    } catch (error: unknown) {
      logger.error('Error getting sessions:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return { sessions: [], total: 0 }
    }
  }

  /**
   * Lock a therapy session.
   * Sets `locked = true` on the session in the in-memory store.
   * Throws if the session is not found or already archived.
   */
  async lockSession(sessionId: string): Promise<void> {
    console.debug('lockSession called for:', sessionId)
    const session = mockSessions.find((s) => s.sessionId === sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    if (session.archived) {
      throw new Error(`Cannot lock archived session: ${sessionId}`)
    }
    session.locked = true
  }

  /**
   * Unlock a therapy session.
   * Sets `locked = false` on the session in the in-memory store.
   * Throws if the session is not found or already archived.
   */
  async unlockSession(sessionId: string): Promise<void> {
    console.debug('unlockSession called for:', sessionId)
    const session = mockSessions.find((s) => s.sessionId === sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    if (session.archived) {
      throw new Error(`Cannot unlock archived session: ${sessionId}`)
    }
    session.locked = false
  }

  /**
   * Archive a therapy session.
   * Sets `archived = true` on the session in the in-memory store.
   * Throws if the session is not found or already archived.
   */
  async archiveSession(sessionId: string): Promise<void> {
    console.debug('archiveSession called for:', sessionId)
    const session = mockSessions.find((s) => s.sessionId === sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    if (session.archived) {
      throw new Error(`Session already archived: ${sessionId}`)
    }
    session.archived = true
  }

  /**
   * Check if user has admin role
   */
  public async isAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getAdminUser(userId)
      return !!user
    } catch (error: unknown) {
      logger.error('Error checking admin status:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  /**
   * Get admin user details
   */
  public async getAdminUser(userId: string): Promise<AdminUser | null> {
    try {
      // In a real implementation, this would fetch from the database
      // For this example, we'll use a mock implementation
      return this.getMockAdminUser(userId)
    } catch (error: unknown) {
      logger.error('Error getting admin user:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  /**
   * Check if user has specific permission
   */
  public async hasPermission(
    userId: string,
    permission: AdminPermission,
  ): Promise<boolean> {
    try {
      const user = await this.getAdminUser(userId)
      if (!user) {
        return false
      }

      // Check custom permissions first if they exist
      if (user.permissions?.includes(permission)) {
        return true
      }

      // Otherwise check role-based permissions
      return ROLE_PERMISSIONS[user.role].includes(permission)
    } catch (error: unknown) {
      logger.error('Error checking permission:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  /**
   * Verify admin authentication token
   */
  public async verifyAdminToken(
    token: string,
  ): Promise<{ userId: string; role: AdminRole } | null> {
    try {
      const payload = verifyToken(token) as { userId: string }
      if (!payload?.userId) {
        return null
      }

      const user = await this.getAdminUser(payload.userId)
      if (!user) {
        return null
      }

      return {
        userId: user.id,
        role: user.role,
      }
    } catch (error: unknown) {
      logger.error('Error verifying admin token:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  /**
   * Get all admin users
   */
  public async getAllAdmins(): Promise<AdminUser[]> {
    try {
      // In a real implementation, this would fetch from the database
      // For this example, we'll return mock data
      return [
        this.getMockAdminUser('admin1'),
        this.getMockAdminUser('admin2'),
        this.getMockAdminUser('admin3'),
        this.getMockAdminUser('admin4'),
      ].filter(Boolean) as AdminUser[]
    } catch (error: unknown) {
      logger.error('Error getting all admins:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return []
    }
  }

  /**
   * Get system metrics for admin dashboard
   */
  public async getSystemMetrics(): Promise<unknown> {
    try {
      // In a real implementation, this would fetch metrics from the database or monitoring service
      return {
        activeUsers: 128,
        activeTherapists: 42,
        activeSessions: 35,
        messagesLast24Hours: 1250,
        averageResponseTime: 850, // ms
        serverLoad: 0.42,
        encryptionOperations: 9876,
        securityLevel: {
          standard: 15,
          hipaa: 65,
          maximum: 20,
        },
      }
    } catch (error: unknown) {
      logger.error('Error getting system metrics:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return {}
    }
  }

  /**
   * Mock admin user for development
   */
  private getMockAdminUser(userId: string): AdminUser | null {
    const mockUsers: Record<string, AdminUser> = {
      admin1: {
        id: 'admin1',
        name: 'Super Admin',
        email: 'super@example.com',
        role: AdminRole.SUPER_ADMIN,
      },
      admin2: {
        id: 'admin2',
        name: 'Clinical Director',
        email: 'clinical@example.com',
        role: AdminRole.CLINICAL_ADMIN,
      },
      admin3: {
        id: 'admin3',
        name: 'Security Officer',
        email: 'security@example.com',
        role: AdminRole.SECURITY_ADMIN,
      },
      admin4: {
        id: 'admin4',
        name: 'Support Specialist',
        email: 'support@example.com',
        role: AdminRole.SUPPORT_ADMIN,
      },
    }

    return mockUsers[userId] ?? null
  }

  /**
   * Check if the request is from an admin user
   * @param context - Astro API context
   * @returns Boolean indicating if the request is from an admin
   */
  public async isAdminRequest(context: BaseAPIContext): Promise<boolean> {
    logger.info('isAdminRequest context keys:', { keys: Object.keys(context) })
    try {
      // Extract token from cookies
      const tokenFromCookie = context.cookies.get('token')?.value

      // Extract token from Authorization header (case-insensitive)
      // Prioritize astro.locals.headers if available, fallback to request headers
      let authHeader: string | null = null

      // Check if astro.locals has processed headers (middleware priority)
      if (
        context.locals &&
        'headers' in context.locals &&
        context.locals['headers']
      ) {
        const localsHeaders = context.locals['headers'] as Record<
          string,
          string
        >
        authHeader =
          localsHeaders['authorization'] ??
          localsHeaders['Authorization'] ??
          null
      }

      // Fallback to direct header access with case-insensitive lookup
      authHeader ??=
        context.request.headers.get('authorization') ??
        context.request.headers.get('Authorization')

      const tokenFromHeader = authHeader?.replace(/^Bearer\s+/i, '')

      // Use token from cookie or header
      const token = tokenFromCookie ?? tokenFromHeader
      if (!token) {
        return false
      }

      // Verify the token and check if user is admin
      const adminAuth = await this.verifyAdminToken(token)
      return !!adminAuth
    } catch (error: unknown) {
      logger.error('Error checking admin request:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }
}
