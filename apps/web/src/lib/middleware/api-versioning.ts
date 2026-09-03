import { defineMiddleware } from 'astro:middleware'

import {
  getApiVersion,
  setVersionHeader,
  setDeprecationHeaders,
  createDeprecationInfo,
  isApiRoute,
  extractVersionFromPath,
} from '../api-versioning'

export const apiVersioningMiddleware = defineMiddleware(
  async (context, next) => {
    const { request } = context
    const url = new URL(request.url)
    const { pathname } = url

    if (!isApiRoute(pathname)) {
      return next()
    }

    const response = await next()

    if (response instanceof Response) {
      const { version, source } = getApiVersion(pathname, request.headers)
      setVersionHeader(response, version)

      const pathVersion = extractVersionFromPath(pathname)
      if (pathVersion === null && source === 'default') {
        const deprecation = createDeprecationInfo(0, 12, 1)
        setDeprecationHeaders(response, deprecation)
        response.headers.set('X-API-Deprecation-Notice', 'Unversioned endpoint. Migrate to /api/v1/ prefix.')
      }
    }

    return response
  },
)
