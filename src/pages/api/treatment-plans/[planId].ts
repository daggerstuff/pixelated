import type { APIRoute } from 'astro'
import { z } from 'zod'
// nanoid is no longer needed if DB generates UUIDs
import type { TreatmentPlan } from '../../../../types/treatment'

// Zod schemas for update (can be shared or defined if different from index.ts, here kept similar)
const updateTreatmentObjectiveSchema = z
  .object({
    id: z.string().uuid().optional(), // ID for existing objectives, must be UUID
    description: z.string().min(1).optional(),
    targetDate: z.string().datetime().optional().nullable(),
    status: z
      .enum(['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'])
      .optional(),
    interventions: z.array(z.string().min(1)).min(1).optional(),
    progressNotes: z.string().optional().nullable(),
  })
  .passthrough() // Allow other fields not explicitly defined if needed for merging

const updateTreatmentGoalSchema = z
  .object({
    id: z.string().uuid().optional(), // ID for existing goals, must be UUID
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

export const GET: APIRoute = async ({ params, locals }) => {
  const { supabase } = locals
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'Supabase client not found' }),
      { status: 500 },
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
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

  try {
    const { data: plan, error } = await supabase
      .from('treatment_plans')
      .select(
        `
        id, client_id, therapist_id, title, diagnosis, start_date, end_date, status, general_notes, created_at, updated_at,
        goals:treatment_goals (
          id, description, target_date, status, created_at, updated_at,
          objectives:treatment_objectives (*)
        )
      `,
      )
      .eq('id', planId)
      .eq('user_id', user.id) // Ensure user owns the plan
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // PostgREST error for zero rows returned by .single()
        return new Response(
          JSON.stringify({
            error: 'Treatment plan not found or not authorized.',
          }),
          { status: 404 },
        )
      }
      throw error
    }
    return new Response(JSON.stringify(plan as TreatmentPlan), { status: 200 })
  } catch (error) {
    console.error(`Error fetching treatment plan ${planId}:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch treatment plan.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { supabase } = locals
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'Supabase client not found' }),
      { status: 500 },
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
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

  try {
    const body = await request.json()
    const validationResult = updateTreatmentPlanClientSchema.safeParse(body)
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input data.',
          details: validationResult.error.flatten(),
        }),
        { status: 400 },
      )
    }
    const { goals: clientGoals, ...planUpdates } = validationResult.data

    // IMPORTANT: For complex updates involving nested arrays (goals, objectives),
    // a database function (RPC) is STRONGLY recommended for atomicity and correctness.
    // The following is a simplified client-side approach for demonstration and has limitations.

    // 1. Update the main plan details
    const { data: updatedPlanData, error: planUpdateError } = await supabase
      .from('treatment_plans')
      .update(planUpdates)
      .eq('id', planId)
      .eq('user_id', user.id) // Ensure user owns the plan
      .select_one('id') // Check if update was successful and against a valid row
      .single()

    if (planUpdateError) {
      throw planUpdateError
    }
    if (!updatedPlanData) {
      return new Response(
        JSON.stringify({ error: 'Plan not found or update failed.' }),
        { status: 404 },
      )
    }

    // 2. Handle goals and objectives (simplified: upsert based on ID)
    if (clientGoals) {
      for (const clientGoal of clientGoals) {
        const { objectives: clientObjectives, ...goalData } = clientGoal
        if (clientGoal.id) {
          // Existing goal
          const { error: goalUpdateError } = await supabase
            .from('treatment_goals')
            .update(goalData)
            .eq('id', clientGoal.id)
            .eq('plan_id', planId)
          if (goalUpdateError) {
            console.warn(
              `Error updating goal ${clientGoal.id}:`,
              goalUpdateError,
            )
          }
        } else {
          // New goal
          const { error: goalInsertError } = await supabase
            .from('treatment_goals')
            .insert({ ...goalData, plan_id: planId, user_id: user.id })
          if (goalInsertError) {
            console.warn(`Error inserting new goal:`, goalInsertError)
          }
          // For simplicity, we are not getting the new goal ID back here to add objectives in the same pass.
          // A DB function would handle this more gracefully.
        }

        if (clientObjectives && clientGoal.id) {
          // Only update objectives for existing goals in this simplified version
          for (const clientObjective of clientObjectives) {
            const objectiveData = { ...clientObjective }
            if (clientObjective.id) {
              // Existing objective
              const { error: objUpdateError } = await supabase
                .from('treatment_objectives')
                .update(objectiveData)
                .eq('id', clientObjective.id)
                .eq('goal_id', clientGoal.id)
              if (objUpdateError) {
                console.warn(
                  `Error updating objective ${clientObjective.id}:`,
                  objUpdateError,
                )
              }
            } else {
              // New objective
              const { error: objInsertError } = await supabase
                .from('treatment_objectives')
                .insert({
                  ...objectiveData,
                  goal_id: clientGoal.id,
                  user_id: user.id,
                })
              if (objInsertError) {
                console.warn(
                  `Error inserting new objective for goal ${clientGoal.id}:`,
                  objInsertError,
                )
              }
            }
          }
        }
      }
      // Note: Deleting goals/objectives not present in the payload is not handled here.
    }

    // Refetch the updated plan with all its nested data
    const { data: finalUpdatedPlan, error: fetchError } = await supabase
      .from('treatment_plans')
      .select(
        `id, client_id, therapist_id, title, diagnosis, start_date, end_date, status, general_notes, created_at, updated_at, goals:treatment_goals(id, description, target_date, status, created_at, updated_at, objectives:treatment_objectives(*))`,
      )
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      throw fetchError
    }

    return new Response(JSON.stringify(finalUpdatedPlan as TreatmentPlan), {
      status: 200,
    })
  } catch (error) {
    console.error(`Error updating treatment plan ${planId}:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update treatment plan.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { supabase } = locals
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'Supabase client not found' }),
      { status: 500 },
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
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

  try {
    const { error } = await supabase
      .from('treatment_plans')
      .delete()
      .eq('id', planId)
      .eq('user_id', user.id) // Ensure user owns the plan

    if (error) {
      throw error
    }
    // Check if any row was actually deleted if needed, e.g. by checking result.count if API provides it.
    // Here, we assume if no error, it worked or the row didn't exist for this user.

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error(`Error deleting treatment plan ${planId}:`, error)
    return new Response(
      JSON.stringify({
        error: 'Failed to delete treatment plan.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 },
    )
  }
}

// Required for Astro to handle the dynamic route with multiple methods
// export function getStaticPaths() {
//   return [];
// }
// For dynamic server-rendered API routes, getStaticPaths is usually not needed if not pre-rendering.
// If Astro requires it for `[param].ts` API routes to correctly resolve, it should return an empty array for a pure dynamic API.
// However, for API routes, it's often omitted. Let's keep it commented unless a build error occurs.
