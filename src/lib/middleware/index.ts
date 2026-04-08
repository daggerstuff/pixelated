import type { APIContext, MiddlewareHandler, MiddlewareNext } from 'astro'

export interface ExtendedMiddleware extends MiddlewareHandler {
  (context: APIContext, next: MiddlewareNext): Promise<Response | undefined>
}

// Type declarations for middleware functions - these are defined elsewhere in the middleware pipeline
declare function sequence(
  ...middlewares: MiddlewareHandler[]
): MiddlewareHandler

declare const loggingMiddleware: MiddlewareHandler
declare const corsMiddleware: MiddlewareHandler
declare const csrfMiddleware: MiddlewareHandler
declare const securityHeadersMiddleware: MiddlewareHandler
declare const contentTypeMiddleware: MiddlewareHandler

/**
 * Combined middleware sequence that applies our middleware in the correct order
 */
export const middlewareSequence = sequence(
  loggingMiddleware,
  corsMiddleware,
  csrfMiddleware,
  securityHeadersMiddleware,
  contentTypeMiddleware,
)
