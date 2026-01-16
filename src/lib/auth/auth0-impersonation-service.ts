/**
 * Auth0 User Impersonation Service
 * Implements secure user impersonation with comprehensive audit logging
 */

import { ManagementClient } from 'auth0'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { auth0UserService } from '../../services/auth0.service'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
}

// Initialize Auth0 management client
let auth0Management: ManagementClient | null = null

/**
 * Initialize Auth0 management client
 */
function initializeAuth0Management() {
  if (!AUTH0_CONFIG.domain || !AUTH0_CONFIG.managementClientId || !AUTH0_CONFIG.managementClientSecret) {
    console.warn('Auth0 configuration incomplete'); return
  }

  if (!auth0Management) {
    auth0Management = new ManagementClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.managementClientId,
      clientSecret: AUTH0_CONFIG.managementClientSecret,
      audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
    })
  }
}

// Initialize the management client
initializeAuth0Management()

// Types
export interface ImpersonationSession {
  id: string
  adminUserId: string
  targetUserId: string
  startTime: Date
  endTime?: Date
  reason: string
  ipAddress: string
  userAgent: string
  isActive: boolean
}

export interface ImpersonationRequest {
  adminUserId: string
  targetUserId: string
  reason: string
  ipAddress: string
  userAgent: string
}

export interface ImpersonationLogEntry {
  id: string
  timestamp: Date
  eventType: 'START' | 'END' | 'EXTEND' | 'ERROR'
  adminUserId: string
  targetUserId: string
  sessionId?: string
  reason?: string
  details?: string
  ipAddress: string
  userAgent: string
}

/**
 * Auth0 User Impersonation Service
 * Implements secure user impersonation with comprehensive audit logging
 */
export class Auth0ImpersonationService {
  private activeSessions: Map<string, ImpersonationSession> = new Map()
  private impersonationLogs: ImpersonationLogEntry[] = []

  constructor() {
    if (!AUTH0_CONFIG.domain) {
      console.warn('Auth0 is not properly configured')
    }

    // Periodically clean up expired sessions
    setInterval(() => {
      this.cleanupExpiredSessions()
    }, 300000) // Every 5 minutes
  }

  /**
   * Request user impersonation
   */
  async requestImpersonation(request: ImpersonationRequest): Promise<string | null> {
    try {
      // Validate that admin user has permission to impersonate
      const adminUser = await auth0UserService.getUserById(request.adminUserId)
      if (!adminUser) {
        throw new Error('Admin user not found')
      }

      // Only admins can impersonate users
      if (adminUser.role !== 'admin') {
        logSecurityEvent(SecurityEventType.IMPERSONATION_DENIED, {
          userId: request.adminUserId,
          targetUserId: request.targetUserId,
          reason: request.reason,
          ipAddress: request.ipAddress,
          error: 'Insufficient permissions',
          timestamp: new Date().toISOString()
        })

        throw new Error('Only administrators can impersonate users')
      }

      // Validate target user exists
      const targetUser = await auth0UserService.getUserById(request.targetUserId)
      if (!targetUser) {
        logSecurityEvent(SecurityEventType.IMPERSONATION_DENIED, {
          userId: request.adminUserId,
          targetUserId: request.targetUserId,
          reason: request.reason,
          ipAddress: request.ipAddress,
          error: 'Target user not found',
          timestamp: new Date().toISOString()
        })

        throw new Error('Target user not found')
      }

      // Check if admin is trying to impersonate themselves
      if (request.adminUserId === request.targetUserId) {
        logSecurityEvent(SecurityEventType.IMPERSONATION_DENIED, {
          userId: request.adminUserId,
          targetUserId: request.targetUserId,
          reason: request.reason,
          ipAddress: request.ipAddress,
          error: 'Cannot impersonate self',
          timestamp: new Date().toISOString()
        })

        throw new Error('Cannot impersonate yourself')
      }

      // Check if admin is already impersonating someone
      const existingSession = this.getActiveSessionForAdmin(request.adminUserId)
      if (existingSession) {
        logSecurityEvent(SecurityEventType.IMPERSONATION_DENIED, {
          userId: request.adminUserId,
          targetUserId: request.targetUserId,
          reason: request.reason,
          ipAddress: request.ipAddress,
          error: 'Already impersonating another user',
          timestamp: new Date().toISOString()
        })

        throw new Error('You are already impersonating another user. End the current session first.')
      }

      // Create impersonation session
      const sessionId = `impersonation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      const session: ImpersonationSession = {
        id: sessionId,
        adminUserId: request.adminUserId,
        targetUserId: request.targetUserId,
        startTime: new Date(),
        reason: request.reason,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        isActive: true
      }

      // Store active session
      this.activeSessions.set(sessionId, session)

      // Log impersonation start
      logSecurityEvent(SecurityEventType.IMPERSONATION_STARTED, {
        userId: request.adminUserId,
        targetUserId: request.targetUserId,
        sessionId: sessionId,
        reason: request.reason,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        timestamp: session.startTime.toISOString()
      })

      // Log to impersonation logs
      this.impersonationLogs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date(),
        eventType: 'START',
        adminUserId: request.adminUserId,
        targetUserId: request.targetUserId,
        sessionId: sessionId,
        reason: request.reason,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent
      })

      // Update Phase 6 MCP server with impersonation start
      await updatePhase6AuthenticationProgress(request.adminUserId, `impersonation_started_${sessionId}`)

      return sessionId
    } catch (error) {
      console.error('Failed to request impersonation:', error)

      // Log impersonation error
      logSecurityEvent(SecurityEventType.IMPERSONATION_ERROR, {
        userId: request.adminUserId,
        targetUserId: request.targetUserId,
        reason: request.reason,
        ipAddress: request.ipAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return null
    }
  }

  /**
   * End user impersonation session
   */
  async endImpersonation(sessionId: string, adminUserId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId)
      if (!session) {
        throw new Error('Impersonation session not found')
      }

      // Verify that the admin user is the one who started the session
      if (session.adminUserId !== adminUserId) {
        logSecurityEvent(SecurityEventType.IMPERSONATION_DENIED, {
          userId: adminUserId,
          targetUserId: session.targetUserId,
          sessionId: sessionId,
          error: 'Unauthorized to end this impersonation session',
          timestamp: new Date().toISOString()
        })

        throw new Error('Unauthorized to end this impersonation session')
      }

      // Update session
      session.isActive = false
      session.endTime = new Date()

      // Remove from active sessions
      this.activeSessions.delete(sessionId)

      // Log impersonation end
      logSecurityEvent(SecurityEventType.IMPERSONATION_ENDED, {
        userId: adminUserId,
        targetUserId: session.targetUserId,
        sessionId: sessionId,
        duration: session.endTime.getTime() - session.startTime.getTime(),
        timestamp: session.endTime.toISOString()
      })

      // Log to impersonation logs
      this.impersonationLogs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date(),
        eventType: 'END',
        adminUserId: adminUserId,
        targetUserId: session.targetUserId,
        sessionId: sessionId,
        details: `Session ended after ${Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)} seconds`,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent
      })

      // Update Phase 6 MCP server with impersonation end
      await updatePhase6AuthenticationProgress(adminUserId, `impersonation_ended_${sessionId}`)

      return true
    } catch (error) {
      console.error('Failed to end impersonation:', error)

      // Log impersonation error
      logSecurityEvent(SecurityEventType.IMPERSONATION_ERROR, {
        userId: adminUserId,
        sessionId: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Get active impersonation session for admin user
   */
  getActiveSessionForAdmin(adminUserId: string): ImpersonationSession | null {
    for (const session of Array.from(this.activeSessions.values())) {
      if (session.adminUserId === adminUserId && session.isActive) {
        return session
      }
    }
    return null
  }

  /**
   * Get active impersonation session by ID
   */
  getActiveSessionById(sessionId: string): ImpersonationSession | null {
    const session = this.activeSessions.get(sessionId)
    return session && session.isActive ? session : null
  }

  /**
   * Check if user is currently being impersonated
   */
  isUserImpersonated(targetUserId: string): boolean {
    for (const session of Array.from(this.activeSessions.values())) {
      if (session.targetUserId === targetUserId && session.isActive) {
        return true
      }
    }
    return false
  }

  /**
   * Get all active impersonation sessions
   */
  getActiveSessions(): ImpersonationSession[] {
    return Array.from(this.activeSessions.values()).filter(session => session.isActive)
  }

  /**
   * Get impersonation logs
   */
  getImpersonationLogs(limit: number = 100): ImpersonationLogEntry[] {
    // Return the most recent logs
    return this.impersonationLogs.slice(-limit).reverse()
  }

  /**
   * Get impersonation logs for a specific user
   */
  getUserImpersonationLogs(userId: string, limit: number = 50): ImpersonationLogEntry[] {
    const userLogs = this.impersonationLogs.filter(log =>
      log.adminUserId === userId || log.targetUserId === userId
    )
    return userLogs.slice(-limit).reverse()
  }

  /**
   * Extend impersonation session (if needed)
   */
  async extendImpersonation(sessionId: string, adminUserId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId)
      if (!session) {
        throw new Error('Impersonation session not found')
      }

      // Verify that the admin user is the one who started the session
      if (session.adminUserId !== adminUserId) {
        logSecurityEvent(SecurityEventType.IMPERSONATION_DENIED, {
          userId: adminUserId,
          targetUserId: session.targetUserId,
          sessionId: sessionId,
          error: 'Unauthorized to extend this impersonation session',
          timestamp: new Date().toISOString()
        })

        throw new Error('Unauthorized to extend this impersonation session')
      }

      // Log session extension
      logSecurityEvent(SecurityEventType.IMPERSONATION_EXTENDED, {
        userId: adminUserId,
        targetUserId: session.targetUserId,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      })

      // Log to impersonation logs
      this.impersonationLogs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date(),
        eventType: 'EXTEND',
        adminUserId: adminUserId,
        targetUserId: session.targetUserId,
        sessionId: sessionId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent
      })

      // Update Phase 6 MCP server with impersonation extension
      await updatePhase6AuthenticationProgress(adminUserId, `impersonation_extended_${sessionId}`)

      return true
    } catch (error) {
      console.error('Failed to extend impersonation:', error)

      // Log impersonation error
      logSecurityEvent(SecurityEventType.IMPERSONATION_ERROR, {
        userId: adminUserId,
        sessionId: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date()

    for (const [sessionId, session] of Array.from(this.activeSessions.entries())) {
      if (!session.isActive || (session.endTime && session.endTime < now)) {
        this.activeSessions.delete(sessionId)
        // In a real implementation, we would end the session properly
        this.endImpersonation(sessionId, session.adminUserId).catch(error => {
          console.error('Failed to end expired impersonation session:', error)
        })
      }
    }
  }

  /**
   * Validate impersonation session
   */
  async validateImpersonationSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.getActiveSessionById(sessionId)
      if (!session) {
        return false
      }

      // Additional validation could be added here, such as:
      // - Checking if the admin user still has admin privileges
      // - Checking if the target user still exists and is active
      // - Checking if the session is being used from the same IP address

      return true
    } catch (error) {
      console.error('Failed to validate impersonation session:', error)
      return false
    }
  }

  /**
   * Get impersonation statistics
   */
  getImpersonationStats(): {
    activeSessions: number,
    totalSessions: number,
    recentActivity: number
  } {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600000) // 1 hour ago

    const recentActivity = Array.from(this.impersonationLogs).filter(log =>
      new Date(log.timestamp).getTime() > oneHourAgo.getTime()
    ).length

    return {
      activeSessions: Array.from(this.activeSessions.values()).filter(s => s.isActive).length,
      totalSessions: this.impersonationLogs.filter(log => log.eventType === 'START').length,
      recentActivity
    }
  }
}

// Export singleton instance
export const auth0ImpersonationService = new Auth0ImpersonationService()
export default auth0ImpersonationService