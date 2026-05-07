import { LRUCache } from './lru-cache'

export type AuthStrategy = 'jwtOnly' | 'apiKeyOnly' | 'either'

export type RouteFamily = 'public' | 'user' | 'developer' | 'admin' | 'system'

export interface ScopeDefinition {
  name: string
  description: string
  routes: string[]
}

export interface RouteConfig {
  path: string
  strategy: AuthStrategy
  family: RouteFamily
  requiredScopes?: string[]
  rateLimit?: {
    requests: number
    windowMs: number
  }
}

export const SCOPES: Record<string, ScopeDefinition> = {
  read: {
    name: 'read',
    description: 'Read access to resources',
    routes: ['GET /api/v1/*', 'GET /api/developer/*'],
  },
  write: {
    name: 'write',
    description: 'Write access to resources',
    routes: ['POST /api/v1/*', 'PUT /api/v1/*', 'PATCH /api/v1/*'],
  },
  admin: {
    name: 'admin',
    description: 'Administrative access',
    routes: ['* /api/admin/*'],
  },
  'memory:read': {
    name: 'memory:read',
    description: 'Read access to memory endpoints',
    routes: ['GET /api/memory/*'],
  },
  'memory:write': {
    name: 'memory:write',
    description: 'Write access to memory endpoints',
    routes: ['POST /api/memory/*', 'PUT /api/memory/*', 'DELETE /api/memory/*'],
  },
  'developer:manage': {
    name: 'developer:manage',
    description: 'Manage developer API keys',
    routes: ['* /api/developer/api-keys/*'],
  },
  'analytics:read': {
    name: 'analytics:read',
    description: 'Read access to analytics',
    routes: ['GET /api/analytics/*', 'GET /api/v1/analytics/*'],
  },
}

export const ROUTE_CONFIGS: RouteConfig[] = [
  { path: '/api/health', strategy: 'either', family: 'public' },
  { path: '/api/v1/health', strategy: 'either', family: 'public' },
  { path: '/api/session/*', strategy: 'jwtOnly', family: 'user' },
  { path: '/api/v1/profile', strategy: 'jwtOnly', family: 'user' },
  { path: '/api/v1/preferences', strategy: 'jwtOnly', family: 'user' },
  {
    path: '/api/memory/*',
    strategy: 'either',
    family: 'user',
    requiredScopes: ['memory:read'],
  },
  {
    path: '/api/developer/api-keys',
    strategy: 'either',
    family: 'developer',
    requiredScopes: ['developer:manage'],
  },
  {
    path: '/api/developer/api-keys/*',
    strategy: 'either',
    family: 'developer',
    requiredScopes: ['developer:manage'],
  },
  {
    path: '/api/v1/analytics/*',
    strategy: 'either',
    family: 'developer',
    requiredScopes: ['analytics:read'],
  },
  {
    path: '/api/admin/*',
    strategy: 'jwtOnly',
    family: 'admin',
    requiredScopes: ['admin'],
  },
  {
    path: '/api/v1/admin/*',
    strategy: 'jwtOnly',
    family: 'admin',
    requiredScopes: ['admin'],
  },
  { path: '/api/internal/*', strategy: 'apiKeyOnly', family: 'system' },
]

const MAX_ROUTE_CACHE_SIZE = 500

const routeCache = new LRUCache<string, RouteConfig>(MAX_ROUTE_CACHE_SIZE)

function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return '/' + parts.join('/')
}

function matchRoute(
  pattern: string,
  path: string,
): { matched: boolean; isWildcard: boolean } {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  const isTerminalWildcard =
    patternParts[patternParts.length - 1] === '*' && patternParts.length === 1
  if (isTerminalWildcard) {
    return { matched: true, isWildcard: true }
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]

    if (patternPart === '*') {
      if (i === patternParts.length - 1) {
        return {
          matched: pathParts.length === patternParts.length,
          isWildcard: true,
        }
      }
      continue
    }

    if (i >= pathParts.length) {
      return { matched: false, isWildcard: false }
    }

    if (patternPart !== pathParts[i]) {
      return { matched: false, isWildcard: false }
    }
  }

  return {
    matched: patternParts.length === pathParts.length,
    isWildcard: false,
  }
}

export function getRouteConfig(
  path: string,
  _method: string,
): RouteConfig | null {
  const cached = routeCache.get(path)
  if (cached) {
    return cached
  }

  const normalizedPath = normalizePath(path)

  for (const config of ROUTE_CONFIGS) {
    const { matched } = matchRoute(config.path, normalizedPath)
    if (matched) {
      routeCache.set(path, config)
      return config
    }
  }

  return null
}

export const FAMILY_DEFAULTS: Record<
  RouteFamily,
  { strategy: AuthStrategy; defaultScopes: string[] }
> = {
  public: { strategy: 'either', defaultScopes: [] },
  user: { strategy: 'jwtOnly', defaultScopes: ['read'] },
  developer: { strategy: 'either', defaultScopes: ['read', 'write'] },
  admin: { strategy: 'jwtOnly', defaultScopes: ['admin'] },
  system: { strategy: 'apiKeyOnly', defaultScopes: ['read', 'write', 'admin'] },
}
