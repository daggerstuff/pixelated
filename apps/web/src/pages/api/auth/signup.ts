export const prerender = false
import { AuditEventType, createAuditLog } from '../../../lib/audit'
import {
  rateLimitMiddleware,
  csrfProtection,
} from '../../../lib/auth/middleware'
import {
  sanitizeInput,
  isValidEmail,
  isValidPassword,
} from '../../../lib/auth/utils'
import { updatePhase6AuthenticationProgress } from '../../../lib/mcp/phase6-integration'
import { logSecurityEvent, SecurityEventType } from '../../../lib/security'
import { auth0UserService } from '../../../lib/services/auth0.service'
import { validateRequestBody } from '../../../lib/validation/validateRequestBody'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
  role: z.string().optional(),
})

/**
 * Unified Sign up endpoint using Auth0
 * POST /api/auth/signup
 */
export const POST = async ({
  request,
  clientAddress,
}: {
  request: Request
  clientAddress: string
}) => {
  let clientInfo
  try {
    // Extract client information
    const userAgent = request.headers.get('user-agent') ?? 'unknown'
    const deviceId = request.headers.get('x-device-id') ?? 'unknown'
    clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent,
      deviceId,
    }

    // Apply CSRF protection
    const csrfResult = await csrfProtection(request)
    if (!csrfResult.success) {
      return csrfResult.response!
    }

    // Apply rate limiting (stricter for registration)
    const rateLimitResult = await rateLimitMiddleware(
      request,
      'signup',
      5, // 5 attempts per hour
      60,
    )

    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    // Parse and validate request body with Zod
    const [body, validationError] = await validateRequestBody(
      request,
      signupSchema,
    )
    if (validationError) {
      const firstError = Object.values(validationError.details)[0] ?? 'Email and password are required'
      return new Response(
        JSON.stringify({ error: firstError }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Sanitize input
    const email = sanitizeInput(body.email)
    const { password, role = 'user' } = body

    // Validate email
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate password
    const passwordValidity = isValidPassword(password)
    if (!passwordValidity.valid) {
      return new Response(
        JSON.stringify({
          error: 'Password does not meet requirements',
          details: passwordValidity.errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create user with Auth0
    const user = await auth0UserService.createUser(email, password, role)

    // Log security event
    logSecurityEvent(SecurityEventType.USER_CREATED, user.id, {
      email: user.email,
      role: user.role,
      clientInfo,
      timestamp: Date.now(),
    })

    // Log for audit/compliance
    await createAuditLog(
      AuditEventType.REGISTER,
      'auth.signup',
      user.id,
      'auth',
      {
        email: user.email,
        role: user.role,
      },
    )

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(user.id, 'user_registered')

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        message: 'Registration successful. Please verify your email.',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: any) {

    logSecurityEvent('error', null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientInfo,
      timestamp: Date.now(),
    })

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Sign up failed',
      }),
      {
        status: 400,
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
      'Access-Control-Allow-Origin': request.headers.get('origin') ?? '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-CSRF-Token, X-Device-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}
