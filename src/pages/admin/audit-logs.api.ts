import type { BaseAPIContext } from '../../lib/auth/apiRouteTypes';
import { requirePageAuth } from '../../lib/auth';

/**
 * Handles GET requests for the admin audit logs endpoint.
 * Verifies admin authentication and returns a success response if authorized.
 *
 * Args:
 *   context: The BaseAPIContext object containing request information.
 *
 * Returns:
 *   A Response object indicating whether the user is authorized.
 */
export async function GET(context: BaseAPIContext) {
  const authResult = await requirePageAuth(context, 'admin');
  if (authResult) {
    return authResult;
  }
  
  // Auth passed, return success response
  return new Response(JSON.stringify({ success: true, authorized: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
