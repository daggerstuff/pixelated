export const prerender = false
import { mongoAuthService } from '@/services/mongoAuth.service'

/**
 * Sign out endpoint
 * POST /api/auth/signout
 */
export const POST = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No valid token provided' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const token = authHeader.split(' ')[1]
    await mongoAuthService.signOut(token)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Signed out successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Sign out error:', error)
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
