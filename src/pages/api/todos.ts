import type { APIRoute, APIContext } from 'astro'
import { todoDAO } from '../../services/mongodb.dao'
import { verifyAuthToken } from '../../utils/auth'

export const prerender = false

/**
 * Todos API endpoint
 * GET /api/todos - Get all todos for authenticated user
 * POST /api/todos - Create a new todo
 */
export const GET: APIRoute = async ({ request }: APIContext) => {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { userId } = await verifyAuthToken(authHeader)
    const todos = await todoDAO.findAll(userId)

    return new Response(JSON.stringify({ 
      success: true,
      todos 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to fetch todos',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const POST: APIRoute = async ({ request }: APIContext) => {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const { userId } = await verifyAuthToken(authHeader)
    const body = await request.json()
    const { title, description, priority = 'medium' } = body

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const todo = await todoDAO.create({
      userId,
      title,
      description,
      priority,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return new Response(JSON.stringify({ 
      success: true,
      todo 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to create todo',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
