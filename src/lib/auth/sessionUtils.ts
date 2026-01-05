import { getSessionFromRequest } from '../../utils/auth';

/**
 * Legacy utility to get user from request.
 * Bridged to new Auth0 implementation.
 */
export async function getUser(request: Request) {
    const session = await getSessionFromRequest(request);
    return session?.user || null;
}
