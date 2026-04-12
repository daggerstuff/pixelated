import { sequence, defineMiddleware } from 'astro:middleware'

import { authenticateRequest, type AuthStrategy, type AuthOptions } from './lib/auth/auth0-middleware'
import { corsMiddleware } from './lib/middleware/cors'
import { generateCspNonce } from './lib/middleware/csp'
import { securityHeaders } from './lib/middleware/securityHeaders'
import { tracingMiddleware } from './lib/tracing/middleware'
import { markSpanError } from './lib/tracing/utils'

interface RouteConfig extends AuthOptions {
  pattern: RegExp
}

// Route authentication configuration
// Defines which routes require authentication and what strategy/scopes to use
const routeAuthConfig: RouteConfig[] = [
  { pattern: /\/api\/v1\/(.*)/, strategy: 'either', requiredScopes: ['api:read'] },
  { pattern: /\/api\/protected(.*)/, strategy: 'jwtOnly' },
  { pattern: /\/api\/journal-research(.*)/, strategy: 'jwtOnly' }, // Protect journal-research API endpoints
  { pattern: /\/api\/agent-notes(.*)/, strategy: 'jwtOnly' }, // Protect agent note collaboration APIs
  { pattern: /\/journal-research(.*)/, strategy: 'jwtOnly' }, // Protect journal-research pages
]

function getRouteConfig(request: Request): RouteConfig | null {
  try {
    const url = new URL(request.url)
    const { pathname } = url

    // Allow public API routes (auth endpoints, health checks, etc.)
    if (pathname.startsWith('/api/auth/')) {
      return null
    }

    // Allow health check endpoints (used by smoke tests and monitoring)
    if (pathname.includes('/health') || pathname.endsWith('/health')) {
      return null
    }

    return routeAuthConfig.find((config) => config.pattern.test(pathname)) || null
  } catch (err) {
    // If URL parsing fails, be conservative and treat as not protected
    // Log the error for observability without exposing PII
    markSpanError(err instanceof Error ? err : new Error(String(err)))
    return null
  }
}

/**
 * Auth middleware that uses Auth0 or API Keys for authentication.
 * If a request targets a protected route and there's no valid session, return 401/403.
 */
const projectAuthMiddleware = defineMiddleware(async (context, next) => {
  const { request } = context
  const routeConfig = getRouteConfig(request)

  // Allow non-protected routes through quickly
  if (!routeConfig) {
    return next()
  }

  // Check authentication using the specified strategy and scopes
  try {
    const authResult = await authenticateRequest(request, {
      strategy: routeConfig.strategy,
      requiredScopes: routeConfig.requiredScopes,
    })

    if (!authResult.success) {
      // If authentication failed, return the response from Auth0 middleware
      if (authResult.response) {
        return authResult.response
      }

      // Fallback to 401 if no response provided
      return new Response(
        JSON.stringify({
          error: authResult.error || 'Authentication required',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Type assertion required: Astro's defineMiddleware doesn't infer App.Locals
    // from env.d.ts in middleware context. This is a known Astro framework limitation.
    // Our App.Locals is properly defined in env.d.ts with the 'user' property, but
    // Astro's type system doesn't merge it during middleware compilation.
    // This assertion is acceptable per AGENTS.md guidelines because:
    // 1. It's fully documented (not a blind suppression)
    // 2. It's a framework limitation, not a code issue
    // 3. The underlying types are correct in env.d.ts
    // 4. This is a common pattern in Astro projects
    if (context.locals && authResult.request?.user) {
      // Create the user object first, then assign with proper typing
      const userData = {
        ...authResult.request.user,
        emailVerified: authResult.request.user.emailVerified ?? false,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(context.locals as any).user = userData
    }
  } catch (err) {
    // If authentication check fails, treat as unauthenticated
    markSpanError(err instanceof Error ? err : new Error(String(err)))
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return next()
})

// Single, clean middleware sequence
// Tracing middleware is first to capture all requests
export const onRequest = sequence(
  tracingMiddleware as any,
  generateCspNonce as any,
  securityHeaders as any,
  corsMiddleware as any,
  projectAuthMiddleware as any,
)
