/**
 * Session Management System - Phase 7 Multi-Role Authentication
 * Implements secure session handling with device binding, concurrent session limits, and security validation
 */

import { nanoid } from 'nanoid'
import { redis, setInCache, getFromCache, removeFromCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { AuthenticationError } from './jwt-service'
import { isTwoFactorRequired, verifyTwoFactorToken } from './two-factor-auth'
import type { UserRole } from './roles'

// Configuration
const SESSION_CONFIG = {
  maxConcurrentSessions: 5,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  extendedTimeout: 24 * 60 * 60 * 1000, // 24 hours for "remember me"
  deviceBindingEnabled: true,
  ipValidationEnabled: true,
  userAgentValidationEnabled: true,
  concurrentSessionLimit: 5,
  sessionCleanupInterval: 60 * 60 * 1000, // 1 hour
}

// Types
export interface SessionData {
  sessionId: string
  userId: string
  role: UserRole
  deviceId: string
  deviceInfo: DeviceInfo
  ipAddress: string
  userAgent: string
  createdAt: number
  lastActivity: number
  expiresAt: number
  isExtended: boolean
  securityLevel: 'standard' | 'high' | 'maximum'
  twoFactorVerified: boolean
  permissions: string[]
  metadata?: Record<string, unknown>
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  os: string
  browser: string
  isTrusted: boolean
}

export interface SessionCreationOptions {
  userId: string
  role: UserRole
  deviceInfo: DeviceInfo
  ipAddress: string
  userAgent: string
  rememberMe?: boolean
  twoFactorToken?: string
  permissions: string[]
  securityLevel?: 'standard' | 'high' | 'maximum'
}

export interface SessionValidationResult {
  valid: boolean
  session?: SessionData
  error?: string
  requiresRevalidation?: boolean
  securityAlert?: string
}

export interface SessionListItem {
  sessionId: string
  deviceName: string
  deviceType: string
  ipAddress: string
  lastActivity: number
  currentSession: boolean
}

interface UserSessionInfo {
  sessionId: string
  expiresAt: number
  lastActivity: number
}

/**
 * Generate secure session ID
 */
function generateSessionId(): string {
  return `sess_${nanoid(32)}`
}

/**
 * Generate device fingerprint
 */
async function generateDeviceFingerprint(
  deviceInfo: DeviceInfo,
  userAgent: string,
): Promise<string> {
  const crypto = await import('crypto')
  const fingerprintData = `${deviceInfo.deviceId}:${deviceInfo.deviceType}:${userAgent}`
  return crypto.createHash('sha256').update(fingerprintData).digest('hex')
}

/**
 * Create new session
 */
export async function createSession(
  options: SessionCreationOptions,
): Promise<SessionData> {
  try {
    const {
      userId,
      role,
      deviceInfo,
      ipAddress,
      userAgent,
      rememberMe = false,
      twoFactorToken,
      permissions,
      securityLevel = 'standard',
    } = options

    // Validate 2FA if required
    const requires2FA = await isTwoFactorRequired(
      userId,
      role,
      deviceInfo.deviceId,
    )
    if (requires2FA) {
      if (!twoFactorToken) {
        throw new AuthenticationError('2FA verification required')
      }

      const is2FAValid = await verifyTwoFactorToken({
        userId,
        token: twoFactorToken,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
      })

      if (!is2FAValid) {
        throw new AuthenticationError('Invalid 2FA verification')
      }
    }

    // Check concurrent session limit
    await enforceSessionLimit(userId)

    // Generate session ID
    const sessionId = generateSessionId()

    // Calculate expiration time
    const now = Date.now()
    const expiresAt = rememberMe
      ? now + SESSION_CONFIG.extendedTimeout
      : now + SESSION_CONFIG.sessionTimeout

    // Create session data
    const sessionData: SessionData = {
      sessionId,
      userId,
      role,
      deviceId: deviceInfo.deviceId,
      deviceInfo,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt,
      isExtended: rememberMe,
      securityLevel,
      twoFactorVerified: requires2FA,
      permissions,
    }

    // Store session in Redis
    await setInCache(
      `session:${sessionId}`,
      sessionData,
      Math.floor((expiresAt - now) / 1000), // TTL in seconds
    )

    // Add session to user's session list
    await addUserSession(userId, sessionId, expiresAt)

    // Add device fingerprint for security binding
    if (SESSION_CONFIG.deviceBindingEnabled) {
      const deviceFingerprint = await generateDeviceFingerprint(
        deviceInfo,
        userAgent,
      )
      await setInCache(
        `session:device:${sessionId}`,
        { fingerprint: deviceFingerprint },
        Math.floor((expiresAt - now) / 1000),
      )
    }

    // Log session creation
    await logSecurityEvent(SecurityEventType.SESSION_CREATED, {
      userId: userId,
      sessionId,
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
      ipAddress,
      securityLevel,
      twoFactorVerified: requires2FA,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, 'session_created')

    return sessionData
  } catch (error) {
    await logSecurityEvent(SecurityEventType.SESSION_CREATION_FAILED, {
      userId: options.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId: options.deviceInfo.deviceId,
    },
    )

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to create session')
  }
}

/**
 * Validate session
 */
export async function validateSession(
  sessionId: string,
  deviceInfo: DeviceInfo,
  ipAddress: string,
  userAgent: string,
): Promise<SessionValidationResult> {
  try {
    // Get session data
    const sessionData = await getFromCache(`session:${sessionId}`)
    if (!sessionData) {
      return {
        valid: false,
        error: 'Session not found',
      }
    }

    // Check if session is expired
    if (Date.now() > sessionData.expiresAt) {
      await destroySession(sessionId, 'expired')
      return {
        valid: false,
        error: 'Session has expired',
      }
    }

    // Validate device binding
    if (SESSION_CONFIG.deviceBindingEnabled) {
      const deviceData = await getFromCache(`session:device:${sessionId}`)
      if (deviceData) {
        const currentFingerprint = await generateDeviceFingerprint(
          deviceInfo,
          userAgent,
        )
        if (deviceData.fingerprint !== currentFingerprint) {
          await logSecurityEvent(SecurityEventType.SESSION_SECURITY_ALERT, {
            userId: sessionData.userId,
            sessionId,
            alertType: 'device_mismatch',
            expectedDevice: deviceData.fingerprint,
            actualDevice: currentFingerprint,
          })

          return {
            valid: false,
            error: 'Device binding validation failed',
            securityAlert: 'Suspicious device detected',
          }
        }
      }
    }

    // Validate IP address
    if (
      SESSION_CONFIG.ipValidationEnabled &&
      sessionData.ipAddress !== ipAddress
    ) {
      await logSecurityEvent(SecurityEventType.SESSION_SECURITY_ALERT, {
        userId: sessionData.userId,
        sessionId,
        alertType: 'ip_change',
        expectedIp: sessionData.ipAddress,
        actualIp: ipAddress,
      },
      )

      return {
        valid: false,
        error: 'IP address validation failed',
        securityAlert: 'Suspicious IP address detected',
        requiresRevalidation: true,
      }
    }

    // Update last activity
    sessionData.lastActivity = Date.now()
    await setInCache(
      `session:${sessionId}`,
      sessionData,
      Math.floor((sessionData.expiresAt - Date.now()) / 1000),
    )

    // Log successful validation
    await logSecurityEvent(SecurityEventType.SESSION_VALIDATED, {
      userId: sessionData.userId,
      sessionId,
      deviceId: deviceInfo.deviceId,
    })

    return {
      valid: true,
      session: sessionData,
    }
  } catch (error) {
    console.error('Error validating session:', error)
    return {
      valid: false,
      error: 'Session validation failed',
    }
  }
}

/**
 * Refresh session (extend timeout)
 */
export async function refreshSession(
  sessionId: string,
  extendByMs: number = SESSION_CONFIG.sessionTimeout,
): Promise<SessionData | null> {
  try {
    const sessionData = await getFromCache(`session:${sessionId}`)
    if (!sessionData) {
      return null
    }

    // Update expiration time
    sessionData.expiresAt = Date.now() + extendByMs
    sessionData.lastActivity = Date.now()

    // Store updated session
    await setInCache(
      `session:${sessionId}`,
      sessionData,
      Math.floor(extendByMs / 1000),
    )

    // Update user's session list
    await updateUserSessionExpiry(
      sessionData.userId,
      sessionId,
      sessionData.expiresAt,
    )

    // Log session refresh
    await logSecurityEvent(SecurityEventType.SESSION_REFRESHED, {
      userId: sessionData.userId,
      sessionId,
      newExpiry: sessionData.expiresAt,
    })

    return sessionData
  } catch (error) {
    console.error('Error refreshing session:', error)
    return null
  }
}

/**
 * Destroy session
 */
export async function destroySession(
  sessionId: string,
  reason: string = 'user_logout',
): Promise<void> {
  try {
    const sessionData = await getFromCache(`session:${sessionId}`)
    if (!sessionData) {
      return
    }

    // Remove session data
    await removeFromCache(`session:${sessionId}`)
    await removeFromCache(`session:device:${sessionId}`)

    // Remove from user's session list
    await removeUserSession(sessionData.userId, sessionId)

    // Log session destruction
    await logSecurityEvent(SecurityEventType.SESSION_DESTROYED, {
      userId: sessionData.userId,
      sessionId,
      reason,
      deviceId: sessionData.deviceId,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(
      sessionData.userId,
      'session_destroyed',
    )
  } catch (error) {
    console.error('Error destroying session:', error)
  }
}

/**
 * Get user's active sessions
 */
export async function getUserSessions(
  userId: string,
): Promise<SessionListItem[]> {
  try {
    const sessionsKey = `user:sessions:${userId}`
    const sessionList = (await getFromCache(sessionsKey)) || []

    const activeSessions: SessionListItem[] = []

    for (const sessionInfo of sessionList) {
      const sessionData = await getFromCache(`session:${sessionInfo.sessionId}`)
      if (sessionData && Date.now() < sessionData.expiresAt) {
        activeSessions.push({
          sessionId: sessionData.sessionId,
          deviceName: sessionData.deviceInfo.deviceName,
          deviceType: sessionData.deviceInfo.deviceType,
          ipAddress: sessionData.ipAddress,
          lastActivity: sessionData.lastActivity,
          currentSession: false, // Will be set by caller if needed
        })
      }
    }

    return activeSessions
  } catch (error) {
    console.error('Error getting user sessions:', error)
    return []
  }
}

/**
 * Destroy all user sessions (logout everywhere)
 */
export async function destroyAllUserSessions(
  userId: string,
  reason: string = 'security_logout',
): Promise<void> {
  try {
    const sessionsKey = `user:sessions:${userId}`
    const sessionList = (await getFromCache(sessionsKey)) || []

    for (const sessionInfo of sessionList) {
      await destroySession(sessionInfo.sessionId, reason)
    }

    // Log mass session destruction
    await logSecurityEvent(SecurityEventType.ALL_SESSIONS_DESTROYED, {
      userId: userId,
      reason,
      sessionCount: sessionList.length,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, 'all_sessions_destroyed')
  } catch (error) {
    console.error('Error destroying all user sessions:', error)
  }
}

/**
 * Enforce concurrent session limit
 */
async function enforceSessionLimit(userId: string): Promise<void> {
  try {
    const sessionsKey = `user:sessions:${userId}`
    const sessionList = (await getFromCache(sessionsKey)) || []

    if (sessionList.length >= SESSION_CONFIG.concurrentSessionLimit) {
      // Sort by last activity (oldest first)
      sessionList.sort((a: UserSessionInfo, b: UserSessionInfo) => a.lastActivity - b.lastActivity)

      // Remove oldest sessions to make room
      const sessionsToRemove = sessionList.slice(
        0,
        sessionList.length - SESSION_CONFIG.concurrentSessionLimit + 1,
      )

      for (const sessionInfo of sessionsToRemove) {
        await destroySession(sessionInfo.sessionId, 'session_limit_exceeded')
      }
    }
  } catch (error) {
    console.error('Error enforcing session limit:', error)
  }
}

/**
 * Add session to user's session list
 */
async function addUserSession(
  userId: string,
  sessionId: string,
  expiresAt: number,
): Promise<void> {
  try {
    const sessionsKey = `user:sessions:${userId}`
    let sessionList = (await getFromCache(sessionsKey)) || []

    sessionList.push({
      sessionId,
      expiresAt,
      lastActivity: Date.now(),
    })

    // Store with expiration (1 year)
    await setInCache(sessionsKey, sessionList, 365 * 24 * 60 * 60)
  } catch (error) {
    console.error('Error adding user session:', error)
  }
}

/**
 * Remove session from user's session list
 */
async function removeUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  try {
    const sessionsKey = `user:sessions:${userId}`
    let sessionList = (await getFromCache(sessionsKey)) || []

    sessionList = sessionList.filter((s: UserSessionInfo) => s.sessionId !== sessionId)

    if (sessionList.length > 0) {
      await setInCache(sessionsKey, sessionList, 365 * 24 * 60 * 60)
    } else {
      await removeFromCache(sessionsKey)
    }
  } catch (error) {
    console.error('Error removing user session:', error)
  }
}

/**
 * Update session expiry in user's session list
 */
async function updateUserSessionExpiry(
  userId: string,
  sessionId: string,
  newExpiry: number,
): Promise<void> {
  try {
    const sessionsKey = `user:sessions:${userId}`
    const sessionList = (await getFromCache(sessionsKey)) || []

    const sessionInfo = sessionList.find((s: UserSessionInfo) => s.sessionId === sessionId)
    if (sessionInfo) {
      sessionInfo.expiresAt = newExpiry
      await setInCache(sessionsKey, sessionList, 365 * 24 * 60 * 60)
    }
  } catch (error) {
    console.error('Error updating session expiry:', error)
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<{
  cleanedSessions: number
  affectedUsers: string[]
  timestamp: number
}> {
  try {
    const startTime = Date.now()
    let cleanedCount = 0
    const affectedUsers = new Set<string>()

    // Get all session keys (simplified implementation)
    const sessionKeys = await redis.keys('session:*')

    for (const key of sessionKeys) {
      const sessionData = await getFromCache(key)

      if (sessionData && Date.now() > sessionData.expiresAt) {
        await destroySession(sessionData.sessionId, 'expired_cleanup')
        cleanedCount++
        affectedUsers.add(sessionData.userId)
      }
    }

    return {
      cleanedSessions: cleanedCount,
      affectedUsers: Array.from(affectedUsers),
      timestamp: startTime,
    }
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error)
    return {
      cleanedSessions: 0,
      affectedUsers: [],
      timestamp: Date.now(),
    }
  }
}

/**
 * Get session security level
 */
export function getSessionSecurityLevel(
  role: UserRole,
  permissions: string[],
): 'standard' | 'high' | 'maximum' {
  // High security for admin and sensitive operations
  if (
    role === 'admin' ||
    permissions.some((p) => p.includes('manage:') || p.includes('delete:'))
  ) {
    return 'maximum'
  }

  // High security for therapist and patient data access
  if (
    role === 'therapist' ||
    permissions.some((p) => p.includes('patient_data'))
  ) {
    return 'high'
  }

  return 'standard'
}

/**
 * Schedule periodic session cleanup
 */
export function scheduleSessionCleanup(): void {
  setInterval(async () => {
    try {
      const result = await cleanupExpiredSessions()
      if (result.cleanedSessions > 0) {
        console.log(
          `Cleaned up ${result.cleanedSessions} expired sessions for ${result.affectedUsers.length} users`,
        )
      }
    } catch (error) {
      console.error('Error in scheduled session cleanup:', error)
    }
  }, SESSION_CONFIG.sessionCleanupInterval)
}

/**
 * Session security event types
 */
export const SessionSecurityEventType = {
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_VALIDATED: 'SESSION_VALIDATED',
  SESSION_REFRESHED: 'SESSION_REFRESHED',
  SESSION_DESTROYED: 'SESSION_DESTROYED',
  SESSION_CREATION_FAILED: 'SESSION_CREATION_FAILED',
  SESSION_SECURITY_ALERT: 'SESSION_SECURITY_ALERT',
  ALL_SESSIONS_DESTROYED: 'ALL_SESSIONS_DESTROYED',
} as const
