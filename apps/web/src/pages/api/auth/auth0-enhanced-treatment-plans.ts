/**
 * Auth0-based Enhanced Treatment Plans API Endpoint
 * Handles treatment plan management with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { z } from 'zod'

import { createAuditLog, AuditEventType } from '@/lib/audit'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getUserById } from '@/lib/services/auth0.service'
import { treatmentPlanDAO } from '@/lib/services/mongodb.dao'
import type { TreatmentPlan as TreatmentPlanDB } from '@/types/mongodb.types'

export const prerender = false

const logger = createBuildSafeLogger('auth0-enhanced-treatment-plans-api')

// Enhanced schemas for the treatment plan manager component
const milestoneSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  completedDate: z.iso.datetime().optional(),
  notes: z.string().optional(),
  dueDate: z.iso.datetime().optional(),
})

const treatmentGoalEnhancedSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  targetDate: z.iso.datetime(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z
    .enum(['not-started', 'in-progress', 'completed', 'on-hold'])
    .default('not-started'),
  progress: z.number().min(0).max(100).default(0),
  category: z.enum([
    'behavioral',
    'cognitive',
    'emotional',
    'social',
    'physical',
  ]),
  milestones: z.array(milestoneSchema).default([]),
  metrics: z
    .object({
      sessionsCompleted: z.number().default(0),
      exercisesAssigned: z.number().default(0),
      exercisesCompleted: z.number().default(0),
      lastActivityDate: z.iso.datetime().optional(),
    })
    .optional(),
})

const treatmentPlanEnhancedSchema = z.object({
  id: z.string().optional(),
  clientName: z.string().min(1),
  therapistName: z.string().min(1),
  clientId: z.string().min(1),
  therapistId: z.string().min(1),
  createdDate: z.iso.datetime().optional(),
  lastModified: z.iso.datetime().optional(),
  duration: z.number().min(1), // weeks
  status: z.enum(['active', 'completed', 'paused', 'draft']).default('draft'),
  goals: z.array(treatmentGoalEnhancedSchema).min(1),
  notes: z.string().default(''),
  metadata: z
    .object({
      totalSessions: z.number().default(0),
      completedSessions: z.number().default(0),
      overallProgress: z.number().min(0).max(100).default(0),
      nextSessionDate: z.iso.datetime().optional(),
      riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
      interventionHistory: z
        .array(
          z.object({
            date: z.iso.datetime(),
            intervention: z.string(),
            outcome: z.string(),
            effectiveness: z.number().min(1).max(5),
          }),
        )
        .default([]),
    })
    .optional(),
})

interface TreatmentPlanEnhanced {
  id: string
  clientName: string
  therapistName: string
  clientId: string
  therapistId: string
  createdDate: string
  lastModified: string
  duration: number
  status: 'active' | 'completed' | 'paused' | 'draft'
  goals: Array<{
    id: string
    title: string
    description: string
    targetDate: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    status: 'not-started' | 'in-progress' | 'completed' | 'on-hold'
    progress: number
    category: 'behavioral' | 'cognitive' | 'emotional' | 'social' | 'physical'
    milestones: Array<{
      id: string
      title: string
      completed: boolean
      completedDate?: string
      notes?: string
      dueDate?: string
    }>
    metrics?: {
      sessionsCompleted: number
      exercisesAssigned: number
      exercisesCompleted: number
      lastActivityDate?: string
    }
  }>
  notes: string
  metadata?: {
    totalSessions: number
    completedSessions: number
    overallProgress: number
    nextSessionDate?: string
    riskLevel: 'low' | 'medium' | 'high'
    interventionHistory: Array<{
      date: string
      intervention: string
      outcome: string
      effectiveness: number
    }>
  }
}

/**
 * Convert a database TreatmentPlan document to the enhanced API response shape.
 * The DB stores dates as Date objects and uses `_id`; the API returns ISO strings and `id`.
 */
function toEnhancedResponse(plan: TreatmentPlanDB): TreatmentPlanEnhanced {
  return {
    id: plan.id ?? plan._id?.toString() ?? '',
    clientName: plan.clientName,
    therapistName: plan.therapistName,
    clientId: plan.clientId,
    therapistId: plan.therapistId,
    createdDate:
      plan.createdAt instanceof Date
        ? plan.createdAt.toISOString()
        : new Date().toISOString(),
    lastModified:
      plan.updatedAt instanceof Date
        ? plan.updatedAt.toISOString()
        : new Date().toISOString(),
    duration: plan.duration ?? 0,
    status: plan.status,
    goals: plan.goals ?? [],
    notes: plan.notes ?? '',
    metadata: plan.metadata,
  }
}

/**
 * Enhanced Treatment Plans API
 * GET /api/auth/auth0-enhanced-treatment-plans
 *
 * Provides comprehensive treatment plan data for the TreatmentPlanManager component
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
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
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')
    const planId = url.searchParams.get('planId')
    const status = url.searchParams.get('status')
    const includeMetrics = url.searchParams.get('includeMetrics') === 'true'

    // Fetch treatment plans from the database
    let plans: TreatmentPlanDB[]

    if (planId) {
      // Fetch a specific plan by ID
      const plan = await treatmentPlanDAO.findById(planId)
      plans = plan ? [plan] : []
    } else if (clientId) {
      // Fetch plans for a specific client, optionally filtered by status
      plans = await treatmentPlanDAO.findByClientId(clientId, {
        status: status ?? undefined,
      })
    } else {
      // Default: fetch plans for the authenticated therapist
      plans = await treatmentPlanDAO.findByTherapistId(user.id, {
        status: status ?? undefined,
      })
    }

    // Convert to enhanced response format
    let filteredPlans = plans.map(toEnhancedResponse)

    // Remove metrics if not requested
    if (!includeMetrics) {
      filteredPlans = filteredPlans.map((plan) => ({
        ...plan,
        goals: plan.goals.map((goal) => {
          const { metrics: _metrics, ...goalWithoutMetrics } = goal
          return goalWithoutMetrics
        }),
        metadata: plan.metadata
          ? {
              ...plan.metadata,
              interventionHistory: [],
            }
          : undefined,
      }))
    }

    // Create audit log
    await createAuditLog(
      AuditEventType.ACCESS,
      'auth.components.treatment.plans.enhanced.access',
      user.id,
      'auth-components-treatment-plans',
      {
        action: 'get_treatment_plans',
        planCount: filteredPlans.length,
        clientId,
        planId,
        includeMetrics,
      },
    )

    logger.info('Retrieved enhanced treatment plans', {
      planCount: filteredPlans.length,
      clientId,
      planId,
      includeMetrics,
      userId: user.id,
    })

    return new Response(JSON.stringify(filteredPlans), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300', // 5-minute cache
      },
    })
  } catch (error: unknown) {
    logger.error('Error retrieving enhanced treatment plans', { error })

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM,
      'auth.components.treatment.plans.enhanced.error',
      'anonymous',
      'auth-components-treatment-plans',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * POST endpoint for creating/updating treatment plans
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
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
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()

    // Validate the request body
    const validationResult = treatmentPlanEnhancedSchema.safeParse(body)
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid treatment plan data',
          details: validationResult.error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const planData = validationResult.data

    // Calculate overall progress
    const totalGoals = planData.goals.length
    const totalProgress = planData.goals.reduce(
      (sum, goal) => sum + goal.progress,
      0,
    )
    const overallProgress =
      totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0

    // Persist to database
    const createdPlan = await treatmentPlanDAO.create({
      clientId: planData.clientId,
      therapistId: planData.therapistId,
      clientName: planData.clientName,
      therapistName: planData.therapistName,
      title: planData.goals[0]?.title ?? 'Treatment Plan',
      description: planData.notes,
      goals: planData.goals,
      interventions: [],
      status: planData.status,
      startDate: new Date(),
      duration: planData.duration,
      notes: planData.notes,
      metadata: {
        totalSessions: planData.metadata?.totalSessions ?? 0,
        completedSessions: planData.metadata?.completedSessions ?? 0,
        overallProgress,
        nextSessionDate: planData.metadata?.nextSessionDate,
        riskLevel: planData.metadata?.riskLevel ?? 'low',
        interventionHistory: planData.metadata?.interventionHistory ?? [],
      },
    })

    const newPlan = toEnhancedResponse(createdPlan)

    // Create audit log
    await createAuditLog(
      AuditEventType.CREATE,
      'auth.components.treatment.plans.enhanced.create',
      user.id,
      'auth-components-treatment-plans',
      {
        action: 'create_treatment_plan',
        planId: newPlan.id,
        clientId: newPlan.clientId,
        goalCount: newPlan.goals.length,
        overallProgress,
      },
    )

    logger.info('Created/updated enhanced treatment plan', {
      planId: newPlan.id,
      clientId: newPlan.clientId,
      goalCount: newPlan.goals.length,
      overallProgress,
      userId: user.id,
    })

    return new Response(JSON.stringify(newPlan), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error creating/updating enhanced treatment plan', { error })

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM,
      'auth.components.treatment.plans.enhanced.error',
      'anonymous',
      'auth-components-treatment-plans',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * PATCH endpoint for updating specific goals or milestones
 */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
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
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { planId, goalId, milestoneId, updates } = body

    if (!planId || !updates) {
      return new Response(
        JSON.stringify({ error: 'planId and updates are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Verify the plan exists
    const existingPlan = await treatmentPlanDAO.findById(planId)
    if (!existingPlan) {
      return new Response(
        JSON.stringify({ error: 'Treatment plan not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Perform the appropriate update based on the level of granularity
    let updatedPlan

    if (milestoneId && goalId) {
      // Update a specific milestone within a goal
      updatedPlan = await treatmentPlanDAO.updateMilestone(
        planId,
        goalId,
        milestoneId,
        updates,
      )
    } else if (goalId) {
      // Update a specific goal
      updatedPlan = await treatmentPlanDAO.updateGoal(planId, goalId, updates)
    } else {
      // Update the plan-level fields
      updatedPlan = await treatmentPlanDAO.update(planId, updates)
    }

    // Create audit log
    await createAuditLog(
      AuditEventType.MODIFY,
      'auth.components.treatment.plans.enhanced.update',
      user.id,
      'auth-components-treatment-plans',
      {
        action: 'update_treatment_plan',
        planId,
        goalId,
        milestoneId,
        updateKeys: Object.keys(updates),
      },
    )

    const response = updatedPlan
      ? {
          success: true,
          plan: toEnhancedResponse(updatedPlan),
          planId,
          goalId,
          milestoneId,
          updates,
          lastModified: updatedPlan.updatedAt
            ? updatedPlan.updatedAt instanceof Date
              ? updatedPlan.updatedAt.toISOString()
              : String(updatedPlan.updatedAt)
            : new Date().toISOString(),
        }
      : {
          success: false,
          error: 'Plan not found after update',
          planId,
        }

    logger.info('Updated treatment plan component', {
      planId,
      goalId,
      milestoneId,
      updateKeys: Object.keys(updates),
      userId: user.id,
    })

    return new Response(JSON.stringify(response), {
      status: updatedPlan ? 200 : 404,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error updating treatment plan component', { error })

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.SYSTEM,
      'auth.components.treatment.plans.enhanced.error',
      'anonymous',
      'auth-components-treatment-plans',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
