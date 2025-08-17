// import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import type { TreatmentPlan } from '../../../types/treatment'

const logger = createBuildSafeLogger('treatment-plans-index')

// Zod schemas for validation
const treatmentObjectiveSchema = z.object({
  description: z.string().min(1),
  targetDate: z.string().datetime().optional().nullable(),
  status: z
    .enum(['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'])
    .default('Not Started'),
  interventions: z.array(z.string().min(1)).min(1),
  progressNotes: z.string().optional().nullable(),
})

const treatmentGoalSchema = z.object({
  description: z.string().min(1),
  targetDate: z.string().datetime().optional().nullable(),
  status: z
    .enum([
      'Not Started',
      'In Progress',
      'Achieved',
      'Partially Achieved',
      'Not Achieved',
    ])
    .default('Not Started'),
  objectives: z.array(treatmentObjectiveSchema).min(1),
})

const treatmentPlanClientSchema = z.object({
  title: z.string().min(1),
  diagnosis: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  status: z
    .enum(['Draft', 'Active', 'Completed', 'Discontinued', 'Archived'])
    .default('Draft'),
  goals: z.array(treatmentGoalSchema).min(1),
  generalNotes: z.string().optional().nullable(),
})

export const GET = async ({ locals }) => {
  try {
    // TODO: Replace with actual authentication check
    const user = locals.user
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
      })
    }

    logger.info('Fetching treatment plans', { userId: user.id })

    // TODO: Replace with actual database implementation
    // For now, return empty array to prevent build errors
    const plans: TreatmentPlan[] = []

    return new Response(JSON.stringify(plans), { status: 200 })
  } catch (error) {
    logger.error('Error fetching treatment plans:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch treatment plans.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}

export const POST = async ({ request, locals }) => {
  try {
    // TODO: Replace with actual authentication check
    const user = locals.user
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
      })
    }

    const body = await request.json()

    // Validate the request body
    const validationResult = treatmentPlanClientSchema.safeParse(body)
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
          details: validationResult.error.errors,
        }),
        { status: 400 },
      )
    }

    const planData = validationResult.data

    logger.info('Creating treatment plan', {
      userId: user.id,
      title: planData.title,
    })

    // TODO: Replace with actual database implementation
    // For now, return a mock created plan
    const newPlan: TreatmentPlan = {
      id: `plan-${Date.now()}`,
      client_id: user.id,
      therapist_id: user.id,
      title: planData.title,
      diagnosis: planData.diagnosis || null,
      start_date: planData.startDate || new Date().toISOString(),
      end_date: planData.endDate || null,
      status: planData.status,
      general_notes: planData.generalNotes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      goals: planData.goals.map((goal, index) => ({
        id: `goal-${Date.now()}-${index}`,
        treatment_plan_id: `plan-${Date.now()}`,
        description: goal.description,
        target_date: goal.targetDate,
        status: goal.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        objectives: goal.objectives.map((objective, objIndex) => ({
          id: `obj-${Date.now()}-${index}-${objIndex}`,
          treatment_goal_id: `goal-${Date.now()}-${index}`,
          description: objective.description,
          target_date: objective.targetDate,
          status: objective.status,
          interventions: objective.interventions,
          progress_notes: objective.progressNotes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      })),
    }

    return new Response(JSON.stringify(newPlan), { status: 201 })
  } catch (error) {
    logger.error('Error creating treatment plan:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to create treatment plan.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}
