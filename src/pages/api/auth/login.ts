/**
 * User Login API Endpoint
 * Handles user authentication with Better-Auth integration
 */

import type { APIRoute } from 'astro'
import { authenticateWithBetterAuth } from '../../../lib/auth/better-auth-integration'
import { rateLimitMiddleware, csrfProtection } from '../../../lib/auth/middleware'
import { sanitizeInput } from '../../../lib/auth/utils'
import { logSecurityEvent } from '../../../lib/security'

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Extract client information
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceId = request.headers.get('x-device-id') || 'unknown'
    const clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent,
      deviceId,
    }

    // Apply CSRF protection for POST requests
    const csrfResult = await csrfProtection(request)
    if (!csrfResult.success) {
      return csrfResult.response!
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(
      request,
      'login',
      10, // 10 login attempts per hour per IP
      60
    )

    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    // Parse and validate request body
    const body = await request.json()
    
    // Validate required fields
    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: ['email', 'password'],
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Sanitize input data
    const email = sanitizeInput(body.email)
    const password = body.password // Don't sanitize password

    // Attempt login
    const result = await authenticateWithBetterAuth({ email, password }, clientInfo)

    // Log successful login
    await logSecurityEvent('USER_LOGIN_SUCCESS', result.user.id, {
      email: result.user.email,
      role: result.user.role,
      clientInfo,
      timestamp: Date.now(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          lastLoginAt: result.user.lastLoginAt,
        },
        tokenPair: result.tokenPair,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      }
    )

  } catch (error) {
    // Handle specific authentication errors
    if (error.name === 'AuthenticationError') {
      await logSecurityEvent('USER_LOGIN_FAILED', null, {
        error: error.message,
        clientInfo,
        timestamp: Date.now(),
      })

      return new Response(
        JSON.stringify({
          error: error.message,
          details: error.details || {},
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Handle unexpected errors
    console.error('Login error:', error)
    
    await logSecurityEvent('USER_LOGIN_ERROR', null, {
      error: error.message,
      clientInfo,
      timestamp: Date.now(),
    })

    return new Response(
      JSON.stringify({
        error: 'Login failed',
        message: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

// Handle OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Device-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}