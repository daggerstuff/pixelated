export const prerender = false
import { revokeToken } from '@/services/auth0.service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { AuditEventType, createAuditLog } from '@/lib/audit'

/**
 * Auth0 Sign out endpoint
 * POST /api/auth/auth0-signout
 */
export const POST = async ({ request }) => {
  try {
    // Extract refresh token from cookies
    const refreshToken = extractTokenFromRequest(request as unknown as Request)

    // Revoke refresh token if available
    if (refreshToken) {
      try {
        await revokeToken(refreshToken)
      } catch (revokeError) {
        console.warn('Failed to revoke refresh token:', revokeError)
      }
    }

    // Set headers to clear cookies
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')

    // Clear auth token cookie
    headers.append('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Secure=${import.meta.env.PROD}; SameSite=Lax; Max-Age=0')

    // Clear refresh token cookie
    headers.append('Set-Cookie', 'refresh-token=; Path=/; HttpOnly; Secure=${import.meta.env.PROD}; SameSite=Lax; Max-Age=0')

    return new Response(
      JSON.stringify({ success: true, message: 'Signed out successfully' }),
      {
        status: 200,
        headers,
      },
    )
  } catch (error: unknown) {
    console.error('Auth0 Sign out error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Sign out failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}