/**
 * Session management utilities for authentication system
 * Handles session verification, user info retrieval, and token management
 */

import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";
import { userManager } from "../db";

/**
 * Get session data from JWT token (placeholder implementation)
 * @param token JWT token from auth()
 * @returns Session object or null
 */
export async function getSessionFromToken(token: JWT): Promise<Session | null> {
  if (!token?.accessToken) return null;

  // In a real app, you might verify the token with your auth provider
  // This is a placeholder implementation
  return {
    user: {
      id: token.sub as string,
      email: token.email as string,
      role: token.role as string,
      name: token.name as string,
    },
    expires: token.exp as string,
  };
}

/**
 * Verify session is valid and not expired
 * @param session Session object
 * @returns boolean indicating if session is valid
 */
export function isSessionValid(session: Session): boolean {
  if (!session?.expires) return false;

  // Convert expires string to Date for comparison
  const expiresDate = new Date(session.expires as string);
  const now = new Date();

  // In production, you might want to check closer to expiry
  return now.getTime() < expiresDate.getTime() - 5 * 60 * 1000; // 5 minutes before expiry
}

/**
 * Get user profile from database using user ID
 * @param userId User ID from session
 * @returns User profile or null
 */
export async function getUserProfile(userId: string) {
  try {
    const user = await userManager.getUserById(userId);

    if (!user) {
      console.error("User not found:", userId);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: `${user.first_name} ${user.last_name}`,
      avatarUrl: user.avatar_url,
      role: user.role,
    };
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    return null;
  }
}

/**
 * Update session with refreshed token
 * @param refreshToken New refresh token
 * @returns Updated session data
 */
export async function refreshSession(_refreshToken: string): Promise<Session> {
  // In real implementation, verify refresh token and issue new access token
  // This is a placeholder implementation

  return {
    user: {
      id: "placeholder-id",
      email: "placeholder@example.com",
      role: "user",
      name: "User",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };
}

/**
 * Get user role for permission checks
 * @param session Session object
 * @returns User role string or null
 */
export function getUserRole(session: Session): string | null {
  return session?.user?.role ?? null;
}

/**
 * Check if user has a specific permission/role
 * @param session Session object
 * @param requiredRole Role that's required
 * @returns boolean indicating if user has required role
 */
export function hasRole(session: Session, requiredRole: string): boolean {
  const userRole = getUserRole(session);
  return userRole === requiredRole;
}

/**
 * Get session (placeholder implementation)
 * @returns Session object or null
 */
export async function getSession(): Promise<Session | null> {
  // This is a placeholder implementation
  // In a real app, you would get the session from the request context
  return null;
}
