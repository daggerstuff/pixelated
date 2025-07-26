import type { APIRoute } from 'astro'
import { z } from 'zod'
// nanoid is no longer needed here for plan/goal/objective IDs if DB generates them (UUIDs)
import type {
  TreatmentPlan,
  TreatmentGoal,
  TreatmentObjective,
} from '../../../../types/treatment'

// Zod schemas remain largely the same for input validation structure
// but ID generation is now handled by the database.

const treatmentObjectiveSchema = z.object({
  description: z.string().min(1, 'Objective description is required.'),
  targetDate: z.string().datetime().optional().nullable(), // Allow null for optional dates
  status: z.enum([
    'Not Started',
    'In Progress',
    'Completed',
    'On Hold',
    'Cancelled',
  ]),
  interventions: z
    .array(z.string().min(1))
    .min(1, 'At least one intervention is required.'),
  progressNotes: z.string().optional().nullable(),
})

const treatmentGoalSchema = z.object({
  description: z.string().min(1, 'Goal description is required.'),
  targetDate: z.string().datetime().optional().nullable(),
  status: z.enum([
    'Not Started',
    'In Progress',
    'Achieved',
    'Partially Achieved',
    'Not Achieved',
  ]),
  objectives: z
    .array(treatmentObjectiveSchema)
    .min(1, 'At least one objective is required per goal.'),
})

const newTreatmentPlanClientSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required.'), // This is the patient identifier text
  title: z.string().min(1, 'Treatment plan title is required.'),
  diagnosis: z.string().optional().nullable(),
  startDate: z.string().datetime('Start date must be a valid ISO date string.'),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(['Draft', 'Active', 'Completed', 'Discontinued', 'Archived']),
  goals: z.array(treatmentGoalSchema).min(1, 'At least one goal is required.'),
  generalNotes: z.string().optional().nullable(),
})

export const GET: APIRoute = async ({ locals }) => {
  const { supabase } = locals
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'Supabase client not available.' }),
      { status: 500 },
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'User not authenticated.' }), {
      status: 401,
    })
  }

  try {
    const { data: plans, error: plansError } = await supabase
      .from('treatment_plans')
      .select(
        `
        id,
        client_id,
        therapist_id,
        title,
        diagnosis,
        start_date,
        end_date,
        status,
        general_notes,
        created_at,
        updated_at,
        goals:treatment_goals (
          id,
          description,
          target_date,
          status,
          created_at,
          updated_at,
          objectives:treatment_objectives (*)
        )
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (plansError) {
      throw plansError
    }

    return new Response(JSON.stringify(plans as TreatmentPlan[]), {
      status: 200,
    })
  } catch (error) {
    console.error('Error fetching treatment plans:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch treatment plans.',
        details: message,
      }),
      { status: 500 },
    )
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const { supabase } = locals
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'Supabase client not available.' }),
      { status: 500 },
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'User not authenticated.' }), {
      status: 401,
    })
  }

  try {
    const body = await request.json()
    const validationResult = newTreatmentPlanClientSchema.safeParse(body)

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input data.',
          details: validationResult.error.flatten(),
        }),
        { status: 400 },
      )
    }

    const { goals: clientGoals, ...planBaseData } = validationResult.data

    // Note: For atomicity, these operations should ideally be in a database transaction or a single RPC call.
    // 1. Insert the main plan
    const { data: newPlanData, error: planError } = await supabase
      .from('treatment_plans')
      .insert({
        ...planBaseData,
        user_id: user.id,
        therapist_id: user.id, // Assuming the authenticated user is the therapist creating the plan
      })
      .select_one(
        'id, client_id, therapist_id, title, diagnosis, start_date, end_date, status, general_notes, created_at, updated_at',
      ) // Select necessary fields
      .single()

    if (planError || !newPlanData) {
      console.error('Error inserting plan:', planError)
      throw planError || new Error('Failed to insert plan or no data returned.')
    }

    const planId = newPlanData.id
    const createdGoals: TreatmentGoal[] = []

    // 2. Insert goals and their objectives
    for (const clientGoal of clientGoals) {
      const { objectives: clientObjectives, ...goalBaseData } = clientGoal
      const { data: newGoalData, error: goalError } = await supabase
        .from('treatment_goals')
        .insert({
          ...goalBaseData,
          plan_id: planId,
          user_id: user.id,
        })
        .select_one(
          'id, description, target_date, status, created_at, updated_at',
        )
        .single()

      if (goalError || !newGoalData) {
        console.error('Error inserting goal:', goalError)
        // TODO: Consider rollback logic if a goal or objective fails (ideally handled by DB transaction)
        throw (
          goalError || new Error('Failed to insert goal or no data returned.')
        )
      }
      const goalId = newGoalData.id
      const createdObjectives: TreatmentObjective[] = []

      for (const clientObjective of clientObjectives) {
        const { data: newObjectiveData, error: objectiveError } = await supabase
          .from('treatment_objectives')
          .insert({
            ...clientObjective,
            goal_id: goalId,
            user_id: user.id,
          })
          .select_one('*')
          .single()

        if (objectiveError || !newObjectiveData) {
          console.error('Error inserting objective:', objectiveError)
          throw (
            objectiveError ||
            new Error('Failed to insert objective or no data returned.')
          )
        }
        createdObjectives.push(newObjectiveData as TreatmentObjective)
      }
      createdGoals.push({
        ...newGoalData,
        objectives: createdObjectives,
      } as TreatmentGoal)
    }

    const fullNewPlan: TreatmentPlan = {
      ...(newPlanData as Omit<TreatmentPlan, 'goals'>),
      goals: createdGoals,
    }

    return new Response(JSON.stringify(fullNewPlan), { status: 201 })
  } catch (error) {
    console.error('Error creating treatment plan:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: 'Failed to create treatment plan.',
        details: message,
      }),
      { status: 500 },
    )
  }
}
