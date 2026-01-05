import { authenticateRequest, requireRole } from './auth0-middleware';
import type {
    ProtectRouteOptions,
    ProtectedAPIRoute,
    BaseAPIContext,
    AuthAPIContext
} from './apiRouteTypes';

/**
 * Implementation of protectRoute higher-order function.
 * Wraps an API route handler with authentication and authorization checks.
 */
export function protectRoute(options: ProtectRouteOptions = {}) {
    return (handler: ProtectedAPIRoute) => {
        return async (context: BaseAPIContext) => {
            // 1. Authenticate request
            const authResult = await authenticateRequest(context.request);

            if (!authResult.success || !authResult.request) {
                return authResult.response || new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 2. Check role if required
            if (options.requiredRole) {
                const roleResult = await requireRole(authResult.request, [options.requiredRole]);
                if (!roleResult.success) {
                    return roleResult.response || new Response(JSON.stringify({ error: 'Forbidden' }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            // 3. Attach user to locals for the handler and convert context
            const authContext: AuthAPIContext = {
                ...context,
                locals: {
                    ...context.locals,
                    user: authResult.request.user as any
                }
            } as any;

            return handler(authContext);
        };
    };
}

/**
 * Middleware for requiring authentication on Astro pages (SSR).
 */
export async function requirePageAuth(context: { request: Request }, role?: string) {
    const authResult = await authenticateRequest(context.request);
    if (!authResult.success) {
        // Redirection should ideally happen in the caller or via a specific Response
        return new Response(null, {
            status: 302,
            headers: { Location: '/login' }
        });
    }
    if (role && authResult.request?.user?.role !== role) {
        return new Response(null, {
            status: 302,
            headers: { Location: '/forbidden' }
        });
    }
    return null;
}
