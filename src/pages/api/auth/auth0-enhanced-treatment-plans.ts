/**
 * Auth0-based Enhanced Treatment Plans API Endpoint
 * Handles treatment plan management with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { z } from 'zod'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-enhanced-treatment-plans-api')

// Enhanced schemas for the treatment plan manager component
const milestoneSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  completedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
})

const treatmentGoalEnhancedSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  targetDate: z.string().datetime(),
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
      lastActivityDate: z.string().datetime().optional(),
    })
    .optional(),
})

const treatmentPlanEnhancedSchema = z.object({
  id: z.string().optional(),
  clientName: z.string().min(1),
  therapistName: z.string().min(1),
  clientId: z.string().min(1),
  therapistId: z.string().min(1),
  createdDate: z.string().datetime().optional(),
  lastModified: z.string().datetime().optional(),
  duration: z.number().min(1), // weeks
  status: z.enum(['active', 'completed', 'paused', 'draft']).default('draft'),
  goals: z.array(treatmentGoalEnhancedSchema).min(1),
  notes: z.string().default(''),
  metadata: z
    .object({
      totalSessions: z.number().default(0),
      completedSessions: z.number().default(0),
      overallProgress: z.number().min(0).max(100).default(0),
      nextSessionDate: z.string().datetime().optional(),
      riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
      interventionHistory: z
        .array(
          z.object({
            date: z.string().datetime(),
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
 * Enhanced Treatment Plans API
 * GET /api/auth/auth0-enhanced-treatment-plans
 *
 * Provides comprehensive treatment plan data for the TreatmentPlanManager component
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
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
        }
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

    // TODO: Replace with actual database queries
    const mockPlans: TreatmentPlanEnhanced[] = [
      {
        id: 'plan-1',
        clientName: 'Sarah Johnson',
        therapistName: 'Dr. Emily Chen',
        clientId: clientId || 'client-1',
        therapistId: user.id,
        createdDate: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        lastModified: new Date().toISOString(),
        duration: 12,
        status: 'active',
        notes:
          'Patient shows excellent engagement and motivation. Responding well to CBT interventions.',
        goals: [
          {
            id: 'goal-1',
            title: 'Reduce Anxiety Symptoms',
            description:
              'Learn and practice anxiety management techniques to reduce daily anxiety levels from 8/10 to 4/10',
            targetDate: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            priority: 'high',
            status: 'in-progress',
            progress: 65,
            category: 'emotional',
            milestones: [
              {
                id: 'm1',
                title: 'Learn deep breathing techniques',
                completed: true,
                completedDate: new Date(
                  Date.now() - 5 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                notes: 'Mastered 4-7-8 breathing technique',
              },
              {
                id: 'm2',
                title: 'Practice daily meditation (10 min)',
                completed: true,
                completedDate: new Date(
                  Date.now() - 3 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                notes: 'Consistently practicing for 2 weeks',
              },
              {
                id: 'm3',
                title: 'Identify personal anxiety triggers',
                completed: false,
                dueDate: new Date(
                  Date.now() + 7 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
              {
                id: 'm4',
                title: 'Develop coping strategy toolkit',
                completed: false,
                dueDate: new Date(
                  Date.now() + 14 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
            ],
            metrics: {
              sessionsCompleted: 6,
              exercisesAssigned: 12,
              exercisesCompleted: 8,
              lastActivityDate: new Date(
                Date.now() - 1 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          },
          {
            id: 'goal-2',
            title: 'Improve Sleep Quality',
            description:
              'Establish healthy sleep patterns and achieve 7-8 hours of quality sleep nightly',
            targetDate: new Date(
              Date.now() + 21 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            priority: 'medium',
            status: 'in-progress',
            progress: 40,
            category: 'physical',
            milestones: [
              {
                id: 'm5',
                title: 'Create consistent bedtime routine',
                completed: true,
                completedDate: new Date(
                  Date.now() - 4 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                notes: 'Established 9 PM routine',
              },
              {
                id: 'm6',
                title: 'Limit screen time 1 hour before bed',
                completed: false,
                dueDate: new Date(
                  Date.now() + 10 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
              {
                id: 'm7',
                title: 'Track sleep patterns for 2 weeks',
                completed: false,
                dueDate: new Date(
                  Date.now() + 14 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
            ],
            metrics: {
              sessionsCompleted: 3,
              exercisesAssigned: 8,
              exercisesCompleted: 4,
              lastActivityDate: new Date(
                Date.now() - 2 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          },
          {
            id: 'goal-3',
            title: 'Enhance Social Connections',
            description:
              'Build and maintain meaningful relationships and expand social support network',
            targetDate: new Date(
              Date.now() + 45 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            priority: 'medium',
            status: 'not-started',
            progress: 0,
            category: 'social',
            milestones: [
              {
                id: 'm8',
                title: 'Join local support group',
                completed: false,
                dueDate: new Date(
                  Date.now() + 14 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
              {
                id: 'm9',
                title: 'Reconnect with 2 old friends',
                completed: false,
                dueDate: new Date(
                  Date.now() + 21 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
              {
                id: 'm10',
                title: 'Practice social skills in low-pressure settings',
                completed: false,
                dueDate: new Date(
                  Date.now() + 35 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
            ],
            metrics: {
              sessionsCompleted: 0,
              exercisesAssigned: 0,
              exercisesCompleted: 0,
            },
          },
        ],
        metadata: {
          totalSessions: 12,
          completedSessions: 6,
          overallProgress: 35,
          nextSessionDate: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          riskLevel: 'low',
          interventionHistory: [
            {
              date: new Date(
                Date.now() - 7 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              intervention: 'Cognitive Behavioral Therapy - Anxiety Module',
              outcome: 'Reduced anxiety from 8/10 to 6/10',
              effectiveness: 4,
            },
            {
              date: new Date(
                Date.now() - 14 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              intervention: 'Mindfulness-Based Stress Reduction',
              outcome: 'Improved stress coping mechanisms',
              effectiveness: 5,
            },
          ],
        },
      },
    ]

    // Filter plans based on query parameters
    let filteredPlans = mockPlans

    if (planId) {
      filteredPlans = filteredPlans.filter((plan) => plan.id === planId)
    }

    if (clientId) {
      filteredPlans = filteredPlans.filter((plan) => plan.clientId === clientId)
    }

    if (status) {
      filteredPlans = filteredPlans.filter((plan) => plan.status === status)
    }

    // Remove metrics if not requested
    if (!includeMetrics) {
      filteredPlans = filteredPlans.map((plan) => ({
        ...plan,
        goals: plan.goals.map((goal) => {
          const { metrics, ...goalWithoutMetrics } = goal as any
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
      'treatment_plans_access',
      'auth.components.treatment.plans.enhanced.access',
      user.id,
      'auth-components-treatment-plans',
      {
        action: 'get_treatment_plans',
        planCount: filteredPlans.length,
        clientId,
        planId,
        includeMetrics
      }
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
      'system_error',
      'auth.components.treatment.plans.enhanced.error',
      'anonymous',
      'auth-components-treatment-plans',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
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
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
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
        }
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
          details: validationResult.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const planData = validationResult.data
    const currentTime = new Date().toISOString()

    // Calculate overall progress
    const totalGoals = planData.goals.length
    const totalProgress = planData.goals.reduce(
      (sum, goal) => sum + goal.progress,
      0,
    )
    const overallProgress =
      totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0

    const newPlan: TreatmentPlanEnhanced = {
      id: planData.id || `plan-${Date.now()}`,
      clientName: planData.clientName,
      therapistName: planData.therapistName,
      clientId: planData.clientId,
      therapistId: planData.therapistId,
      createdDate: planData.createdDate || currentTime,
      lastModified: currentTime,
      duration: planData.duration,
      status: planData.status,
      goals: planData.goals.map((goal) => ({
        ...goal,
        milestones: goal.milestones.map((milestone) => ({
          ...milestone,
          id: milestone.id || `milestone-${Date.now()}-${Math.random()}`,
        })),
      })),
      notes: planData.notes,
      metadata: {
        totalSessions: planData.metadata?.totalSessions || 0,
        completedSessions: planData.metadata?.completedSessions || 0,
        overallProgress,
        nextSessionDate: planData.metadata?.nextSessionDate,
        riskLevel: planData.metadata?.riskLevel || 'low',
        interventionHistory: planData.metadata?.interventionHistory || [],
      },
    }

    // Create audit log
    await createAuditLog(
      'treatment_plan_created',
      'auth.components.treatment.plans.enhanced.create',
      user.id,
      'auth-components-treatment-plans',
      {
        action: 'create_treatment_plan',
        planId: newPlan.id,
        clientId: newPlan.clientId,
        goalCount: newPlan.goals.length,
        overallProgress
      }
    )

    // TODO: Save to database
    // const repository = new TreatmentPlanRepository()
    // await repository.saveTreatmentPlan(newPlan)

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
      'system_error',
      'auth.components.treatment.plans.enhanced.error',
      'anonymous',
      'auth-components-treatment-plans',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
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
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
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
        }
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

    // Create audit log
    await createAuditLog(
      'treatment_plan_updated',
      'auth.components.treatment.plans.enhanced.update',
      user.id,
      'auth-components-treatment-plans',
      {
        action: 'update_treatment_plan',
        planId,
        goalId,
        milestoneId,
        updateKeys: Object.keys(updates)
      }
    )

    // TODO: Implement actual database update
    // const repository = new TreatmentPlanRepository()
    // const updatedPlan = await repository.updateTreatmentPlan(planId, goalId, milestoneId, updates)

    // For now, return success response
    const response = {
      success: true,
      planId,
      goalId,
      milestoneId,
      updates,
      lastModified: new Date().toISOString(),
    }

    logger.info('Updated treatment plan component', {
      planId,
      goalId,
      milestoneId,
      updateKeys: Object.keys(updates),
      userId: user.id,
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error updating treatment plan component', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.treatment.plans.enhanced.error',
      'anonymous',
      'auth-components-treatment-plans',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
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