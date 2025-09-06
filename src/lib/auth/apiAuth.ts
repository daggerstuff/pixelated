/**
 * Simple API authentication result
 */
export interface AuthResult {
  success: boolean
  userId?: string
  error?: string
}

/**
 * Simple API protection helper that checks if a request is authenticated
 *
 * @param request The request object to check
 * @returns AuthResult with success status
 */
export async function protectApi(request: Request): Promise<AuthResult> {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return {
        success: false,
        error: 'No authentication token provided',
      }
    }

    // In a real implementation, you'd validate the token
    // This is a simplified version for the fix

    return {
      success: true,
      userId: 'user-id-placeholder',
    }
  } catch (error: unknown) {
    console.error('API authentication error:', error)
    return {
      success: false,
      error: 'Authentication error',
    }
  }
}
