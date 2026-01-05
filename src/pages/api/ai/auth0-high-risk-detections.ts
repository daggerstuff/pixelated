import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../lib/audit'
import { aiRepository } from '@/lib/db/ai'
import { getUserById } from '@/services/auth0.service'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { requireRole } from '@/lib/auth/auth0-middleware'

export const GET = async ({ request, url }) => {
  let userId: string | null = null

  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    userId = user.id

    // Check if user has admin permissions
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse query parameters
    const limit = parseInt(url?.searchParams.get('limit') || '10')
    const offset = parseInt(url?.searchParams.get('offset') || '0')

    // Get high-risk detections
    const detections = await aiRepository.getHighRiskDetections(limit, offset)

    // Create audit log
    await createAuditLog(
      AuditEventType.SECURITY_EVENT,
      'high_risk_detections_access',
      userId,
      'ai-high-risk-detections',
      { limit, offset, count: detections.length },
      AuditEventStatus.SUCCESS,
    )

    return new Response(JSON.stringify(detections), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error fetching high-risk detections:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM_ERROR,
      'high_risk_detections_error',
      userId || 'anonymous',
      'ai-high-risk-detections',
      {
        error: error?.message,
        stack: error?.stack,
      },
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({ error: 'Failed to fetch high-risk detections' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}