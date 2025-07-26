import type { APIContext, MiddlewareHandler, MiddlewareNext } from 'astro'

export interface ExtendedMiddleware extends MiddlewareHandler {
  (context: APIContext, next: MiddlewareNext): Promise<Response | undefined>
}

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
