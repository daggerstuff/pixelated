import type { APIContext } from 'astro'
import { verifyAuthToken } from '@/utils/auth'

/**
 * Handles GET requests for the admin audit logs endpoint.
 * Verifies admin authentication and returns a success response if authorized.
 *
 * Args:
 *   context: The APIContext object containing request information.
 *
 * Returns:
 *   A Response object indicating whether the user is authorized.
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // Extract authorization token from request
    const authHeader = context.request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify the auth token
    const authInfo = await verifyAuthToken(authHeader)

    // Check if user has admin role
    if (authInfo.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Auth passed, return success response
    return new Response(
      JSON.stringify({ success: true, authorized: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Authentication error in audit-logs.api.ts:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication failed' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}