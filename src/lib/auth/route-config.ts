export type AuthStrategy = "jwtOnly" | "apiKeyOnly" | "either";

export type RouteFamily = "public" | "user" | "developer" | "admin" | "system";

export interface ScopeDefinition {
  name: string;
  description: string;
  routes: string[];
}

export interface RouteConfig {
  path: string;
  strategy: AuthStrategy;
  family: RouteFamily;
  requiredScopes?: string[];
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export const SCOPES: Record<string, ScopeDefinition> = {
  read: {
    name: "read",
    description: "Read access to resources",
    routes: ["GET /api/v1/*", "GET /api/developer/*"],
  },
  write: {
    name: "write",
    description: "Write access to resources",
    routes: ["POST /api/v1/*", "PUT /api/v1/*", "PATCH /api/v1/*"],
  },
  admin: {
    name: "admin",
    description: "Administrative access",
    routes: ["* /api/admin/*"],
  },
  "memory:read": {
    name: "memory:read",
    description: "Read access to memory endpoints",
    routes: ["GET /api/memory/*"],
  },
  "memory:write": {
    name: "memory:write",
    description: "Write access to memory endpoints",
    routes: ["POST /api/memory/*", "PUT /api/memory/*", "DELETE /api/memory/*"],
  },
  "developer:manage": {
    name: "developer:manage",
    description: "Manage developer API keys",
    routes: ["* /api/developer/api-keys/*"],
  },
  "analytics:read": {
    name: "analytics:read",
    description: "Read access to analytics",
    routes: ["GET /api/analytics/*", "GET /api/v1/analytics/*"],
  },
};

export const ROUTE_CONFIGS: RouteConfig[] = [
  // Public routes - no auth required
  { path: "/api/health", strategy: "either", family: "public" },
  { path: "/api/v1/health", strategy: "either", family: "public" },

  // User routes - JWT only (sessions, profile)
  { path: "/api/session/*", strategy: "jwtOnly", family: "user" },
  { path: "/api/v1/profile", strategy: "jwtOnly", family: "user" },
  { path: "/api/v1/preferences", strategy: "jwtOnly", family: "user" },

  // Memory routes - either JWT or API key
  {
    path: "/api/memory/*",
    strategy: "either",
    family: "user",
    requiredScopes: ["memory:read"],
  },

  // Developer routes - API key preferred, JWT also allowed
  {
    path: "/api/developer/api-keys",
    strategy: "either",
    family: "developer",
    requiredScopes: ["developer:manage"],
  },
  {
    path: "/api/developer/api-keys/*",
    strategy: "either",
    family: "developer",
    requiredScopes: ["developer:manage"],
  },

  // Analytics routes - API key for external integrations
  {
    path: "/api/v1/analytics/*",
    strategy: "either",
    family: "developer",
    requiredScopes: ["analytics:read"],
  },

  // Admin routes - JWT with admin role only
  {
    path: "/api/admin/*",
    strategy: "jwtOnly",
    family: "admin",
    requiredScopes: ["admin"],
  },
  {
    path: "/api/v1/admin/*",
    strategy: "jwtOnly",
    family: "admin",
    requiredScopes: ["admin"],
  },

  // System routes - API key only (for internal services)
  { path: "/api/internal/*", strategy: "apiKeyOnly", family: "system" },
];

export function getRouteConfig(path: string, method: string): RouteConfig | null {
  for (const config of ROUTE_CONFIGS) {
    if (matchRoute(config.path, path, method)) {
      return config;
    }
  }
  return null;
}

function matchRoute(pattern: string, path: string, _method: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === "*") {
      return true;
    }
    if (patternParts[i] !== pathParts[i] && !patternParts[i].includes("*")) {
      return false;
    }
  }

  return patternParts.length === pathParts.length;
}

export const FAMILY_DEFAULTS: Record<
  RouteFamily,
  { strategy: AuthStrategy; defaultScopes: string[] }
> = {
  public: { strategy: "either", defaultScopes: [] },
  user: { strategy: "jwtOnly", defaultScopes: ["read"] },
  developer: { strategy: "either", defaultScopes: ["read", "write"] },
  admin: { strategy: "jwtOnly", defaultScopes: ["admin"] },
  system: { strategy: "apiKeyOnly", defaultScopes: ["read", "write", "admin"] },
};
