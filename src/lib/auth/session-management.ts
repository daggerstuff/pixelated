/**
 * Session Management Module
 * 
 * This module provides session management functionality for the authentication system.
 * It handles session creation, validation, and cleanup.
 */

import { redis, setInCache, getFromCache, removeFromCache } from '../redis'
import { logSecurityEvent } from '../security'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  isTrusted: boolean
}

export interface SessionData {
  sessionId: string
  userId: string
  role: string
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
}

export interface SessionCreateOptions {
  userId: string
  role: string
  deviceInfo: DeviceInfo
  ipAddress: string
  userAgent: string
  rememberMe?: boolean
  twoFactorToken?: string
  permissions?: string[]
}

const SESSION_TIMEOUT = 3600000 // 1 hour
const EXTENDED_SESSION_TIMEOUT = 86400000 // 24 hours
const MAX_CONCURRENT_SESSIONS = 5

/**
 * Create a new session for a user
 */
export async function createSession(options: SessionCreateOptions): Promise<SessionData> {
  const {
    userId,
    role,
    deviceInfo,
    ipAddress,
    userAgent,
    rememberMe = false,
    twoFactorToken,
    permissions = []
  } = options

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = Date.now()
  const timeout = rememberMe ? EXTENDED_SESSION_TIMEOUT : SESSION_TIMEOUT

  // Check concurrent session limit
  const existingSessions = await getFromCache(`user:sessions:${userId}`) || []
  if (existingSessions.length >= MAX_CONCURRENT_SESSIONS) {
    // Remove oldest session
    const oldestSession = existingSessions.sort((a, b) => a.lastActivity - b.lastActivity)[0]
    await removeFromCache(`session:${oldestSession.sessionId}`)
    await removeFromCache(`session:device:${oldestSession.sessionId}`)
  }

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
    expiresAt: now + timeout,
    isExtended: rememberMe,
    securityLevel: 'standard',
    twoFactorVerified: !!twoFactorToken,
    permissions
  }

  // Store session data
  await setInCache(`session:${sessionId}`, sessionData, Math.floor(timeout / 1000))
  
  // Store device binding
  const deviceFingerprint = `${deviceInfo.deviceId}:${ipAddress}:${userAgent}`
  await setInCache(`session:device:${sessionId}`, { fingerprint: deviceFingerprint }, Math.floor(timeout / 1000))

  // Update user's session list
  const updatedSessions = existingSessions.filter(s => s.expiresAt > now)
  updatedSessions.push({
    sessionId,
    expiresAt: sessionData.expiresAt,
    lastActivity: sessionData.lastActivity
  })
  await setInCache(`user:sessions:${userId}`, updatedSessions, Math.floor(timeout / 1000))

  // Log security event
  await logSecurityEvent('SESSION_CREATED', userId, {
    sessionId,
    deviceId: deviceInfo.deviceId,
    ipAddress,
    securityLevel: sessionData.securityLevel
  })

  // Update Phase 6 MCP integration
  await updatePhase6AuthenticationProgress(userId, 'session_created')

  return sessionData
}

/**
 * Validate a session
 */
export async function validateSession(
  sessionId: string,
  deviceInfo: DeviceInfo,
  ipAddress: string,
  userAgent: string
): Promise<{ valid: boolean; session?: SessionData; error?: string; securityAlert?: string }> {
  try {
    const session = await getFromCache(`session:${sessionId}`)
    
    if (!session) {
      return { valid: false, error: 'Session not found' }
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      await removeFromCache(`session:${sessionId}`)
      await removeFromCache(`session:device:${sessionId}`)
      return { valid: false, error: 'Session has expired' }
    }

    // Check device binding
    const deviceFingerprint = `${deviceInfo.deviceId}:${ipAddress}:${userAgent}`
    const storedFingerprint = await getFromCache(`session:device:${sessionId}`)
    
    if (storedFingerprint && storedFingerprint.fingerprint !== deviceFingerprint) {
      return { 
        valid: false, 
        error: 'Device binding mismatch',
        securityAlert: 'Suspicious device change detected'
      }
    }

    // Update last activity
    session.lastActivity = Date.now()
    await setInCache(`session:${sessionId}`, session, Math.floor((session.expiresAt - Date.now()) / 1000))

    // Update user's session list
    const userSessions = await getFromCache(`user:sessions:${session.userId}`) || []
    const updatedSessions = userSessions.map(s => 
      s.sessionId === sessionId ? { ...s, lastActivity: session.lastActivity } : s
    )
    await setInCache(`user:sessions:${session.userId}`, updatedSessions, Math.floor((session.expiresAt - Date.now()) / 1000))

    // Log security event
    await logSecurityEvent('SESSION_VALIDATED', session.userId, {
      sessionId,
      deviceId: deviceInfo.deviceId
    })

    return { valid: true, session }
  } catch (error) {
    return { valid: false, error: 'Session validation failed' }
  }
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const session = await getFromCache(`session:${sessionId}`)
  
  if (session) {
    await removeFromCache(`session:${sessionId}`)
    await removeFromCache(`session:device:${sessionId}`)
    
    // Update user's session list
    const userSessions = await getFromCache(`user:sessions:${session.userId}`) || []
    const updatedSessions = userSessions.filter(s => s.sessionId !== sessionId)
    await setInCache(`user:sessions:${session.userId}`, updatedSessions)

    // Log security event
    await logSecurityEvent('SESSION_INVALIDATED', session.userId, {
      sessionId,
      reason: 'manual_invalidation'
    })
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionData[]> {
  const sessionList = await getFromCache(`user:sessions:${userId}`) || []
  const now = Date.now()
  
  const activeSessions: SessionData[] = []
  
  for (const sessionInfo of sessionList) {
    if (sessionInfo.expiresAt > now) {
      const session = await getFromCache(`session:${sessionInfo.sessionId}`)
      if (session) {
        activeSessions.push(session)
      }
    }
  }
  
  return activeSessions
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  // This would typically be run by a cron job or background process
  // For now, we'll just log that it's been called
  console.log('Session cleanup initiated')
}