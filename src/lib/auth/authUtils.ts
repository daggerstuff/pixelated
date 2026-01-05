import { auth0UserService } from '../../services/auth0.service';

/**
 * Legacy utility for authentication checks.
 * Bridged to new Auth0 implementation.
 */

export async function isAuthenticated(cookies?: any) {
    // If cookies provided, we can check. If not, we'd need Request.
    // Legacy code called this without args in some places.
    if (!cookies) return false;

    try {
        // Very basic implementation for bridge
        const token = cookies.get?.('auth_token')?.value;
        if (!token) return false;
        const user = await auth0UserService.verifyAuthToken(token);
        return !!user;
    } catch {
        return false;
    }
}

export async function hasAdminRole(user: any) {
    if (!user) return false;
    // Auth0 service roles might be in different formats
    return user.role === 'admin' || user.appMetadata?.roles?.includes('Admin');
}
