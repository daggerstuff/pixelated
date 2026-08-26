import type { AuthRole } from '../../config/auth.config.ts'
import type { AuthUser } from './types.js'

/**
 * ASTRO 5.x TYPE INHERITANCE BUG WORKAROUND
 * =========================================
 *
 * This file works around a bug in Astro 5.x where APIContext extends AstroSharedContext
 * with mismatched generic parameters, breaking the inheritance chain and causing
 * TypeScript to not see the 'request' property.
 *
 * Bug details:
 * - APIContext<Props, APIParams> extends AstroSharedContext<Props, Params>
 * - Notice: APIParams ≠ Params (type parameter mismatch)
 * - Result: 'request: Request' property from AstroSharedContext is not inherited
 *
 * Solution: Create our own BaseAPIContext with explicit property definitions
 *
 * See: /docs/ASTRO_TYPE_INHERITANCE_BUG.md for full details
 */

// Basic Web API Request interface - no dependency on Astro types
export interface BaseAPIContext<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
> {
  request: Request
  url: URL
  params: Params
  props: Props
  redirect(path: string, status?: number): Response
  locals: Record<string, unknown>
  cookies: {
    get(name: string): { value: string } | undefined
    set(name: string, value: string, options?: Record<string, unknown>): void
    delete(name: string, options?: Record<string, unknown>): void
  }
}

/**
 * Extended APIContext with auth user information added by protectRoute
 *
 * CRITICAL: Explicitly includes request property to work around Astro type inheritance bug
 * Without this explicit declaration, TypeScript cannot see request: Request from the
 * broken inheritance chain in Astro's APIContext interface.
 *
 * DO NOT remove the explicit 'request: Request' declaration below!
 */
export interface AuthAPIContext<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
> extends BaseAPIContext<Props, Params> {
  locals: BaseAPIContext<Props, Params>['locals'] & {
    user: AuthUser
  }
  // CRITICAL: DO NOT REMOVE - Works around Astro 5.x type inheritance bug
  // Without this, TypeScript cannot see 'request' property from broken APIContext inheritance
  request: Request
}

/**
 * Protected API route handler function with typed auth context
 * The return type is widened to be compatible with Astro's APIRoute
 */
export type ProtectedAPIRoute<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
> = (context: AuthAPIContext<Props, Params>) => Response | Promise<Response>

/**
 * Options for protecting an API route
 */
export interface ProtectRouteOptions {
  requiredRole?: AuthRole
  validateIPMatch?: boolean
  validateUserAgent?: boolean
}

/**
 * Utility type to help convert base context to auth context
 * This handles the structural typing compatibility issue
 */
export type APIContextConverter<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
> = (context: BaseAPIContext<Props, Params>) => AuthAPIContext<Props, Params>

/**
 * Higher-order function to apply protection to an API route
 * This typing makes protectRoute return a valid API route handler
 */
export type ProtectRouteFunction = <
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>(
  options: ProtectRouteOptions,
) => (
  handler: (
    context: AuthAPIContext<Props, Params>,
  ) => Response | Promise<Response>,
) => (context: BaseAPIContext<Props, Params>) => Response | Promise<Response>
