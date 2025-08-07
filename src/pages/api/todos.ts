export const prerender = false
import { todoDAO } from '@/services/mongodb.dao'
import { verifyAuthToken } from '@/utils/auth'

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

    const { userId } = await verifyAuthToken()
    const todos = await todoDAO.findAll(userId)

    return new Response(JSON.stringify({ todos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Get todos error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to get todos',
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

    const { userId } = await verifyAuthToken()
    const { name, description, completed = false } = await request.json()

    if (!name) {
      return new Response(JSON.stringify({ error: 'Todo name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const todo = await todoDAO.create({
      name,
      description,
      completed,
      userId: userId as any, // Convert string to ObjectId in DAO
    })

    return new Response(JSON.stringify({ success: true, todo }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Create todo error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create todo',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
