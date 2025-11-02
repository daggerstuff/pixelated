// Import necessary libraries and types
import type { APIContext } from 'astro'
import type { AuthRole } from '../../config/auth.config'
import type { AuditMetadata, AuditResource } from '../audit/types'
import type { AuthUser } from '../auth'
import { authConfig, hasRolePrivilege } from '../../config/auth.config'
import { createResourceAuditLog } from '../audit/log'
import { getCurrentUser } from '../auth'

// Define locals interface for Astro context
interface AstroLocals {
  user?: AuthUser
}

// Extend the APIContext type to properly type locals
interface APIContextWithUser extends APIContext {
  locals: AstroLocals
}

// Helper function to create resource object
function createResource(id: string, type: string): AuditResource {
  return { id, type }
}

/**
 * Middleware to ensure routes are authenticated
 */
export async function authGuard(
  context: APIContextWithUser,
): Promise<Response | undefined> {
  const user = await getCurrentUser(context.cookies)

  if (!user) {
    await createResourceAuditLog(
      'route_access_denied',
      'system',
      createResource(new URL(context.request.url).pathname, 'route'),
      {
        reason: 'missing_token',
        ipAddress:
          (context as unknown as APIContextWithUser).request?.headers?.get(
            'x-forwarded-for',
          ) ||
          (context as unknown as APIContextWithUser).request?.headers?.get(
            'x-real-ip',
          ) ||
          'unknown',
        userAgent:
          (context as unknown as APIContextWithUser).request?.headers?.get(
            'user-agent',
          ) || 'unknown',
        method: (context as unknown as APIContextWithUser).request?.method,
        path: new URL((context as unknown as APIContextWithUser).request?.url)
          .pathname,
      } as AuditMetadata,
    )

    // Redirect to login page
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${authConfig['redirects']['authRequired']}?redirect=${encodeURIComponent(
          (context as unknown as APIContextWithUser).request?.url,
        )}`,
      },
    })
  }

  // Attach user to context
  ;((context as unknown as APIContextWithUser).locals as AstroLocals).user =
    user as AuthUser

  return undefined
}

/**
 * Middleware to ensure routes are accessible only by users with specific roles
 */
export function roleGuard(role: AuthRole): void {
  return async (context: APIContext): Promise<Response | undefined> => {
    const user = await getCurrentUser(context.cookies)

    if (!user) {
      await createResourceAuditLog(
        'route_access_denied',
        'system',
        createResource(new URL(context.request.url).pathname, 'route'),
        {
          reason: 'missing_token',
          ipAddress:
            context.request.headers.get('x-forwarded-for') ||
            context.request.headers.get('x-real-ip') ||
            'unknown',
          userAgent: context.request.headers.get('user-agent') || 'unknown',
          method: context.request.method,
          path: new URL(context.request.url).pathname,
        } as AuditMetadata,
      )

      // Redirect to login page
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${authConfig['redirects']['authRequired']}?redirect=${encodeURIComponent(
            context.request.url,
          )}`,
        },
      })
    }

    // Check the user's role
    const hasRequiredRole = hasRolePrivilege(
      (user as any)['role'] as AuthRole,
      role,
    )

    if (!hasRequiredRole) {
      await createResourceAuditLog(
        'route_access_denied',
        'system',
        createResource(new URL(context.request.url).pathname, 'route'),
        {
          reason: 'insufficient_permissions',
          ipAddress:
            context.request.headers.get('x-forwarded-for') ||
            context.request.headers.get('x-real-ip') ||
            'unknown',
          userAgent: context.request.headers.get('user-agent') || 'unknown',
          method: context.request.method,
          path: new URL(context.request.url).pathname,
          requiredRole: role,
          userRole: (user as any)['role'],
        } as AuditMetadata,
      )

      // Redirect to forbidden page
      return new Response(null, {
        status: 302,
        headers: {
          Location: authConfig['redirects']['forbidden'],
        },
      })
    }

    // Attach user to context
    ;((context as unknown as APIContextWithUser).locals as AstroLocals).user =
      user as AuthUser

    return undefined
  }
}

// Define interface for API context with user
interface ApiContextWithUser extends Record<string, unknown> {
  user: AuthUser
}

/**
 * API middleware for protecting API routes
 */
export async function apiAuthGuard(
  request: Request,
  context: Record<string, unknown>,
): Promise<Response | undefined> {
  // Check for Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await createResourceAuditLog(
      'api_access_denied',
      'system',
      createResource(new URL(request.url).pathname, 'api'),
      {
        reason: 'missing_token',
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        method: request.method,
        path: new URL(request.url).pathname,
      } as AuditMetadata,
    )

    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401 },
    )
  }

  // Extract token and verify
  const token = authHeader.split(' ')[1]
  const { data, error } = await fetch(
    `${authConfig.redirects.authRequired}/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    },
  ).then((rest) => rest.json())

  if (error || !data?.['user']) {
    await createResourceAuditLog(
      'api_access_denied',
      'system',
      createResource(new URL(request.url).pathname, 'api'),
      {
        reason: 'invalid_token',
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        method: request.method,
        path: new URL(request.url).pathname,
      } as AuditMetadata,
    )

    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
    })
  }

  // Set the user data in context
  ;(context as Record<string, unknown>).user = data?.['user'] as AuthUser

  // Log the successful authentication
  await createResourceAuditLog(
    'api_authenticated',
    data?.['user']?.['id'],
    createResource(new URL(request.url).pathname, 'api'),
    {
      method: request.method,
      path: new URL(request.url).pathname,
    } as AuditMetadata,
  )

  return undefined
}

/**
 * API middleware for protecting routes by role
 */
export function apiRoleGuard(role: AuthRole): void {
  return async (
    request: Request,
    context: Record<string, unknown>,
  ): Promise<Response | undefined> => {
    // First ensure the user is authenticated
    const authResponse = await apiAuthGuard(request, context)
    if (authResponse) {
      return authResponse
    }

    // At this point we know context.user exists
    const apiContext = context as ApiContextWithUser
    // access via bracket form because user comes from an index-signature context
    const user = (apiContext as any)['user'] as AuthUser

    // Check if the user has the required role
    if (!hasRolePrivilege(user?.['role'], role)) {
      await createResourceAuditLog(
        'api_access_denied',
        user.id,
        createResource(new URL(request.url).pathname, 'api'),
        {
          reason: 'insufficient_permissions',
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          method: request.method,
          path: new URL(request.url).pathname,
          requiredRole: role,
          userRole: user?.['role'],
        } as AuditMetadata,
      )

      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403 },
      )
    }

    return undefined
  }
}
