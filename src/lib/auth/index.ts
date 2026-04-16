/**
 * Authentication Module - Main export for Phase 7 JWT Authentication Service
 * Provides complete authentication system with Auth0 integration
 */

import type { AstroCookies } from "astro";

import { authConfig } from "../../config/auth.config";
import { getUserById as getAuth0UserById } from "../../services/auth0.service";
import { validateToken } from "./auth0-jwt-service";
import { extractTokenFromRequest } from "./auth0-middleware";
import { getSession } from "./session";

export type { SessionData } from "./session";
// Re-export session for compatibility
export { getSession } from "./session";

// Re-export User type for compatibility
export type { User, AuthUser } from "./types";

/**
 * Get the current user from the request or cookies
 * Supports both JWT (users) and API keys (developers)
 */
export async function getCurrentUser(
  context: Request | AstroCookies,
): Promise<{ id: string; role: string } | null> {
  let token: string | null = null;
  let isApiKey = false;

  if ("headers" in context) {
    // It's a Request object
    const request = context as Request;

    // Check for API key first (X-API-Key header)
    const apiKey = request.headers.get("X-API-Key");
    if (apiKey) {
      isApiKey = true;
      // Validate API key and return developer user
      const developerUser = await validateApiKeyAndGetUser(apiKey);
      if (developerUser) {
        return developerUser;
      }
      // If API key invalid, fall through to check JWT
    }

    // Fallback to JWT token extraction
    token = extractTokenFromRequest(request);
  } else {
    // It's AstroCookies
    // Check for Auth0 token first, then fallback to configured name
    token =
      (context as AstroCookies).get(authConfig.cookies.accessToken)?.value ||
      (context as AstroCookies).get("auth_token")?.value ||
      null;
  }

  if (!token && !isApiKey) {
    return null;
  }

  // If we had an API key but it was invalid, we already returned null above
  // If we have a JWT token, validate it
  if (token) {
    try {
      const result = await validateToken(token, "access");
      if (result.valid && result.userId) {
        return { id: result.userId, role: result.role || "guest" };
      }
    } catch {
      // Token validation failed
    }
  }

  return null;
}

/**
 * Check if the current user has the specified role
 */
export async function hasRole(context: AstroCookies | Request, role: string): Promise<boolean> {
  const user = await getCurrentUser(context);
  if (!user) {
    return false;
  }
  return user.role === role;
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(context: AstroCookies | Request): Promise<boolean> {
  const user = await getCurrentUser(context);
  return !!user;
}

/**
 * Legacy compatibility: requirePageAuth
 */
export async function requirePageAuth(
  context: { request: Request },
  role?: string,
): Promise<Response | null> {
  const user = await getCurrentUser(context.request);

  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
  }

  if (role && user.role !== role) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/access-denied" },
    });
  }

  return null;
}

export type {
  ClientInfo,
  TokenPair,
  TokenType,
  TokenValidationResult,
  UserRole,
} from "./auth0-jwt-service";

// Export server-side auth functionality
export {
  AuthenticationError,
  cleanupExpiredTokens,
  generateTokenPair,
  measureTokenOperation,
  refreshAccessToken,
  revokeToken,
  validateToken,
} from "./auth0-jwt-service";
// Export authentication types and middleware
export * from "./types";

// Auth0/Legacy Bridge exports removed

// Middleware exports
export {
  authenticateRequest,
  csrfProtection,
  extractTokenFromRequest,
  getClientInfo,
  getClientIp,
  requireRole,
  securityHeaders,
} from "./auth0-middleware";

/**
 * Initialize authentication system
 */
export async function initializeAuthSystem(): Promise<void> {
  try {
    // Start token cleanup scheduler
    const { startTokenCleanupScheduler } = await import("./auth0-jwt-service");
    startTokenCleanupScheduler();

    console.log("✅ Authentication system initialized successfully (Auth0-native)");
  } catch (error: unknown) {
    console.error("❌ Failed to initialize authentication system:", error);
    throw error;
  }
}

export async function getUserById(
  userId: string,
): Promise<{ id: string; email?: string; name?: string } | null> {
  if (import.meta.env?.MODE === "test" || process.env.NODE_ENV === "test") {
    return {
      id: userId,
      email: `${userId}@example.com`,
      name: `User ${userId}`,
    };
  }

  try {
    const user = await getAuth0UserById(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
    };
  } catch (error: unknown) {
    console.error("Failed to look up Auth0 user:", error);
    return null;
  }
}

/**
 * Validate API key and return developer user information
 * @param apiKey The API key to validate
 * @returns User information if valid API key, null otherwise
 */
async function validateApiKeyAndGetUser(
  apiKey: string,
): Promise<{ id: string; role: string } | null> {
  // Validate against environment variable or secure storage
  const validApiKeys = [process.env.DEV_API_KEY, process.env.API_KEY].filter(
    (key): key is string => key !== undefined && key !== "",
  );

  if (!validApiKeys.includes(apiKey)) {
    return null;
  }

  // Get developer information from API key
  const developerInfo = await getDeveloperInfoFromApiKey(apiKey);

  if (!developerInfo) {
    return null;
  }

  return {
    id: developerInfo.id,
    role: developerInfo.role,
  };
}

/**
 * Get developer information from API key
 * In production, this would query a database or secure store
 * @param apiKey The API key to lookup
 * @returns Developer information if found
 */
async function getDeveloperInfoFromApiKey(apiKey: string): Promise<{
  id: string;
  role: "developer" | "admin";
  name?: string;
  email?: string;
} | null> {
  // This is a simplified implementation
  // In reality, you'd query a developer/apikey table in your database

  // For now, we'll simulate based on the API key format
  if (apiKey.startsWith("dev_")) {
    return {
      id: "dev_" + apiKey.substring(4, 12), // Simplified ID generation
      role: "developer",
      name: "Developer",
      email: "developer@pixelatedempathy.com",
    };
  }

  if (apiKey.startsWith("admin_")) {
    return {
      id: "admin_" + apiKey.substring(6, 14), // Simplified ID generation
      role: "admin",
      name: "Administrator",
      email: "admin@pixelatedempathy.com",
    };
  }

  // Fallback for testing
  if (apiKey === "test-dev-key-123") {
    return {
      id: "dev_001",
      role: "developer",
      name: "Test Developer",
      email: "test@pixelatedempathy.com",
    };
  }

  return null;
}

export const auth = {
  getCurrentUser,
  isAuthenticated,
  hasRole,
  getUserById,
};

export const requireAuth = requirePageAuth;
