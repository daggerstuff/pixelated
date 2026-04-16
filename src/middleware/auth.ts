/**
 * Authentication middleware for protecting routes.
 * Supports both JWT (for users) and API keys (for developers).
 *
 * IMPORTANT: API key validation uses DeveloperApiKeyManager which performs
 * proper database lookups with SHA-256 hash verification. Never use
 * environment variable validation or prefix-based pseudo-authentication.
 */

import { getSession, isSessionValid } from "@/lib/auth/session";
import type { Session } from "@/lib/auth/session";
import { developerApiKeyManager } from "@/lib/db/developer-api-keys";

export interface ApiKeySession {
  user: {
    id: string;
    role: "developer" | "admin";
    name?: string;
    email?: string;
  };
  expires: string;
  authType: "api-key";
  scopes: string[];
}

export type ValidSession = Session | ApiKeySession;

export type AuthenticatedHandler = (request: Request, session: ValidSession) => Promise<Response>;

export function withAuth(
  handler: AuthenticatedHandler,
  options?: {
    /** Pathname prefixes that bypass auth (e.g. '/api/health') */
    allowPaths?: string[];
    /** Accept API key authentication in addition to JWT */
    allowApiKey?: boolean;
    /** Required scopes for API key access */
    requiredScopes?: string[];
  },
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    // Allow unauthenticated access to explicitly whitelisted paths
    if (options?.allowPaths?.length) {
      const url = new URL(request.url);
      if (options.allowPaths.some((p) => url.pathname.startsWith(p))) {
        // Unauthenticated passthrough — create a minimal guest session
        const guestSession: Session = {
          user: { id: "guest", role: "guest" },
          // Future expiration ensures validity throughout the request lifecycle
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        return handler(request, guestSession);
      }
    }

    // Try JWT authentication first (existing behavior)
    let session = await getSession(request);
    let isValidSession = session && isSessionValid(session);

    // If JWT fails and API key is allowed, try API key authentication
    if (!isValidSession && options?.allowApiKey) {
      const apiKeySession = await validateApiKey(request, options.requiredScopes);
      if (apiKeySession) {
        session = apiKeySession;
        isValidSession = true;
      }
    }

    if (!session || !isValidSession) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pass validated session to the handler — no second token round-trip needed
    return handler(request, session);
  };
}

/**
 * Validate API key from request headers using proper database validation.
 *
 * SECURITY: This function performs actual database lookup with SHA-256 hash
 * verification. Do NOT replace with environment variable checks or prefix-based
 * pseudo-authentication.
 *
 * @param request The incoming request
 * @param requiredScopes Optional scopes that must be present on the key
 * @returns ApiKeySession if valid, null otherwise
 */
async function validateApiKey(
  request: Request,
  requiredScopes?: string[],
): Promise<ApiKeySession | null> {
  // Extract API key from X-API-Key header
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return null;
  }

  // Use DeveloperApiKeyManager for proper database-backed validation
  // This performs SHA-256 hash lookup against stored keys
  const validation = await developerApiKeyManager.validateApiKey(apiKey);

  if (!validation.valid || !validation.api_key) {
    return null;
  }

  const keyRecord = validation.api_key;

  // Check required scopes if specified
  if (requiredScopes && requiredScopes.length > 0) {
    const keyScopes = keyRecord.scopes || [];
    const hasAllScopes = requiredScopes.every((scope) => keyScopes.includes(scope));
    if (!hasAllScopes) {
      return null;
    }
  }

  // Return properly constructed session from database record
  return {
    user: {
      id: keyRecord.user_id,
      role: keyRecord.scopes.includes("admin") ? "admin" : "developer",
    },
    expires:
      keyRecord.expires_at?.toISOString() ||
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    authType: "api-key",
    scopes: keyRecord.scopes,
  };
}
