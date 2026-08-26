import type { APIRoute } from 'astro'
import { z } from 'zod'

import type { AuthAPIContext } from '@/lib/auth/apiRouteTypes'
import { protectRoute } from '@/lib/auth/serverAuth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { treatmentPlanDAO } from '@/lib/services/mongodb.dao'
import type { TreatmentPlan as TreatmentPlanDB } from '@/types/mongodb.types'
import type { TreatmentPlan } from '@/types/treatment'

export const prerender = false

const logger = createBuildSafeLogger('treatment-plans')

// Zod schemas for update
const updateTreatmentObjectiveSchema = z.object({
  id: z.uuid().optional(),
  description: z.string().min(1).optional(),
  targetDate: z.string().optional().nullable(),
  status: z
    .enum(['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'])
    .optional(),
  interventions: z.array(z.string().min(1)).min(1).optional(),
  progressNotes: z.string().optional().nullable(),
})

const updateTreatmentGoalSchema = z.object({
  id: z.uuid().optional(),
  description: z.string().min(1).optional(),
  targetDate: z.string().optional().nullable(),
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

const updateTreatmentPlanClientSchema = z.object({
  title: z.string().min(1).optional(),
  diagnosis: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  status: z
    .enum(['Draft', 'Active', 'Completed', 'Discontinued', 'Archived'])
    .optional(),
  goals: z.array(updateTreatmentGoalSchema).optional(),
  generalNotes: z.string().optional().nullable(),
})

export const GET: APIRoute = protectRoute()(async ({
  params,
  locals,
}: AuthAPIContext) => {
  try {
    const { user } = locals

    const { planId } = params
    if (!planId) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
      })
    }

    logger.info('Fetching treatment plan', { planId, userId: user.id })

    // Fetch the treatment plan from the database
    const dbPlan = await treatmentPlanDAO.findById(planId)

    if (!dbPlan) {
      return new Response(
        JSON.stringify({ error: 'Treatment plan not found' }),
        { status: 404 },
      )
    }

    // Convert DB plan to the TreatmentPlan type expected by the API
    const plan: TreatmentPlan = {
      id: dbPlan.id ?? String(dbPlan._id),
      clientId: dbPlan.clientId,
      therapistId: dbPlan.therapistId,
      title: dbPlan.title,
      diagnosis: dbPlan.description,
      startDate:
        dbPlan.startDate instanceof Date
          ? dbPlan.startDate.toISOString()
          : String(dbPlan.startDate),
      endDate: dbPlan.endDate
        ? dbPlan.endDate instanceof Date
          ? dbPlan.endDate.toISOString()
          : String(dbPlan.endDate)
        : null,
      status:
        dbPlan.status === 'paused'
          ? 'Discontinued'
          : dbPlan.status === 'draft'
            ? 'Draft'
            : dbPlan.status === 'active'
              ? 'Active'
              : 'Completed',
      generalNotes: dbPlan.notes,
      createdAt:
        dbPlan.createdAt instanceof Date
          ? dbPlan.createdAt.toISOString()
          : String(dbPlan.createdAt),
      updatedAt:
        dbPlan.updatedAt instanceof Date
          ? dbPlan.updatedAt.toISOString()
          : String(dbPlan.updatedAt),
      goals:
        (
          dbPlan.goals as Array<{
            id: string
            title: string
            description: string
            targetDate: string
            priority: string
            status: string
            progress: number
            category: string
            milestones: Array<unknown>
            metrics?: unknown
          }>
        )?.map((goal) => ({
          id: goal.id,
          treatmentPlanId: dbPlan.id ?? String(dbPlan._id),
          description: goal.description,
          targetDate: goal.targetDate ?? null,
          status: goal.status as TreatmentPlan['goals'][number]['status'],
          createdAt:
            dbPlan.createdAt instanceof Date
              ? dbPlan.createdAt.toISOString()
              : String(dbPlan.createdAt),
          updatedAt:
            dbPlan.updatedAt instanceof Date
              ? dbPlan.updatedAt.toISOString()
              : String(dbPlan.updatedAt),
          objectives: [],
        })) ?? [],
    }

    return new Response(JSON.stringify(plan), { status: 200 })
  } catch (error: unknown) {
    logger.error(`Error fetching treatment plan:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch treatment plan.',
        details: error instanceof Error ? String(error) : 'Unknown error',
      }),
      { status: 500 },
    )
  }
})

export const PUT: APIRoute = protectRoute()(async ({
  params,
  request,
  locals,
}: AuthAPIContext) => {
  try {
    const { user } = locals

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
          details: validationResult.error.issues,
        }),
        { status: 400 },
      )
    }

    const updates = validationResult.data

    logger.info('Updating treatment plan', { planId, userId: user.id, updates })

    // Map enhanced status to DB-compatible status
    const statusMap: Record<string, string> = {
      Draft: 'draft',
      Active: 'active',
      Completed: 'completed',
      Discontinued: 'paused',
      Archived: 'draft',
    }

    // Build the update object for the DAO
    const dbUpdates: Partial<TreatmentPlanDB> = {
      updatedAt: new Date(),
    }

    if (updates.title !== undefined) dbUpdates['title'] = updates.title
    if (updates.diagnosis !== undefined)
      dbUpdates['description'] = updates.diagnosis ?? ''
    if (updates.startDate !== undefined)
      dbUpdates['startDate'] = new Date(updates.startDate)
    if (updates.endDate !== undefined)
      dbUpdates['endDate'] = updates.endDate
        ? new Date(updates.endDate)
        : undefined
    if (updates.status !== undefined)
      dbUpdates['status'] = (statusMap[updates.status] ??
        updates.status.toLowerCase()) as TreatmentPlanDB['status']
    if (updates.generalNotes !== undefined)
      dbUpdates['notes'] = updates.generalNotes ?? ''

    // Update in database
    const updatedDbPlan = await treatmentPlanDAO.update(planId, dbUpdates)

    if (!updatedDbPlan) {
      return new Response(
        JSON.stringify({ error: 'Treatment plan not found' }),
        { status: 404 },
      )
    }

    // Convert back to API response type
    const updatedPlan: TreatmentPlan = {
      id: updatedDbPlan.id ?? String(updatedDbPlan._id),
      clientId: updatedDbPlan.clientId,
      therapistId: updatedDbPlan.therapistId,
      title: updatedDbPlan.title,
      diagnosis: updatedDbPlan.description,
      startDate:
        updatedDbPlan.startDate instanceof Date
          ? updatedDbPlan.startDate.toISOString()
          : String(updatedDbPlan.startDate),
      endDate: updatedDbPlan.endDate
        ? updatedDbPlan.endDate instanceof Date
          ? updatedDbPlan.endDate.toISOString()
          : String(updatedDbPlan.endDate)
        : null,
      status: updates.status ?? 'Draft',
      generalNotes: updatedDbPlan.notes,
      createdAt:
        updatedDbPlan.createdAt instanceof Date
          ? updatedDbPlan.createdAt.toISOString()
          : String(updatedDbPlan.createdAt),
      updatedAt:
        updatedDbPlan.updatedAt instanceof Date
          ? updatedDbPlan.updatedAt.toISOString()
          : String(updatedDbPlan.updatedAt),
      goals: (updates.goals as TreatmentPlan['goals']) ?? [],
    }

    return new Response(JSON.stringify(updatedPlan), { status: 200 })
  } catch (error: unknown) {
    logger.error(`Error updating treatment plan:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update treatment plan.',
        details: error instanceof Error ? String(error) : 'Unknown error',
      }),
      { status: 500 },
    )
  }
})
