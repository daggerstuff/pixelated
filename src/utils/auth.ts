import type { ObjectId as RealObjectId } from 'mongodb';

export interface User {
  _id?: RealObjectId
  id?: string
  email: string
  password?: string // hashed password
  role: 'admin' | 'user' | 'therapist'
  profile?: {
    firstName?: string
    lastName?: string
    avatarUrl?: string
    bio?: string
  }
  emailVerified: boolean
  emailVerificationToken?: string
  passwordResetToken?: string
  passwordResetExpires?: Date
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  _id?: RealObjectId
  userId: RealObjectId
  token: string
  expiresAt: Date
  createdAt: Date
  ipAddress?: string
  userAgent?: string
}

export interface Todo {
  _id?: RealObjectId
  id?: string
  name: string
  description?: string
  completed: boolean
  userId?: RealObjectId // For user-specific todos
  createdAt: Date
  updatedAt: Date
}

export interface AIMetrics {
  _id?: RealObjectId
  id?: string
  userId: RealObjectId
  sessionId: string
  modelName: string
  requestType: string
  tokensUsed: number
  responseTime: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface BiasDetection {
  _id?: RealObjectId
  id?: string
  userId: RealObjectId
  sessionId: string
  detectedBias: string
  biasType: string
  confidence: number
  contextSnippet: string
  correctionSuggestion?: string
  timestamp: Date
}

export interface TreatmentPlan {
  _id?: RealObjectId
  id?: string
  userId: RealObjectId
  therapistId: RealObjectId
  title: string
  description: string
  goals: string[]
  interventions: string[]
  status: 'active' | 'completed' | 'paused'
  startDate: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CrisisSessionFlag {
  _id?: RealObjectId
  id?: string
  userId: RealObjectId
  sessionId: string
  flagType: 'suicide_risk' | 'self_harm' | 'crisis'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: RealObjectId
  createdAt: Date
}

export interface ConsentManagement {
  _id?: RealObjectId
  id?: string
  userId: RealObjectId
  consentType: string
  granted: boolean
  version: string
  grantedAt?: Date
  revokedAt?: Date
  ipAddress?: string
}

// This is a placeholder for what the decoded token might look like.
// You should adjust this based on your actual token verification logic.
export interface AuthInfo {
  userId: string
  role: 'admin' | 'user' | 'therapist'
  session: string
}

/**
 * Verify and decode the auth token.
 * This is a placeholder function. You should implement your actual
 * token verification logic here, e.g., using a library like 'jsonwebtoken'.
 * @param authHeader The Authorization header from the request.
 * @returns The decoded auth context.
 * @throws Error if token is invalid.
 */
export async function verifyAuthToken(
  authHeader: string | null,
): Promise<AuthInfo> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid or missing authorization token')
  }

  const token = authHeader.split(' ')[1]

  // Here you would typically verify the token against a secret,
  // check its expiration, and decode it to get user information.
  // For this example, we'll return a mock AuthInfo object.
  // Replace this with your actual implementation.

  // Example of what you might get from a decoded JWT
  const decodedPayload = {
    userId: 'mock-user-id',
    role: 'user' as const,
  }

  return {
    userId: decodedPayload.userId,
    role: decodedPayload.role,
    session: token ?? '',
  }
}