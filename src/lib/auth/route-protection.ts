import { authenticateRequest, AuthenticatedRequest } from "./auth0-middleware";
import {
  getRouteConfig,
  FAMILY_DEFAULTS,
  type AuthStrategy,
  type RouteFamily,
} from "./route-config";

export type RouteScope = string;

export interface RouteProtectionOptions {
  strategy: AuthStrategy;
  requiredScopes?: RouteScope[];
}

export async function protectRoute(
  request: Request,
  options?: RouteProtectionOptions,
): Promise<{
  success: boolean;
  request?: AuthenticatedRequest;
  response?: Response;
  error?: string;
}> {
  if (options) {
    return await authenticateRequest(request, {
      strategy: options.strategy,
      requiredScopes: options.requiredScopes || [],
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const routeConfig = getRouteConfig(path, method);

  if (!routeConfig) {
    const family = inferRouteFamily(path);
    const defaults = FAMILY_DEFAULTS[family];

    return await authenticateRequest(request, {
      strategy: defaults.strategy,
      requiredScopes: defaults.defaultScopes,
    });
  }

  return await authenticateRequest(request, {
    strategy: routeConfig.strategy,
    requiredScopes: routeConfig.requiredScopes || [],
  });
}

function inferRouteFamily(path: string): RouteFamily {
  if (path.startsWith("/api/health")) return "public";
  if (path.startsWith("/api/admin")) return "admin";
  if (path.startsWith("/api/developer")) return "developer";
  if (path.startsWith("/api/internal")) return "system";
  return "user";
}

export const jwtOnly = (requiredScopes?: RouteScope[]): RouteProtectionOptions => ({
  strategy: "jwtOnly",
  requiredScopes,
});

export const apiKeyOnly = (requiredScopes?: RouteScope[]): RouteProtectionOptions => ({
  strategy: "apiKeyOnly",
  requiredScopes,
});

export const eitherAuth = (requiredScopes?: RouteScope[]): RouteProtectionOptions => ({
  strategy: "either",
  requiredScopes,
});

export function createProtectedHandler(
  handler: (request: AuthenticatedRequest) => Promise<Response>,
  options: RouteProtectionOptions,
) {
  return async (request: Request): Promise<Response> => {
    const result = await protectRoute(request, options);

    if (!result.success) {
      return result.response!;
    }

    return handler(result.request!);
  };
}

export const ROUTE_FAMILIES = {
  user: {
    auth: jwtOnly(),
    profile: jwtOnly(),
    conversations: jwtOnly(),
  },
  developer: {
    inference: apiKeyOnly(["read"]),
    training: apiKeyOnly(["write"]),
    admin: apiKeyOnly(["admin"]),
  },
  public: {
    health: eitherAuth(),
    docs: eitherAuth(),
  },
  internal: {
    metrics: jwtOnly(["admin"]),
  },
} as const;

export type RouteFamilyType = keyof typeof ROUTE_FAMILIES;
