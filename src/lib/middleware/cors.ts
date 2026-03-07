import { defineMiddleware } from 'astro:middleware'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

/**
 * CORS configuration
 * Separate configurations for development and production
 */
export const corsOptions = {
  development: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:4321', // Astro dev server
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
    maxAge: 86400, // 24 hours
    credentials: true,
  },
  production: {
    allowedOrigins: [
      'https://app.yourdomain.com',
      'https://api.yourdomain.com',
      'https://admin.yourdomain.com',
      'https://*.yourdomain.com', // Subdomains
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
    maxAge: 86400, // 24 hours
    credentials: true,
  },
}

/**
 * Get the appropriate CORS configuration based on environment
 */
function getConfig() {
  return import.meta.env.PROD ? corsOptions.production : corsOptions.development
}

/**
 * Check if an origin is allowed based on the configuration
 */
function isOriginAllowed(
  origin: string,
  config: typeof corsOptions.development,
) {
  return config.allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin.includes('*')) {
      const pattern = new RegExp(
        `^${allowedOrigin.replace('*', '[a-zA-Z0-9-]+')}\$`,
      )
      return pattern.test(origin)
    }
    return allowedOrigin === origin
  })
}

/**
 * CORS middleware implementation with enhanced security and error handling
 */
export const corsMiddleware = defineMiddleware(async ({ request }, next) => {
  const url = new URL(request.url)
  const path = url.pathname

  // Only apply CORS to API routes
  if (!path.startsWith('/api/')) {
    return next()
  }

  const config = getConfig()
  const origin = request.headers.get('Origin')

  try {
    // Process the request first to catch any errors
    const response = await next()

    // Apply CORS headers if origin is present
    if (origin) {
      // Check if origin is allowed
      const allowed = isOriginAllowed(origin, config)

      if (allowed) {
        response.headers.set('Access-Control-Allow-Origin', origin)

        if (config.credentials) {
          response.headers.set('Access-Control-Allow-Credentials', 'true')
        }

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
          response.headers.set(
            'Access-Control-Allow-Methods',
            config.allowedMethods.join(', '),
          )
          response.headers.set(
            'Access-Control-Allow-Headers',
            config.allowedHeaders.join(', '),
          )
          response.headers.set(
            'Access-Control-Max-Age',
            config.maxAge.toString(),
          )

          if (config.exposedHeaders.length > 0) {
            response.headers.set(
              'Access-Control-Expose-Headers',
              config.exposedHeaders.join(', '),
            )
          }

          // Return 204 No Content for preflight requests
          return new Response(null, {
            status: 204,
            headers: response.headers,
          })
        }

        // Add exposed headers for non-preflight requests
        if (config.exposedHeaders.length > 0) {
          response.headers.set(
            'Access-Control-Expose-Headers',
            config.exposedHeaders.join(', '),
          )
        }

        // Add security headers
        response.headers.set('X-Content-Type-Options', 'nosniff')
        response.headers.set('X-Frame-Options', 'DENY')
        response.headers.set('X-XSS-Protection', '1; mode=block')
        response.headers.set(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains',
        )
      } else {
        // Log unauthorized CORS attempt
        logger.warn('Unauthorized CORS request:', {
          origin,
          path,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
        })

        // Return 403 Forbidden for unauthorized origins
        return new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Origin not allowed',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
    }

    return response
  } catch (error: unknown) {
    // Log any errors that occur during CORS handling
    logger.error('CORS middleware error:', {
      error: error instanceof Error ? String(error) : String(error),
      origin,
      path,
      method: request.method,
    })

    // Return 500 Internal Server Error
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'An error occurred while processing the request',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...(origin && isOriginAllowed(origin, config)
            ? {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Credentials': 'true',
              }
            : {}),
        },
      },
    )
  }
})
