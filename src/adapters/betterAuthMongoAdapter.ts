import {
    createUser as auth0CreateUser,
    signIn as auth0SignIn,
    revokeToken as auth0RevokeToken,
    getUserById as auth0GetUserById,
    updateUser as auth0UpdateUser
} from '../services/auth0.service';

/**
 * Adapter to bridge legacy BetterAuth/Mongo calls to Auth0 Service.
 * This ensures backward compatibility during migration.
 */

export async function createUser(data: { email: string; password: string; role?: string }) {
    const user = await auth0CreateUser({
        email: data.email,
        password: data.password,
        role: data.role
    });
    return {
        ...user,
        _id: user.id // Compatibility with legacy code expecting _id
    };
}

export async function signIn(email: string, password: string) {
    const result = await auth0SignIn(email, password);
    return {
        user: {
            ...result.user,
            _id: result.user.id // Compatibility
        },
        token: result.token,
        refreshToken: result.refreshToken
    };
}

export async function revokeToken(token: string) {
    // Note: Auth0 revokeToken expects a refresh token.
    // Legacy code might pass an access token or session id.
    // We'll try to revoke it via the service.
    return await auth0RevokeToken(token);
}

export async function getUserById(userId: string) {
    const user = await auth0GetUserById(userId);
    if (!user) return null;
    return {
        ...user,
        _id: user.id
    };
}

export async function updateUser(userId: string, updates: Record<string, unknown>) {
    const user = await auth0UpdateUser(userId, updates);
    if (!user) return null;
    return {
        ...user,
        _id: user.id
    };
}
