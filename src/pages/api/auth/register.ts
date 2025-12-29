/**
 * User Registration API Endpoint
 * Handles user registration with Better-Auth integration
 */

import type { APIRoute } from 'astro'
import { registerWithBetterAuth } from '@/lib/auth/better-auth-integration'
import { rateLimitMiddleware } from '@/lib/auth/middleware'
import { sanitizeInput } from '@/lib/auth/utils'
import { logSecurityEvent } from '@/lib/security'
import { updatePhase6AuthenticationProgress } from '@/lib/mcp/phase6-integration'

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let clientInfo;
  try {
    // Extract client information
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceId = request.headers.get('x-device-id') || 'unknown'
    clientInfo = {
      ip: clientAddress || 'unknown',
      userAgent,
      deviceId,
    }

    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(
      request as any,
      'register',
      3, // 3 registrations per hour per IP
      60,
    )

    if (!rateLimitResult.success) {
      return rateLimitResult.response!
    }

    // Parse and validate request body
    const body = await request.json()

    // Validate required fields
    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          details: ['email', 'password', 'firstName', 'lastName'],
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Sanitize input data
    const sanitizedData = {
      email: sanitizeInput(body.email),
      password: body.password, // Don't sanitize password
      firstName: sanitizeInput(body.firstName),
      lastName: sanitizeInput(body.lastName),
      role: sanitizeInput(body.role || 'patient'),
      phone: body.phone ? sanitizeInput(body.phone) : undefined,
      dateOfBirth: body.dateOfBirth
        ? sanitizeInput(body.dateOfBirth)
        : undefined,
    }

    // Register user
    const result = await registerWithBetterAuth(sanitizedData, clientInfo)

    // Log successful registration
    await logSecurityEvent('access', {
      userId: result.user.id,
      clientInfo: clientInfo || {},
      email: result.user.email,
      role: result.user.role,
      timestamp: Date.now(),
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(result.user.id, 'user_registered')

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          createdAt: result.user.createdAt,
        },
        tokenPair: result.tokenPair,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        },
      },
    )
  } catch (error: any) {
    // Handle specific authentication errors
    if (error.name === 'AuthenticationError') {
      await logSecurityEvent('error', {
        error: error.message,
        clientInfo: clientInfo || {},
        timestamp: Date.now(),
      })

      return new Response(
        JSON.stringify({
          error: error.message,
          details: error.details || {},
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Handle unexpected errors
    console.error('Registration error:', error)

    await logSecurityEvent('error', {
      error: error.message,
      clientInfo: clientInfo || {},
      timestamp: Date.now(),
    })

    return new Response(
      JSON.stringify({
        error: 'Registration failed',
        message: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
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
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-CSRF-Token, X-Device-ID',
      'Access-Control-Max-Age': '86400',
    },
  })
}
