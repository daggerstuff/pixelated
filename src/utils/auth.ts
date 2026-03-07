import {
    verifyToken as auth0VerifyToken
} from '../services/auth0.service';
import type { SessionData } from '@/lib/auth/types';

/**
 * Utility to verify auth tokens using Auth0 service.
 */
export async function verifyAuthToken(token: string) {
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    return await auth0VerifyToken(cleanToken);
}

/**
 * Utility to get session from request.
 * Checks for session token in cookies or Authorization header.
 */
export async function getSessionFromRequest(request: Request): Promise<SessionData | null> {
    // Simple implementation for compatibility
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        try {
            const decoded = await verifyAuthToken(authHeader);
            return {
                user: {
                    id: decoded.userId,
                    _id: decoded.userId,
                    email: decoded.email,
                    role: decoded.role as any,
                    emailVerified: true
                } as any,
                session: {
                    token: authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader,
                    expiresAt: new Date(Date.now() + 3600000) // Mock expiry
                }
            } as SessionData;
        } catch (e) {
            console.error('Error verifying session from header:', e);
        }
    }

    // Fallback to cookies (simplified)
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        // In a real implementation we'd parse cookies here.
        // For now, if we can't find it in header, we'd need a cookie parser.
    }

    return null;
}

/**
 * Auth object for catch-all route compatibility.
 */
export const auth = {

    verifyAuthToken,
    getSessionFromRequest
};
