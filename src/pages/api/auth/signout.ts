export const prerender = false
import * as adapter from '../../../adapters/betterAuthMongoAdapter'

/**
 * Sign out endpoint
 * POST /api/auth/signout
 */
import { getSessionFromRequest } from '../../../utils/auth'

export const POST = async ({ request }) => {
  try {
    const session = await getSessionFromRequest(request)
    const token = session?.session?.token || null
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No valid token provided' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    await adapter.revokeToken(token)

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
  } catch (error: unknown) {
    console.error('Sign out error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? String(error) : 'Sign out failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
