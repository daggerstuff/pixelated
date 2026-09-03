/**
 * Role transition type definitions.
 * Extracted from role-transitions.ts; pure type surface, no runtime logic.
 */

import type { UserRole } from './roles'

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
