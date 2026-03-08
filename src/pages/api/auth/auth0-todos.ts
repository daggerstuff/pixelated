/**
 * Auth0-based Todos API Endpoint
 * Handles todo operations with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { ObjectId } from 'mongodb'
import { todoDAO } from '@/services/mongodb.dao'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

/**
 * GET /api/auth/auth0-todos - Get all todos for authenticated user
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const todos = await todoDAO.findAll(validation.userId!)

    // Create audit log
    await createAuditLog(
      'todos_access',
      'auth.todos.access',
      validation.userId!,
      'auth-todos',
      { action: 'get_todos', count: todos.length }
    )

    return new Response(
      JSON.stringify({
        success: true,
        todos,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    logError('GET /api/auth/auth0-todos', error)

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.todos.error',
      'anonymous',
      'auth-todos',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch todos',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * POST /api/auth/auth0-todos - Create a new todo
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const todo = await todoDAO.create({
      userId: new ObjectId(validation.userId!),
      name,
      description,
      completed: false,
    })

    // Create audit log
    await createAuditLog(
      'todo_create',
      'auth.todos.create',
      validation.userId!,
      'auth-todos',
      { action: 'create_todo', todoId: todo._id.toString() }
    )

    return new Response(
      JSON.stringify({
        success: true,
        todo,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    logError('POST /api/auth/auth0-todos', error)

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.todos.error',
      'anonymous',
      'auth-todos',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create todo',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
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
    `[auth0-todos.api] ${context} -`,
    err instanceof Error ? err.stack || err.message : String(err),
  )
}

// Rate limiting should be implemented at the edge or via middleware (API gateway,
// reverse proxy, or serverless platform) to keep this handler simple. Example
// approaches: Redis token bucket, Cloudflare Workers KV, or GitHub Actions
// protections for CI-triggered endpoints.