import { authenticateRequest } from './auth0-middleware'

/**
 * Protect API route by verifying Auth0 token
 * This is a compatibility wrapper for the legacy protectApi used in various endpoints.
 * 
 * @param request The incoming Request object
 * @returns An object containing success status and user data
 */
export async function protectApi(request: Request) {
    const result = await authenticateRequest(request)

    if (!result.success) {
        return {
            success: false,
            error: result.error
        }
    }

    return {
        success: true,
        userId: result.request?.user?.id,
        user: result.request?.user,
        tokenId: result.request?.tokenId
    }
}
