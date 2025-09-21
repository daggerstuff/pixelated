import { ObjectId } from 'mongodb'
import { todoDAO } from '../../services/mongodb.dao'
import { verifyAuthToken } from '../../utils/auth'

export const prerender = false

/**
 * Todos API endpoint
 * GET /api/todos - Get all todos for authenticated user
 * POST /api/todos - Create a new todo
 */
export const GET = async ({ request }) => {
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
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch todos',
        message: error instanceof Error ? String(error) : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const POST = async ({ request }) => {
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
    const { name, description } = body

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const todo = await todoDAO.create({
      userId: new ObjectId(userId),
      name,
      description,
      completed: false
    })

    return new Response(JSON.stringify({
      success: true,
      todo
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create todo',
        message: error instanceof Error ? String(error) : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// TODO: Add detailed error logging for better debugging.
// TODO: Implement rate limiting to prevent abuse of the API.
