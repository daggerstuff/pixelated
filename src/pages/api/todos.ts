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
    await logError('GET /api/todos', error)
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
    await logError('POST /api/todos', error)
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
async function logError(context: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const error = err instanceof Error
    ? err
    : new Error(`[todos.api] ${context} - ${message}`)
  try {
    const { captureException } = await import('@sentry/node')
    captureException(error, {
      tags: { source: 'todos-api', context },
      extra: {
        context,
        rawMessage: message,
      },
    })
  } catch {
    // Sentry optional dependency; keep error handling side-effect free on failure.
  }
}

// Rate limiting should be implemented at the edge or via middleware (API gateway,
// reverse proxy, or serverless platform) to keep this handler simple. Example
// approaches: Redis token bucket, Cloudflare Workers KV, or GitHub Actions
// protections for CI-triggered endpoints.
