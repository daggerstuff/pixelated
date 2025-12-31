export const prerender = false
import { signIn } from '@/services/auth0.service'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { AuditEventType, createAuditLog } from '@/lib/audit'

/**
 * Auth0 Sign in endpoint
 * POST /api/auth/auth0-signin
 */
export const POST = async ({ request }) => {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Sign in with Auth0
    const { user, accessToken, refreshToken } = await signIn(email, password)

    // Set cookies for session management
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')

    // Set access token cookie
    headers.append('Set-Cookie', `auth-token=${accessToken}; Path=/; HttpOnly; Secure=${import.meta.env.PROD}; SameSite=Lax; Max-Age=3600`)

    // Set refresh token cookie if available
    if (refreshToken) {
      headers.append('Set-Cookie', `refresh-token=${refreshToken}; Path=/; HttpOnly; Secure=${import.meta.env.PROD}; SameSite=Lax; Max-Age=2592000`)
    }

    // Log the sign in for audit/compliance
    await createAuditLog(
      AuditEventType.LOGIN,
      'auth.signin',
      user.id,
      'auth',
      {
        email: user.email,
        role: user.role,
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          emailVerified: user.email_verified,
        },
      }),
      {
        status: 200,
        headers,
      },
    )
  } catch (error: unknown) {
    console.error('Auth0 Sign in error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Sign in failed',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}