/**
 * Role Transition Workflows - Phase 7 Multi-Role Authentication
 * Implements secure role transitions with approval workflows and comprehensive audit logging
 */

import { nanoid } from 'nanoid'
import { setInCache, getFromCache, removeFromCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { AuthenticationError } from './jwt-service'
import {
  UserRole,
  ROLE_DEFINITIONS,
  validateRoleTransition,
  canAssignRole,
} from './roles'
import { isTwoFactorRequired, verifyTwoFactorToken } from './two-factor-auth'
import type { SessionData } from './session-management'

// Configuration
const ROLE_TRANSITION_CONFIG = {
  approvalTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxPendingRequests: 5,
  auditRetentionDays: 365,
  notificationEnabled: true,
  escalationEnabled: true,
}

// Types
export interface RoleTransitionRequest {
  id: string
  userId: string
  currentRole: UserRole
  requestedRole: UserRole
  reason: string
  requestedBy: string
  requestedAt: number
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  approverId?: string
  approvalReason?: string
  approvedAt?: number
  rejectedAt?: number
  rejectionReason?: string
  cancelledAt?: number
  cancellationReason?: string
  expiresAt: number
  twoFactorVerified: boolean
  securityReviewCompleted: boolean
  metadata?: Record<string, unknown>
}

export interface RoleTransitionApproval {
  requestId: string
  approverId: string
  approverRole: UserRole
  decision: 'approve' | 'reject'
  reason: string
  twoFactorToken: string
  timestamp: number
}

export interface RoleTransitionAuditLog {
  id: string
  requestId: string
  userId: string
  action:
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'completed'
  roleFrom: UserRole
  roleTo: UserRole
  actorId: string
  actorRole: UserRole
  reason: string
  timestamp: number
  ipAddress: string
  userAgent: string
  sessionId: string
  metadata?: Record<string, unknown>
}

export interface RoleAssignmentRequest {
  userId: string
  targetRole: UserRole
  reason: string
  requestedBy: string
  assignerRole: UserRole
  twoFactorToken: string
  metadata?: Record<string, unknown>
}

export interface RoleTransitionValidation {
  canTransition: boolean
  requiresApproval: boolean
  requiresMFA: boolean
  requiresSecurityReview: boolean
  restrictions: string[]
  warnings: string[]
}

/**
 * Request role transition
 */
export async function requestRoleTransition(
  userId: string,
  requestedRole: UserRole,
  reason: string,
  requestedBy: string,
  sessionData: SessionData,
  clientInfo: {
    ipAddress: string
    userAgent: string
  },
): Promise<RoleTransitionRequest> {
  try {
    // Get current user role
    const currentRole = sessionData.role

    // Validate role transition
    const validation = validateRoleTransition(currentRole, requestedRole)

    if (!validation.requiresApproval) {
      throw new AuthenticationError(
        'Role transition does not require approval process',
      )
    }

    // Check if user has pending requests
    const pendingRequests = await getPendingRoleRequests(userId)
    if (pendingRequests.length >= ROLE_TRANSITION_CONFIG.maxPendingRequests) {
      throw new AuthenticationError(
        'Maximum pending role transition requests reached',
      )
    }

    // Verify 2FA if required
    if (validation.requiresMFA) {
      const is2FAValid = await verifyTwoFactorToken({
        userId: requestedBy,
        token: sessionData.twoFactorVerified ? 'verified' : '', // Assume verified if already in session
        deviceId: sessionData.deviceId,
      })

      if (!is2FAValid) {
        throw new AuthenticationError(
          '2FA verification required for role transition',
        )
      }
    }

    // Create transition request
    const requestId = `role_req_${nanoid(16)}`
    const now = Date.now()

    const transitionRequest: RoleTransitionRequest = {
      id: requestId,
      userId,
      currentRole,
      requestedRole,
      reason,
      requestedBy,
      requestedAt: now,
      status: 'pending',
      expiresAt: now + ROLE_TRANSITION_CONFIG.approvalTimeout,
      twoFactorVerified: validation.requiresMFA,
      securityReviewCompleted: false,
      metadata: {
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        sessionId: sessionData.sessionId,
      },
    }

    // Store request
    await setInCache(
      `role_transition:request:${requestId}`,
      transitionRequest,
      Math.floor(ROLE_TRANSITION_CONFIG.approvalTimeout / 1000),
    )

    // Add to user's pending requests
    await addUserPendingRequest(userId, requestId)

    // Log request creation
    await logRoleTransitionAudit({
      id: `audit_${nanoid(16)}`,
      requestId,
      userId,
      action: 'requested',
      roleFrom: currentRole,
      roleTo: requestedRole,
      actorId: requestedBy,
      actorRole: sessionData.role,
      reason,
      timestamp: now,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      sessionId: sessionData.sessionId,
    })

    // Send notifications (implement notification service)
    await notifyRoleTransitionRequest(transitionRequest)

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(
      userId,
      'role_transition_requested',
    )

    return transitionRequest
  } catch (error) {
    await logSecurityEvent(SecurityEventType.ROLE_TRANSITION_REQUEST_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestedRole,
      requestedBy,
    },
    )

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to request role transition')
  }
}

/**
 * Approve or reject role transition request
 */
export async function processRoleTransitionApproval(
  approval: RoleTransitionApproval,
  approverSession: SessionData,
  clientInfo: {
    ipAddress: string
    userAgent: string
  },
): Promise<RoleTransitionRequest> {
  try {
    const {
      requestId,
      approverId,
      approverRole,
      decision,
      reason,
      twoFactorToken,
    } = approval

    // Get the transition request
    const request = await getFromCache(`role_transition:request:${requestId}`)
    if (!request) {
      throw new AuthenticationError('Role transition request not found')
    }

    // Check if request is still pending
    if (request.status !== 'pending') {
      throw new AuthenticationError(
        'Role transition request is no longer pending',
      )
    }

    // Check if request has expired
    if (Date.now() > request.expiresAt) {
      await expireRoleTransitionRequest(requestId)
      throw new AuthenticationError('Role transition request has expired')
    }

    // Verify approver has permission to approve this role transition
    if (!canApproveRoleTransition(approverRole, request.requestedRole)) {
      throw new AuthenticationError(
        'Insufficient permissions to approve this role transition',
      )
    }

    // Verify 2FA for approver
    const requires2FA = await isTwoFactorRequired(
      approverId,
      approverRole,
      approverSession.deviceId,
    )
    if (requires2FA) {
      const is2FAValid = await verifyTwoFactorToken({
        userId: approverId,
        token: twoFactorToken,
        deviceId: approverSession.deviceId,
      })

      if (!is2FAValid) {
        throw new AuthenticationError(
          '2FA verification required for role transition approval',
        )
      }
    }

    // Update request status
    const now = Date.now()
    request.status = decision === 'approve' ? 'approved' : 'rejected'
    request.approverId = approverId
    request.approvalReason = reason
    request.approvedAt = decision === 'approve' ? now : undefined
    request.rejectedAt = decision === 'reject' ? now : undefined
    request.rejectionReason = decision === 'reject' ? reason : undefined

    // Store updated request
    await setInCache(
      `role_transition:request:${requestId}`,
      request,
      Math.floor((request.expiresAt - now) / 1000),
    )

    // Log approval/rejection
    await logRoleTransitionAudit({
      id: `audit_${nanoid(16)}`,
      requestId,
      userId: request.userId,
      action: decision === 'approve' ? 'approved' : 'rejected',
      roleFrom: request.currentRole,
      roleTo: request.requestedRole,
      actorId: approverId,
      actorRole: approverRole,
      reason,
      timestamp: now,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      sessionId: approverSession.sessionId,
    })

    // If approved, execute the role transition
    if (decision === 'approve') {
      await executeRoleTransition(request, approverSession)
    }

    // Remove from pending requests
    await removeUserPendingRequest(request.userId, requestId)

    // Send notifications
    await notifyRoleTransitionDecision(request, approverId, decision)

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(
      request.userId,
      `role_transition_${decision}`,
    )

    return request
  } catch (error) {
    await logSecurityEvent(SecurityEventType.ROLE_TRANSITION_APPROVAL_FAILED, {
      userId: approverId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      decision,
    })

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to process role transition approval')
  }
}

/**
 * Execute approved role transition
 */
async function executeRoleTransition(
  request: RoleTransitionRequest,
  approverSession: SessionData,
): Promise<void> {
  try {
    // Get user's current authentication data
    const userAuth = await getFromCache(`user_auth:${request.userId}`)
    if (!userAuth) {
      throw new AuthenticationError('User authentication data not found')
    }

    // Update user's role
    const previousRole = userAuth.role
    userAuth.role = request.requestedRole
    userAuth.updatedAt = Date.now()

    // Store updated user authentication
    await setInCache(
      `user_auth:${request.userId}`,
      userAuth,
      365 * 24 * 60 * 60,
    ) // 1 year

    // Update user's permissions based on new role
    const newPermissions = getRolePermissions(request.requestedRole)
    userAuth.permissions = newPermissions

    // Log successful role transition
    await logRoleTransitionAudit({
      id: `audit_${nanoid(16)}`,
      requestId: request.id,
      userId: request.userId,
      action: 'completed',
      roleFrom: previousRole,
      roleTo: request.requestedRole,
      actorId: request.approverId!,
      actorRole: approverSession.role,
      reason: 'Role transition approved and executed',
      timestamp: Date.now(),
      ipAddress: approverSession.ipAddress,
      userAgent: approverSession.userAgent,
      sessionId: approverSession.sessionId,
    })

    // Send success notification
    await notifyRoleTransitionSuccess(request)

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(
      request.userId,
      'role_transition_completed',
    )
  } catch (error) {
    await logSecurityEvent(SecurityEventType.ROLE_TRANSITION_EXECUTION_FAILED, {
      userId: request.userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: request.id,
    })

    throw new AuthenticationError('Failed to execute role transition')
  }
}

/**
 * Cancel role transition request
 */
export async function cancelRoleTransitionRequest(
  requestId: string,
  userId: string,
  reason: string,
  sessionData: SessionData,
  clientInfo: {
    ipAddress: string
    userAgent: string
  },
): Promise<void> {
  try {
    // Get the transition request
    const request = await getFromCache(`role_transition:request:${requestId}`)
    if (!request) {
      throw new AuthenticationError('Role transition request not found')
    }

    // Verify user can cancel this request
    if (request.userId !== userId && request.requestedBy !== userId) {
      throw new AuthenticationError(
        'Unauthorized to cancel this role transition request',
      )
    }

    // Check if request is still pending
    if (request.status !== 'pending') {
      throw new AuthenticationError(
        'Cannot cancel non-pending role transition request',
      )
    }

    // Update request status
    request.status = 'cancelled'
    request.cancelledAt = Date.now()
    request.cancellationReason = reason

    // Store updated request
    await setInCache(
      `role_transition:request:${requestId}`,
      request,
      Math.floor((request.expiresAt - Date.now()) / 1000),
    )

    // Remove from pending requests
    await removeUserPendingRequest(request.userId, requestId)

    // Log cancellation
    await logRoleTransitionAudit({
      id: `audit_${nanoid(16)}`,
      requestId,
      userId: request.userId,
      action: 'cancelled',
      roleFrom: request.currentRole,
      roleTo: request.requestedRole,
      actorId: userId,
      actorRole: sessionData.role,
      reason,
      timestamp: Date.now(),
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      sessionId: sessionData.sessionId,
    })

    // Send cancellation notification
    await notifyRoleTransitionCancellation(request, userId, reason)

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(
      request.userId,
      'role_transition_cancelled',
    )
  } catch (error) {
    await logSecurityEvent(SecurityEventType.ROLE_TRANSITION_CANCELLATION_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    })

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to cancel role transition request')
  }
}

/**
 * Get role transition requests for user
 */
export async function getUserRoleTransitionRequests(
  userId: string,
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled',
): Promise<RoleTransitionRequest[]> {
  try {
    const requestsKey = `user:role_requests:${userId}`
    const requestIds = (await getFromCache(requestsKey)) || []

    const requests: RoleTransitionRequest[] = []

    for (const requestId of requestIds) {
      const request = await getFromCache(`role_transition:request:${requestId}`)
      if (request && (!status || request.status === status)) {
        requests.push(request)
      }
    }

    // Sort by requested date (newest first)
    requests.sort((a, b) => b.requestedAt - a.requestedAt)

    return requests
  } catch (error) {
    console.error('Error getting user role transition requests:', error)
    return []
  }
}

/**
 * Get pending role transition requests for approval
 */
export async function getPendingRoleTransitionRequests(
  approverRole: UserRole,
): Promise<RoleTransitionRequest[]> {
  try {
    // Get all pending request IDs (simplified implementation)
    const pendingKey = 'role_transition:pending'
    const requestIds = (await getFromCache(pendingKey)) || []

    const eligibleRequests: RoleTransitionRequest[] = []

    for (const requestId of requestIds) {
      const request = await getFromCache(`role_transition:request:${requestId}`)
      if (
        request &&
        request.status === 'pending' &&
        Date.now() <= request.expiresAt &&
        canApproveRoleTransition(approverRole, request.requestedRole)
      ) {
        eligibleRequests.push(request)
      }
    }

    // Sort by requested date (oldest first)
    eligibleRequests.sort((a, b) => a.requestedAt - b.requestedAt)

    return eligibleRequests
  } catch (error) {
    console.error('Error getting pending role transition requests:', error)
    return []
  }
}

/**
 * Check if role can approve role transitions
 */
function canApproveRoleTransition(
  approverRole: UserRole,
  targetRole: UserRole,
): boolean {
  const approverDef = ROLE_DEFINITIONS[approverRole]
  const targetDef = ROLE_DEFINITIONS[targetRole]

  if (!approverDef || !targetDef) {
    return false
  }

  // Approver must have higher hierarchy level than target role
  return approverDef.hierarchyLevel > targetDef.hierarchyLevel
}

/**
 * Get role permissions
 */
function getRolePermissions(role: UserRole): string[] {
  const roleDef = ROLE_DEFINITIONS[role]
  if (!roleDef) return []

  if (roleDef.permissions.includes('*')) {
    // Return all available permissions for admin
    return ['*']
  }

  return [...roleDef.permissions]
}

/**
 * Add user pending request
 */
async function addUserPendingRequest(
  userId: string,
  requestId: string,
): Promise<void> {
  try {
    const pendingKey = `user:pending_requests:${userId}`
    let pendingRequests = (await getFromCache(pendingKey)) || []

    pendingRequests.push(requestId)

    await setInCache(pendingKey, pendingRequests, 7 * 24 * 60 * 60) // 7 days
  } catch (error) {
    console.error('Error adding user pending request:', error)
  }
}

/**
 * Remove user pending request
 */
async function removeUserPendingRequest(
  userId: string,
  requestId: string,
): Promise<void> {
  try {
    const pendingKey = `user:pending_requests:${userId}`
    let pendingRequests = (await getFromCache(pendingKey)) || []

    pendingRequests = pendingRequests.filter((id: string) => id !== requestId)

    if (pendingRequests.length > 0) {
      await setInCache(pendingKey, pendingRequests, 7 * 24 * 60 * 60)
    } else {
      await removeFromCache(pendingKey)
    }
  } catch (error) {
    console.error('Error removing user pending request:', error)
  }
}

/**
 * Get pending role requests for user
 */
async function getPendingRoleRequests(
  userId: string,
): Promise<RoleTransitionRequest[]> {
  try {
    const pendingKey = `user:pending_requests:${userId}`
    const requestIds = (await getFromCache(pendingKey)) || []

    const requests: RoleTransitionRequest[] = []

    for (const requestId of requestIds) {
      const request = await getFromCache(`role_transition:request:${requestId}`)
      if (request && request.status === 'pending') {
        requests.push(request)
      }
    }

    return requests
  } catch (error) {
    console.error('Error getting pending role requests:', error)
    return []
  }
}

/**
 * Expire role transition request
 */
async function expireRoleTransitionRequest(requestId: string): Promise<void> {
  try {
    const request = await getFromCache(`role_transition:request:${requestId}`)
    if (!request) return

    request.status = 'expired'

    await setInCache(
      `role_transition:request:${requestId}`,
      request,
      Math.floor((request.expiresAt - Date.now()) / 1000),
    )

    // Remove from pending requests
    await removeUserPendingRequest(request.userId, requestId)

    // Log expiration
    await logRoleTransitionAudit({
      id: `audit_${nanoid(16)}`,
      requestId,
      userId: request.userId,
      action: 'expired',
      roleFrom: request.currentRole,
      roleTo: request.requestedRole,
      actorId: 'system',
      actorRole: 'system',
      reason: 'Request expired',
      timestamp: Date.now(),
      ipAddress: 'system',
      userAgent: 'system',
      sessionId: 'system',
    })
  } catch (error) {
    console.error('Error expiring role transition request:', error)
  }
}

/**
 * Log role transition audit event
 */
async function logRoleTransitionAudit(
  auditLog: RoleTransitionAuditLog,
): Promise<void> {
  try {
    // Store audit log
    await setInCache(
      `role_transition:audit:${auditLog.id}`,
      auditLog,
      ROLE_TRANSITION_CONFIG.auditRetentionDays * 24 * 60 * 60,
    )

    // Add to user's audit trail
    const userAuditKey = `user:role_audit:${auditLog.userId}`
    let userAuditTrail = (await getFromCache(userAuditKey)) || []

    userAuditTrail.push(auditLog.id)

    // Keep only last 100 entries
    if (userAuditTrail.length > 100) {
      userAuditTrail = userAuditTrail.slice(-100)
    }

    await setInCache(
      userAuditKey,
      userAuditTrail,
      ROLE_TRANSITION_CONFIG.auditRetentionDays * 24 * 60 * 60,
    )

    // Log security event
    await logSecurityEvent(SecurityEventType.ROLE_TRANSITION_AUDIT, {
      userId: auditLog.userId,
      action: auditLog.action,
      roleFrom: auditLog.roleFrom,
      roleTo: auditLog.roleTo,
      actorId: auditLog.actorId,
      actorRole: auditLog.actorRole,
    },
    )
  } catch (error) {
    console.error('Error logging role transition audit:', error)
  }
}

/**
 * Notification functions (implement based on your notification service)
 */
async function notifyRoleTransitionRequest(
  request: RoleTransitionRequest,
): Promise<void> {
  // Implement notification logic
  console.log(
    `Role transition requested: ${request.userId} from ${request.currentRole} to ${request.requestedRole}`,
  )
}

async function notifyRoleTransitionDecision(
  request: RoleTransitionRequest,
  approverId: string,
  decision: 'approve' | 'reject',
): Promise<void> {
  // Implement notification logic
  console.log(`Role transition ${decision}: ${request.userId} by ${approverId}`)
}

async function notifyRoleTransitionSuccess(
  request: RoleTransitionRequest,
): Promise<void> {
  // Implement notification logic
  console.log(
    `Role transition completed: ${request.userId} is now ${request.requestedRole}`,
  )
}

async function notifyRoleTransitionCancellation(
  request: RoleTransitionRequest,
  cancellerId: string,
  _reason: string,
): Promise<void> {
  // Implement notification logic
  console.log(`Role transition cancelled: ${request.userId} by ${cancellerId}`)
}

/**
 * Get role transition audit trail
 */
export async function getRoleTransitionAuditTrail(
  userId: string,
  limit: number = 50,
): Promise<RoleTransitionAuditLog[]> {
  try {
    const userAuditKey = `user:role_audit:${userId}`
    const auditIds = (await getFromCache(userAuditKey)) || []

    const auditLogs: RoleTransitionAuditLog[] = []

    // Get most recent audit entries
    const recentIds = auditIds.slice(-limit)

    for (const auditId of recentIds) {
      const auditLog = await getFromCache(`role_transition:audit:${auditId}`)
      if (auditLog) {
        auditLogs.push(auditLog)
      }
    }

    // Sort by timestamp (newest first)
    auditLogs.sort((a, b) => b.timestamp - a.timestamp)

    return auditLogs
  } catch (error) {
    console.error('Error getting role transition audit trail:', error)
    return []
  }
}

/**
 * Validate role assignment permissions
 */
export async function validateRoleAssignment(
  assignerId: string,
  assignerRole: UserRole,
  targetUserId: string,
  targetRole: UserRole,
  sessionData: SessionData,
  twoFactorToken: string,
): Promise<RoleTransitionValidation> {
  try {
    const validation: RoleTransitionValidation = {
      canTransition: false,
      requiresApproval: false,
      requiresMFA: false,
      requiresSecurityReview: false,
      restrictions: [],
      warnings: [],
    }

    // Check if assigner can assign the target role
    if (!canAssignRole(assignerRole, targetRole)) {
      validation.restrictions.push(
        'Insufficient permissions to assign this role',
      )
      return validation
    }

    // Check if 2FA is required
    if (
      await isTwoFactorRequired(assignerId, assignerRole, sessionData.deviceId)
    ) {
      if (!twoFactorToken) {
        validation.requiresMFA = true
        validation.restrictions.push('2FA verification required')
        return validation
      }

      const is2FAValid = await verifyTwoFactorToken({
        userId: assignerId,
        token: twoFactorToken,
        deviceId: sessionData.deviceId,
      })

      if (!is2FAValid) {
        validation.restrictions.push('Invalid 2FA verification')
        return validation
      }
    }

    // Check if target role requires approval
    const targetRoleDef = ROLE_DEFINITIONS[targetRole]
    if (targetRoleDef.requiresApproval) {
      validation.requiresApproval = true
      validation.warnings.push(
        'This role assignment requires approval workflow',
      )
    }

    // Check if security review is required
    if (
      targetRoleDef.permissions.includes('manage:roles') ||
      targetRoleDef.permissions.includes('*') ||
      targetRole === 'admin'
    ) {
      validation.requiresSecurityReview = true
      validation.warnings.push('This role assignment requires security review')
    }

    // Check for existing role conflicts
    const targetUserAuth = await getFromCache(`user_auth:${targetUserId}`)
    if (targetUserAuth) {
      const currentRole = targetUserAuth.role
      if (currentRole === targetRole) {
        validation.restrictions.push('User already has this role')
        return validation
      }

      // Validate role transition
      try {
        const transitionValidation = validateRoleTransition(
          currentRole,
          targetRole,
        )
        if (transitionValidation.requiresApproval) {
          validation.requiresApproval = true
        }
      } catch (_error) {
        validation.restrictions.push('Invalid role transition')
        return validation
      }
    }

    validation.canTransition = validation.restrictions.length === 0
    return validation
  } catch (error) {
    console.error('Error validating role assignment:', error)
    validation.restrictions.push('Validation failed due to system error')
    return validation
  }
}

/**
 * Security event types for role transitions
 */
export const RoleTransitionSecurityEventType = {
  ROLE_TRANSITION_REQUESTED: 'ROLE_TRANSITION_REQUESTED',
  ROLE_TRANSITION_REQUEST_FAILED: 'ROLE_TRANSITION_REQUEST_FAILED',
  ROLE_TRANSITION_APPROVED: 'ROLE_TRANSITION_APPROVED',
  ROLE_TRANSITION_REJECTED: 'ROLE_TRANSITION_REJECTED',
  ROLE_TRANSITION_APPROVAL_FAILED: 'ROLE_TRANSITION_APPROVAL_FAILED',
  ROLE_TRANSITION_COMPLETED: 'ROLE_TRANSITION_COMPLETED',
  ROLE_TRANSITION_EXECUTION_FAILED: 'ROLE_TRANSITION_EXECUTION_FAILED',
  ROLE_TRANSITION_CANCELLED: 'ROLE_TRANSITION_CANCELLED',
  ROLE_TRANSITION_CANCELLATION_FAILED: 'ROLE_TRANSITION_CANCELLATION_FAILED',
  ROLE_TRANSITION_AUDIT: 'ROLE_TRANSITION_AUDIT',
} as const
