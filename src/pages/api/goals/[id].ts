import type { APIRoute, APIContext } from 'astro'
import type { TherapeuticGoal } from '../../../lib/ai/types/TherapeuticGoals'
import { goalSchema, goals } from './index' // Reuse schema if possible

export const GET: APIRoute = async ({ params }: { params: unknown }) => {
  const { id } = params as { id: string }
  const goal = goals.find((g: TherapeuticGoal) => g.id === id)
  if (!goal) {
    return new Response(JSON.stringify({ error: 'Goal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify(goal), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const PUT: APIRoute = async ({
  params,
  request,
}: {
  params: unknown
  request: unknown
}) => {
  const { id } = params as { id: string }

  if (typeof id !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid ID format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const idx = goals.findIndex((g: TherapeuticGoal) => g.id === id)
  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Goal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const data = await (request as Request).json()
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
    const existingGoal = goals[idx]
    if (!existingGoal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const updatedGoal = {
      ...parsed.data,
      id,
      createdAt: existingGoal.createdAt,
      updatedAt: Date.now(),
    } as TherapeuticGoal
    goals[idx] = updatedGoal
    return new Response(JSON.stringify(updatedGoal), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Server error',
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const DELETE: APIRoute = async ({ params }: { params: unknown }) => {
  const { id } = params as { id: string }
  const idx = goals.findIndex((g: TherapeuticGoal) => g.id === id)
  if (idx === -1) {
    return new Response(JSON.stringify({ error: 'Goal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  goals.splice(idx, 1)
  return new Response(null, { status: 204 })
}

export const prerender = false
