// import type { APIRoute, APIContext } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import type { TreatmentPlan } from '@/types/treatment'

export const prerender = false

const logger = createBuildSafeLogger('treatment-plans')

// Zod schemas for update
const updateTreatmentObjectiveSchema = z
  .object({
    id: z.string().uuid().optional(),
    description: z.string().min(1).optional(),
    targetDate: z.string().datetime().optional().nullable(),
    status: z
      .enum(['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'])
      .optional(),
    interventions: z.array(z.string().min(1)).min(1).optional(),
    progressNotes: z.string().optional().nullable(),
  })
  .passthrough()

const updateTreatmentGoalSchema = z
  .object({
    id: z.string().uuid().optional(),
    description: z.string().min(1).optional(),
    targetDate: z.string().datetime().optional().nullable(),
    status: z
      .enum([
        'Not Started',
        'In Progress',
        'Achieved',
        'Partially Achieved',
        'Not Achieved',
      ])
      .optional(),
    objectives: z.array(updateTreatmentObjectiveSchema).optional(),
  })
  .passthrough()

const updateTreatmentPlanClientSchema = z.object({
  title: z.string().min(1).optional(),
  diagnosis: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  status: z
    .enum(['Draft', 'Active', 'Completed', 'Discontinued', 'Archived'])
    .optional(),
  goals: z.array(updateTreatmentGoalSchema).optional(),
  generalNotes: z.string().optional().nullable(),
})

export const GET: APIRoute = async ({ params, locals }: APIContext) => {
  try {
    // TODO: Replace with actual authentication check
    const { user } = locals
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
      })
    }

    const { planId } = params
    if (!planId) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
      })
    }

    logger.info('Fetching treatment plan', { planId, userId: user.id })

    // TODO: Replace with actual database implementation
    // For now, return a mock plan to prevent build errors
    const plan: TreatmentPlan = {
      id: planId,
      client_id: user.id,
      therapist_id: user.id,
      title: 'Mock Treatment Plan',
      diagnosis: null,
      start_date: new Date().toISOString(),
      end_date: null,
      status: 'Draft',
      general_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      goals: [],
    }

    return new Response(JSON.stringify(plan), { status: 200 })
  } catch (error) {
    logger.error(`Error fetching treatment plan:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch treatment plan.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}

export const PUT: APIRoute = async ({ params, request, locals }: APIContext) => {
  try {
    // TODO: Replace with actual authentication check
    const { user } = locals
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
      })
    }

    const { planId } = params
    if (!planId) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
      })
    }

    const body = await request.json()

    // Validate the request body
    const validationResult = updateTreatmentPlanClientSchema.safeParse(body)
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
          details: validationResult.error.errors,
        }),
        { status: 400 },
      )
    }

    const updates = validationResult.data

    logger.info('Updating treatment plan', { planId, userId: user.id, updates })

    // TODO: Replace with actual database implementation
    // For now, return success to prevent build errors
    const updatedPlan: TreatmentPlan = {
      id: planId,
      client_id: user.id,
      therapist_id: user.id,
      title: updates.title || 'Updated Treatment Plan',
      diagnosis: updates.diagnosis || null,
      start_date: updates.startDate || new Date().toISOString(),
      end_date: updates.endDate || null,
      status: updates.status || 'Draft',
      general_notes: updates.generalNotes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      goals: updates.goals || [],
    }

    return new Response(JSON.stringify(updatedPlan), { status: 200 })
  } catch (error) {
    logger.error(`Error updating treatment plan:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update treatment plan.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}
