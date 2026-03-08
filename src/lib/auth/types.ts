import type { AuthRole } from '../../config/auth.config'

export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
  name?: string
  fullName?: string
  role: AuthRole
  permissions?: string[]
  metadata?: Record<string, unknown>
  avatarUrl?: string
  createdAt?: string
  updatedAt?: string
  lastLogin?: string
  appMetadata?: Record<string, unknown>
  userMetadata?: Record<string, unknown>
}

export interface SessionData {
  sessionId: string
  userId: string
  startTime: number
  expiresAt: number
  securityLevel: string
  metadata?: Record<string, unknown>
  /** Authenticated user attached by getSessionFromRequest */
  user?: AuthUser
  /** Raw session token info */
  session?: {
    token: string
    expiresAt: Date
  }
}

export interface AuthContext {
  session?: unknown
  securityVerification?: SecurityVerificationResult
  adminVerification?: AdminVerificationInfo
  hipaaCompliance?: HIPAAComplianceInfo
}

export interface SecurityVerificationResult {
  isValid: boolean
  details: {
    timestamp: number
    verificationHash: string
  }
}

export interface AdminVerificationInfo {
  verified: boolean
  timestamp: number
  userId: string
}

export interface HIPAAComplianceInfo {
  encryptionEnabled: boolean
  auditEnabled: boolean
  timestamp: number
}

export interface TokenData {
  token: string
  expires: number
}

export interface AuthenticationResult {
  success: boolean
  message?: string
  token?: TokenData
  session?: SessionData
}

export interface AuthError {
  message: string
  code?: string
  details?: Record<string, unknown>
}

export interface AuthResult {
  error?: AuthError
  data?: {
    user?: AuthUser
    url?: string
    token?: string
  }
}

export interface AuthOptions {
  redirectUrl?: string
  metadata?: Record<string, unknown>
  mode?: 'login' | 'register' | 'reset'
}
