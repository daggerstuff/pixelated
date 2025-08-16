import { MongoAuthService } from '../../services/mongoAuth.service'
import type { Session, User } from '../../types/mongodb.types'
import { AuditEventStatus, AuditEventType, createAuditLog } from '../../lib/audit'

const authService = new MongoAuthService()

export interface SessionData {
  user: User
  session: Session
}

/**
 * Get the current session from JWT token in cookies or Authorization header
 * @param request The request object from the API route
 * @returns The session data or null if not authenticated
 */
export async function getSession(
  request: Request,
): Promise<SessionData | null> {
  try {
    console.log('Processing request:', request.url)

    // Extract token from Authorization header or cookies
    const authHeader = request.headers.get('authorization')
    const token =
      authHeader?.replace('Bearer ', '') ||
      getCookieValue(request, 'auth-token')

    if (!token) {
      console.log('No authentication token found')
      return null
    }

    // Verify the JWT token
    const tokenPayload = await authService.verifyAuthToken(token)

    // Get the user from the database
    const user = await authService.getUserById(tokenPayload.userId)
    if (!user) {
      console.log('User not found for token')
      return null
    }

    // For now, create a basic session object
    // You may want to store actual sessions in MongoDB if needed
    const session: Session = {
      _id: new (await import('mongodb')).ObjectId(),
      userId: user._id,
      sessionId: tokenPayload.userId, // Using userId as sessionId for now
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return {
      user,
      session,
    }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Create a new session for a user
 * @param user The user to create a session for
 * @returns The session data
 */
export async function createSession(user: User): Promise<SessionData | null> {
  try {
    // This would typically be called after successful authentication
    // The actual session creation happens in MongoAuthService.signIn()
    // For compatibility, we'll create a basic session object

    const session: Session = {
      _id: new (await import('mongodb')).ObjectId(),
      userId: user._id,
      sessionId: user._id.toString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Log the session creation
    await createAuditLog(
      AuditEventType.ACCESS,
      'session_created',
      user._id.toString(),
      'user_session',
      {
        sessionId: session.sessionId.substring(0, 8),
        reason: 'user_login',
        userEmail: user.email,
      },
      AuditEventStatus.SUCCESS,
    )

    return {
      user,
      session,
    }
  } catch (error) {
    console.error('Error creating session:', error)
    return null
  }
}

/**
 * End the current session
 * @param sessionId The session ID to end
 * @param userId The user ID associated with the session
 */
export async function endSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  try {
    // Sign out using MongoDB auth service
    await authService.signOut(sessionId)

    // Log the session end
    await createAuditLog(
      AuditEventType.ACCESS,
      'session_destroyed',
      userId,
      'user_session',
      {
        sessionId: sessionId.substring(0, 8),
        reason: 'user_logout',
      },
      AuditEventStatus.SUCCESS,
    )
  } catch (error) {
    console.error('Error ending session:', error)
  }
}

/**
 * Helper function to extract cookie value from request
 * @param request The request object
 * @param cookieName The name of the cookie to extract
 * @returns The cookie value or null if not found
 */
function getCookieValue(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=')
    if (name === cookieName && value !== undefined) {
      return decodeURIComponent(value)
    }
  }
  return null
}
