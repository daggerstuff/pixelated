import type { ObjectId as RealObjectId } from 'mongodb'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { client } from '@/db'
import * as adapter from '@/adapters/betterAuthMongoAdapter'

export const auth = betterAuth({
  adapter: mongodbAdapter(client),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
})

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
  userId?: RealObjectId
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

export interface AuthInfo {
  userId: string
  role: 'admin' | 'user' | 'therapist'
  session: string
}

/**
 * @param authHeaderOrToken The Authorization header or raw token string.
 * @returns The decoded auth context.
 * @throws Error if token is invalid or missing.
 */
export async function verifyAuthToken(
  authHeaderOrToken: string | null,
): Promise<AuthInfo> {
  if (process.env.NODE_ENV !== 'production') {
      if (process.env.ALLOW_AUTH_DISABLE === 'true') {
        return {
          userId: 'test-user-id',
          role: 'user',
          session: 'test-session',
        }
      }
    }
  else if (process.env.DISABLE_AUTH === 'true' ||
        process.env.ALLOW_AUTH_DISABLE === 'true') {
        throw new Error(
          'Auth disabling is not permitted in production. Remove DISABLE_AUTH/ALLOW_AUTH_DISABLE from production environment.',
        )
      }

  if (!authHeaderOrToken || typeof authHeaderOrToken !== 'string') {
    throw new Error('Invalid or missing authorization token')
  }

  let token = authHeaderOrToken.trim()
  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim()
  }
  if (!token) {
    throw new Error('Authorization token is empty after parsing')
  }

  const info = await adapter.verifyToken(token)
  if (!info || !info.userId || !info.role) {
    throw new Error('Token verification failed: missing userId or role')
  }
  if (!['admin', 'user', 'therapist'].includes(info.role)) {
    throw new Error(`Token verification failed: invalid role '${info.role}'`)
  }
  return {
    userId: info.userId,
    role: info.role as AuthInfo['role'],
    session: info.session ?? token,
  }
}

/**
 * Extract bearer token from request (Authorization header or cookie named `auth-token`).
 */
function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer '))
    return authHeader.split(' ')[1]

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const c of cookies) {
    const [name, val] = c.split('=')
    if (name === 'auth-token' && val !== undefined)
      return decodeURIComponent(val)
  }
  return null
}

/**
 * Get session and user from a server Request using Better-Auth token verification.
 * Returns an object with `user` and `session` or null when not authenticated.
 */
export async function getSessionFromRequest(
  request: Request,
): Promise<{ user: User; session: Session } | null> {
  try {
    // First, allow disabling auth in testing
    if (process.env.DISABLE_AUTH === 'true') {
      return null
    }

    const token = extractTokenFromRequest(request)
    if (!token) return null

    // verify token via adapter (delegates to mongoAuthService)
    const authInfo = await verifyAuthToken(token)

    const user = await adapter.getUserById(authInfo.userId)
    if (!user) return null

    const session: Session = {
      userId: user._id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    }

    return { user, session }
  } catch (_error) {
    return null
  }
}

export * from '@/adapters/betterAuthMongoAdapter'
