export const prerender = false
import * as adapter from '../../../adapters/betterAuthMongoAdapter'

/**
 * Sign in endpoint
 * POST /api/auth/signin
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

    const { user, token } = (await adapter.signIn(
      email,
      password,
    )) as unknown as { user: unknown; token: string }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user._id?.toString() || user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          emailVerified: user.emailVerified,
        },
        token,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    console.error('Sign in error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? String(error) : 'Sign in failed',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
