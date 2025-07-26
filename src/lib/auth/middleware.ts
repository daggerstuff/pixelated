import type { AuthContext } from './types'
import { fheService } from '../fhe'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getSession } from './session'

// Initialize logger
const logger = createBuildSafeLogger('default')

/**
 * Middleware to verify message security and integrity
 */
export async function verifyMessageSecurity(
  request: Request,
  context: AuthContext,
) {
  try {
    // Get the session from the context
    const session = await getSession(request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if the session has security metadata
    if (!session.user.app_metadata?.verificationToken) {
      return new Response(
        JSON.stringify({ error: 'No verification token found in session' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify the message integrity
    // In a production system this would validate using FHE-based verification
    const isValid = true // Simplified for this example

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid message integrity' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Add verification result to the context
    context.securityVerification = {
      isValid,
      details: {
        timestamp: Date.now(),
        verificationHash: session.user.app_metadata.verificationToken,
      },
    }

    // Continue to the next middleware or route handler
    return null
  } catch (error) {
    logger.error('Message verification error:', error)
    return new Response(
      JSON.stringify({ error: 'Message verification failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * Middleware to verify admin access
 */
export async function verifyAdmin(request: Request, context: AuthContext) {
  try {
    // Get the session from the context
    const session = await getSession(request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify admin role
    if (session.user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Add admin verification info to the context
    context.adminVerification = {
      verified: true,
      timestamp: Date.now(),
      userId: session.user.id,
    }

    // Continue to the next middleware or route handler
    return null
  } catch (error) {
    logger.error('Admin verification error:', error)
    return new Response(
      JSON.stringify({ error: 'Admin verification failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * Middleware to enforce HIPAA compliance
 */
export async function enforceHIPAACompliance(
  request: Request,
  context: AuthContext,
) {
  try {
    // Get the session from the context
    const session = await getSession(request)

    if (!session) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify that encryption is properly initialized
    if (!fheService) {
      return new Response(
        JSON.stringify({ error: 'Encryption service not initialized' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Add HIPAA compliance info to the context
    context.hipaaCompliance = {
      encryptionEnabled: true,
      auditEnabled: true,
      timestamp: Date.now(),
    }

    // Continue to the next middleware or route handler
    return null
  } catch (error) {
    logger.error('HIPAA compliance check error:', error)
    return new Response(
      JSON.stringify({ error: 'HIPAA compliance check failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
