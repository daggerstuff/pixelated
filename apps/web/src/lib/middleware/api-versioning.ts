import { defineMiddleware } from 'astro:middleware'

import { getApiVersion, setVersionHeader, isApiRoute } from '../api-versioning'

/**
 * Astro middleware that adds the `X-API-Version` response header
 * to all `/api/*` responses.
 *
 * The version is determined from the URL path (`/api/v{N}/`) or
 * falls back to the current API version if not specified.
 */
export const apiVersioningMiddleware = defineMiddleware(
  async (context, next) => {
    const { request } = context
    const url = new URL(request.url)
    const { pathname } = url

    if (!isApiRoute(pathname)) {
      return next()
    }

    const response = await next()

    // Set version header on API responses
    if (response instanceof Response) {
      const { version } = getApiVersion(pathname, request.headers)
      setVersionHeader(response, version)
    }

    return response
  },
)
