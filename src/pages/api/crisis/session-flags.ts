import { CrisisSessionFlaggingService } from '@/lib/ai/crisis/CrisisSessionFlaggingService'
import { getSession } from '@/lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'

const logger = createBuildSafeLogger('crisis-session-flags-api')

export const GET = async ({ request }: APIContext) => {
  try {
    // Authenticate user
    const sessionData = await getSession(request)
    if (!sessionData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeResolved = searchParams.get('includeResolved') === 'true'
    const pending = searchParams.get('pending') === 'true'

    const flaggingService = new CrisisSessionFlaggingService()

    if (pending) {
      // Get all pending crisis flags (admin/therapist only)
      const userRole = sessionData?.['user']?.['user_metadata']?.['role']
      if (!userRole || !['admin', 'therapist'].includes(userRole)) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      const flags = await flaggingService.getPendingCrisisFlags()
      return new Response(JSON.stringify({ flags }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (userId) {
      // Get crisis flags for specific user
      // Users can only see their own flags, admins/therapists can see any
      const userRole = sessionData?.['user']?.['user_metadata']?.['role']
      if (
        userId !== sessionData.user.id &&
        !['admin', 'therapist'].includes(userRole)
      ) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      const flags = await flaggingService.getUserCrisisFlags(
        userId,
        includeResolved,
      )
      const status = await flaggingService.getUserSessionStatus(userId)

      return new Response(JSON.stringify({ flags, status }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Default: get current user's flags
    const flags = await flaggingService.getUserCrisisFlags(
      sessionData.user.id,
      includeResolved,
    )
    const status = await flaggingService.getUserSessionStatus(
      sessionData.user.id,
    )

    return new Response(JSON.stringify({ flags, status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error in GET /api/crisis/session-flags', {
      error: error instanceof Error ? String(error) : String(error),
    })

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const POST = async ({ request }: APIContext) => {
  try {
    // Authenticate user
    const sessionData = await getSession(request)
    if (!sessionData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Only admins and therapists can create crisis flags manually
    const userRole = sessionData.user.user_metadata?.['role']
    if (!userRole || !['admin', 'therapist'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const body = await request.json()
    const {
      userId,
      sessionId,
      reason,
      severity = 'medium',
      detectedRisks = [],
      confidence = 1.0,
      textSample,
      metadata,
    } = body

    // Validate required fields
    if (!userId || !sessionId || !reason) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: userId, sessionId, reason',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const flaggingService = new CrisisSessionFlaggingService()
    const crisisId = crypto.randomUUID()

    const flag = await flaggingService.flagSessionForReview({
      userId,
      sessionId,
      crisisId,
      timestamp: new Date().toISOString(),
      reason,
      severity,
      detectedRisks,
      confidence,
      textSample,
      metadata,
    })

    // Create audit log
    await createAuditLog(
      AuditEventType.SECURITY,
      'crisis_session_flagged_manual',
      sessionData.user.id,
      sessionId,
      {
        targetUserId: userId,
        crisisId,
        severity,
        reason,
      },
      AuditEventStatus.SUCCESS,
    )

    logger.info('Crisis session flag created manually', {
      flagId: flag.id,
      userId,
      sessionId,
      createdBy: sessionData.user.id,
    })

    return new Response(JSON.stringify({ flag }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error in POST /api/crisis/session-flags', {
      error: error instanceof Error ? String(error) : String(error),
    })

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const PUT = async ({ request }: APIContext) => {
  try {
    // Authenticate user
    const sessionData = await getSession(request)
    if (!sessionData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Only admins and therapists can update crisis flags
    const userRole = sessionData.user.user_metadata?.['role']
    if (!userRole || !['admin', 'therapist'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const body = await request.json()
    const {
      flagId,
      status,
      assignedTo,
      reviewerNotes,
      resolutionNotes,
      metadata,
    } = body

    // Validate required fields
    if (!flagId || !status) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: flagId, status',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const flaggingService = new CrisisSessionFlaggingService()

    const updatedFlag = await flaggingService.updateFlagStatus({
      flagId,
      status,
      assignedTo,
      reviewerNotes,
      resolutionNotes,
      metadata,
    })

    // Create audit log
    await createAuditLog(
      AuditEventType.SECURITY,
      'crisis_session_flag_updated',
      sessionData.user.id,
      flagId,
      {
        newStatus: status,
        assignedTo,
        hasReviewerNotes: !!reviewerNotes,
        hasResolutionNotes: !!resolutionNotes,
      },
      AuditEventStatus.SUCCESS,
    )

    logger.info('Crisis session flag updated', {
      flagId,
      status,
      updatedBy: sessionData.user.id,
    })

    return new Response(JSON.stringify({ flag: updatedFlag }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error in PUT /api/crisis/session-flags', {
      error: error instanceof Error ? String(error) : String(error),
    })

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
