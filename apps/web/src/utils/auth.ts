import type { AuthUser, SessionData } from '@/lib/auth/types'

import { verifyToken as auth0VerifyToken } from '../lib/services/auth0.service'

/** Legacy sessions may expose MongoDB-style `_id` instead of `id`. */
type SessionUserWithLegacyId = AuthUser & {
  _id?: string | { toString(): string }
}

function userIdFromSessionUser(user: SessionUserWithLegacyId): string | null {
  if (user.id) return user.id
  const legacyId = user._id
  if (legacyId == null) return null
  return typeof legacyId === 'string' ? legacyId : legacyId.toString()
}

/**
 * Utility to verify auth tokens using Auth0 service.
 */
export async function verifyAuthToken(token: string) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required for verification')
  }
  const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token
  return await auth0VerifyToken(cleanToken)
}

/**
 * Utility to get session from request.
 * Checks for session token in cookies or Authorization header.
 */
export async function getSessionFromRequest(
  request: Request,
): Promise<SessionData | null> {
  // Simple implementation for compatibility
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    try {
      const decoded = await verifyAuthToken(authHeader)
      return {
        user: {
          id: decoded.userId,
          _id: decoded.userId,
          email: decoded.email,
          role: decoded.role as string,
          emailVerified: true,
        } as Record<string, unknown>,
        session: {
          token: authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader,
          expiresAt: new Date(Date.now() + 3600000), // Mock expiry
        },
      } as SessionData
    } catch (e) {
      console.error('Error verifying session from header:', e)
    }
  }

  // Fallback to cookies (simplified)
  const cookieHeader = request.headers.get('Cookie')
  if (cookieHeader) {
    // In a real implementation we'd parse cookies here.
    // For now, if we can't find it in header, we'd need a cookie parser.
  }

  return null
}

/**
 * Resolve the authenticated user ID from session, Authorization header, or auth cookie.
 */
export async function resolveUserIdFromRequest(
  request: Request,
): Promise<string | null> {
  const session = await getSessionFromRequest(request)
  if (session?.user) {
    return userIdFromSessionUser(session.user)
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    const { userId } = await verifyAuthToken(authHeader)
    return userId ?? null
  }

  const cookieToken =
    request.headers
      .get('cookie')
      ?.split(';')
      .find((c) => c.trim().startsWith('auth-token='))
      ?.split('=')[1] ?? null

  if (cookieToken) {
    const { userId } = await verifyAuthToken(cookieToken)
    return userId ?? null
  }

  return null
}

/**
 * Auth object for catch-all route compatibility.
 */
export const auth = {
  verifyAuthToken,
  getSessionFromRequest,
  resolveUserIdFromRequest,
}
