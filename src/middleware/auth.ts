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
  rateLimit?: {
    remaining: number;
    limit: number;
  };
}

export type ValidSession = Session | ApiKeySession;

export type AuthenticatedHandler = (request: Request, session: ValidSession) => Promise<Response>;

interface WithAuthOptions {
  allowPaths?: string[];
  allowApiKey?: boolean;
  requiredScopes?: string[];
}

function setRateLimitHeaders(response: Response, remaining: number, limit: number): Response {
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Remaining", remaining.toString());
  headers.set("X-RateLimit-Limit", limit.toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withAuth(
  handler: AuthenticatedHandler,
  options?: WithAuthOptions,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (options?.allowPaths?.length) {
      const url = new URL(request.url);
      if (options.allowPaths.some((p) => url.pathname.startsWith(p))) {
        const guestSession: Session = {
          user: { id: "guest", role: "guest" },
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        return handler(request, guestSession);
      }
    }

    let session = await getSession(request);
    let isValidSession = session && isSessionValid(session);

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

    const response = await handler(request, session);

    if (isApiKeySession(session) && session.rateLimit) {
      return setRateLimitHeaders(response, session.rateLimit.remaining, session.rateLimit.limit);
    }

    return response;
  };
}

function isApiKeySession(session: ValidSession): session is ApiKeySession {
  return "authType" in session && session.authType === "api-key";
}

async function validateApiKey(
  request: Request,
  requiredScopes?: string[],
): Promise<ApiKeySession | null> {
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return null;
  }

  const validation = await developerApiKeyManager.validateApiKey(apiKey);

  if (!validation.valid || !validation.api_key) {
    return null;
  }

  const keyRecord = validation.api_key;

  if (requiredScopes?.length) {
    const keyScopes = keyRecord.scopes || [];
    if (!requiredScopes.every((scope) => keyScopes.includes(scope))) {
      return null;
    }
  }

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
    rateLimit:
      validation.remainingRequests !== undefined
        ? {
            remaining: validation.remainingRequests,
            limit: keyRecord.rate_limit,
          }
        : undefined,
  };
}
