import type {
  Session as SupabaseSession,
  User as SupabaseUser,
} from '@supabase/supabase-js'

export type User = SupabaseUser
export type Session = SupabaseSession

export interface SessionData {
  sessionId: string
  userId: string
  startTime: number
  expiresAt: number
  securityLevel: string
  metadata?: Record<string, unknown>
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

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: string
  permissions: string[]
  metadata?: Record<string, unknown>
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
