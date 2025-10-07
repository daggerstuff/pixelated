// import type { APIRoute } from 'astro'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import type {
  TherapeuticGoal,
} from '../../../lib/ai/types/TherapeuticGoals'
import {
  GoalCategory,
  GoalStatus,
} from '../../../lib/ai/types/TherapeuticGoals'

// In-memory storage for demo purposes (replace with DB in production)
export const goals: TherapeuticGoal[] = []

// Zod schema for input validation
const checkpointSchema = z.object({
  id: z.string(),
  description: z.string().max(256),
  isCompleted: z.boolean(),
  completedAt: z.number().optional(),
  notes: z.string().optional(),
})

const progressSnapshotSchema = z.object({
  timestamp: z.number(),
  progressPercent: z.number().min(0).max(100),
  notes: z.string(),
})

export const goalSchema = z.object({
  title: z.string().min(1).max(128),
  description: z.string().max(1024),
  category: z.nativeEnum(GoalCategory),
  status: z.nativeEnum(GoalStatus),
  targetDate: z.number().optional(),
  progress: z.number().min(0).max(100),
  checkpoints: z.array(checkpointSchema),
  progressHistory: z.array(progressSnapshotSchema),
  relatedInterventions: z.array(z.string()),
  relevantDistortions: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

export const GET = async () => {
  // Return all goals (in a real app, filter by user/session)
  return new Response(JSON.stringify(goals), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST = async ({ request }: { request: any }) => {
  try {
    const data = await request.json()
    const parsed = goalSchema.safeParse(data)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: parsed.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const now = Date.now()
    const newGoal: TherapeuticGoal = {
      ...parsed.data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    } as TherapeuticGoal
    goals.push(newGoal)
    return new Response(JSON.stringify(newGoal), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: 'Server error',
        details: err instanceof Error ? (err as Error)?.message || String(err) : String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
