import { ObjectId } from 'mongodb'
import { todoDAO } from '../../services/mongodb.dao'
import { verifyAuthToken } from '../../utils/auth'

export const prerender = false

/**
 * Todos API endpoint
 * GET /api/todos - Get all todos for authenticated user
 * POST /api/todos - Create
 * NOTE: Rate-limiting and pagination will be added post-beta launch. See project runbooks for rate-limit thresholds.
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

    return new Response(
      JSON.stringify({
        success: true,
        todos,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logError('GET /api/todos', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch todos',
        message: error instanceof Error ? String(error) : 'Unknown error',
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
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const todo = await todoDAO.create({
      userId: new ObjectId(userId),
      name,
      description,
      completed: false,
    })

    return new Response(
      JSON.stringify({
        success: true,
        todo,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logError('POST /api/todos', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create todo',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Provide minimal structured error logging to aid debugging in CI and local
// development. For production-grade logging, route these through the
// project's centralized logging (e.g., Sentry) and include request IDs.
function logError(context: string, err: unknown) {
  // Avoid exposing sensitive details in responses; these logs are for server-side
  // investigation only. Replace with Sentry.captureException or similar as needed.
  console.error(
    `[todos.api] ${context} -`,
    err instanceof Error ? err.stack || err.message : String(err),
  )
}

// Rate limiting should be implemented at the edge or via middleware (API gateway,
// reverse proxy, or serverless platform) to keep this handler simple. Example
// approaches: Redis token bucket, Cloudflare Workers KV, or GitHub Actions
// protections for CI-triggered endpoints.
