export const prerender = false
import { auth0UserService } from '@/services/auth0.service'
import { AuditEventType, createAuditLog } from '@/lib/audit'
import { logSecurityEvent, SecurityEventType } from '@/lib/security'
import { updatePhase6AuthenticationProgress } from '@/lib/mcp/phase6-integration'
import { rateLimitMiddleware, csrfProtection } from '@/lib/auth/middleware'
import { sanitizeInput } from '@/lib/auth/utils'

/**
 * Unified Sign in endpoint using Auth0
 * POST /api/auth/signin
 */
export const POST = async ({ request, clientAddress }: { request: Request; clientAddress: string }) => {
  let clientInfo;
  try {
    // Extract client information
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceId = request.headers.get('x-device-id') || 'unknown'
    clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent,
      deviceId,
    }

    // Apply CSRF protection
    const csrfResult = await csrfProtection(request as any)
    if (!csrfResult.success) {
      return csrfResult.response!
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(
      request,
      'signin',
      10, // 10 attempts per hour
      60,
    )

    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    // Parse and validate request body
    const body = await request.json()
    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Sanitize input
    const email = sanitizeInput(body.email)
    const { password } = body

    // Sign in with Auth0
    const { user, token, refreshToken } = await auth0UserService.signIn(email, password)

    // Set cookies for session management
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')

    // Set access token cookie
    const isProd = process.env.NODE_ENV === 'production'
    headers.append('Set-Cookie', `auth-token=${token}; Path=/; HttpOnly; Secure=${isProd}; SameSite=Lax; Max-Age=3600`)

    // Set refresh token cookie if available
    if (refreshToken) {
      headers.append('Set-Cookie', `refresh-token=${refreshToken}; Path=/; HttpOnly; Secure=${isProd}; SameSite=Lax; Max-Age=2592000`)
    }

    // Log successful login
    await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, user.id, {
      email: user.email,
      role: user.role,
      clientInfo,
      timestamp: Date.now(),
    })

    // Log for audit/compliance
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

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(user.id, 'user_logged_in')

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
        },
        token,
      }),
      {
        status: 200,
        headers,
      },
    )
  } catch (error: any) {
    console.error('Sign in error:', error)

    await logSecurityEvent(SecurityEventType.AUTHENTICATION_FAILED, null, {
      error: error.message,
      clientInfo,
      timestamp: Date.now(),
    })

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

// Handle OPTIONS requests for CORS
export const OPTIONS = async ({ request }: { request: Request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Device-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}
