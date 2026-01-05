export const prerender = false
import { createUser } from '@/services/auth0.service'
import { AuditEventType, createAuditLog } from '@/lib/audit'

/**
 * Auth0 Sign up endpoint
 * POST /api/auth/auth0-signup
 */
export const POST = async ({ request }) => {
  try {
    const { email, password, role = 'user' } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create user with Auth0
    const user = await createUser({ email, password, role })

    // Log the sign up for audit/compliance
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

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          emailVerified: user.email_verified,
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    console.error('Auth0 Sign up error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Sign up failed',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}