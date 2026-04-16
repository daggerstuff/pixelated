/**
 * Authentication middleware for protecting routes.
 * Supports both JWT (for users) and API keys (for developers).
 */

import { getSession, isSessionValid } from "@/lib/auth/session";
import type { Session } from "@/lib/auth/session";

/**
 * API key session shape for developer authentication
 */
export interface ApiKeySession {
  user: {
    id: string;
    role: "developer" | "admin";
    name?: string;
    email?: string;
  };
  /** ISO-8601 timestamp when the session expires */
  expires: string;
  /** Indicates this is an API key session */
  authType: "api-key";
}

/**
 * Union type for all possible session types
 */
export type ValidSession = Session | ApiKeySession;

/**
 * Extended handler type that receives the validated Session alongside the
 * Request so inner handlers do not need a redundant token round-trip.
 */
export type AuthenticatedHandler = (request: Request, session: ValidSession) => Promise<Response>;

/**
 * API key session shape for developer authentication
 */
export interface ApiKeySession {
  user: {
    id: string;
    role: "developer" | "admin";
    name?: string;
    email?: string;
  };
  /** ISO-8601 timestamp when the session expires */
  expires: string;
  /** Indicates this is an API key session */
  authType: "api-key";
}

/**
 * Union type for all possible session types
 */
export type ValidSession = Session | ApiKeySession;

/**
 * Wrap an Astro / fetch-API handler with authentication enforcement.
 * Supports both JWT (user) and API key (developer) authentication.
 *
 * The resolved Session is passed as a second argument to the inner handler
 * so callers never need to call getSession() again.
 *
 * Usage in Astro API routes:
 *   export const GET = withAuth(async (request, session) => { ... })
 *
 * @param handler  The inner handler to call when auth passes
 * @param options  Optional configuration
 * @returns        A standard (Request) => Promise<Response> handler
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options?: {
    /** Pathname prefixes that bypass auth (e.g. '/api/health') */
    allowPaths?: string[];
    /** Accept API key authentication in addition to JWT */
    allowApiKey?: boolean;
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
      const apiKeySession = await validateApiKey(request);
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
 * Validate API key from request headers
 * @param request The incoming request
 * @returns ApiKeySession if valid, null otherwise
 */
async function validateApiKey(request: Request): Promise<ApiKeySession | null> {
  // Extract API key from X-API-Key header
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return null;
  }

  // Validate against environment variable or secure storage
  // For now, we'll check against a predefined key in development
  // In production, this should be validated against a secure store/database
  const validApiKeys = [process.env.DEV_API_KEY, process.env.API_KEY].filter(
    (key): key is string => key !== undefined && key !== "",
  );

  if (!validApiKeys.includes(apiKey)) {
    return null;
  }

  // For demonstration, we'll decode basic info from the API key
  // In a real implementation, this would lookup the developer profile
  const developerInfo = await getDeveloperInfoFromApiKey(apiKey);

  if (!developerInfo) {
    return null;
  }

  return {
    user: {
      id: developerInfo.id,
      role: developerInfo.role,
      name: developerInfo.name,
      email: developerInfo.email,
    },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // API keys typically have longer expiry
    authType: "api-key",
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
