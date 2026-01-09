export const prerender = false
import { auth0UserService } from '@/services/auth0.service'
import { AuditEventType, createAuditLog } from '@/lib/audit'
import { updatePhase6AuthenticationProgress } from '@/lib/mcp/phase6-integration'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'

/**
 * Unified Sign out endpoint using Auth0
 * POST /api/auth/signout
 */
export const POST = async ({ request }: { request: Request }) => {
  try {
    // Extract refresh token from cookie or body
    const refreshToken = request.headers.get('cookie')
      ?.split(';')
      .find(c => c.trim().startsWith('refresh-token='))
      ?.split('=')[1]

    if (refreshToken) {
      await auth0UserService.signOut(refreshToken)
    }

    // Clear cookies
    const headers = new Headers()
    const isProd = process.env.NODE_ENV === 'production'
    headers.append('Set-Cookie', `auth-token=; Path=/; HttpOnly; Secure=${isProd}; SameSite=Lax; Max-Age=0`)
    headers.append('Set-Cookie', `refresh-token=; Path=/; HttpOnly; Secure=${isProd}; SameSite=Lax; Max-Age=0`)

    // Extract user ID from token to log event
    const accessToken = extractTokenFromRequest(request)
    if (accessToken) {
      try {
        const { userId } = await auth0UserService.verifyAuthToken(accessToken)
        if (userId) {
          await createAuditLog(
            AuditEventType.LOGOUT,
            'auth.signout',
            userId,
            'auth'
          )
          await updatePhase6AuthenticationProgress(userId, 'user_logged_out')
        }
      } catch {
        // Token might be invalid already
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers,
      }
    )
  } catch (error: any) {
    console.error('Sign out error:', error)
    return new Response(
      JSON.stringify({ success: true }), // Still return success on logout error
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
