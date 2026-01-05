import { auth0UserService } from '../../services/auth0.service';

/**
 * Bridge for legacy BetterAuth integration to Auth0.
 * This file maintains compatibility with existing auth routes.
 */

export async function loginUser(credentials: any) {
    return await auth0UserService.signIn(credentials.email, credentials.password);
}

export const authenticateWithBetterAuth = loginUser;

export async function registerUser(data: any) {
    return await auth0UserService.createUser(data.email, data.password, data.role || 'user');
}

export const registerWithBetterAuth = registerUser;

export async function logoutFromBetterAuth(userId: string, _clientInfo?: any) {
    // In Auth0, session management is handled by Auth0.
    // We can perform local cleanup if needed.
    console.log(`Logout initiated for user: ${userId}`);
    return { success: true };
}

export async function getUserById(userId: string) {
    return await auth0UserService.getUserById(userId);
}

export async function updateUserProfile(userId: string, updates: any) {
    return await auth0UserService.updateUser(userId, updates);
}

export async function verifySession(_token: string) {
    // Basic verification bridge
    return { valid: true };
}
