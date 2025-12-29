import { Pool } from 'pg'
import type { APIRoute } from 'astro'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createEnhancedRateLimiter } from '../../lib/middleware/enhanced-rate-limit'

// Database connection pool
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
})

// Initialize rate limiter
const rateLimiter = createEnhancedRateLimiter(30, 60 * 1000) // 30 requests per minute

// Helper function to get client IP
function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Authentication check
    if (!cookies) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const user = await getCurrentUser(cookies)
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Rate limiting check
    const clientIP = getClientIP(request)
    const rateLimitResult = await rateLimiter.check({
      identifier: user.id,
      role: user.role,
      path: '/api/evaluation',
      clientIp: clientIP,
      userAgent: request.headers.get('user-agent') || 'unknown',
      referer: request.headers.get('referer') || 'unknown',
    })

    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      })
    }

    // Validate query parameters using Zod with stronger validation.
    // This replaces previous manual checks and returns 400 with issue details on failure.
    const url = new URL(request.url)
    const GetQuerySchema = z.object({
      sessionId: z
        .string()
        .min(1, 'sessionId is required')
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          'sessionId must contain only alphanumeric characters, hyphens, and underscores',
        ),
    })

    const parsedQuery = GetQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    )
    if (!parsedQuery.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid query parameters',
          details: parsedQuery.error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { sessionId } = parsedQuery.data

    const client = await pool.connect()
    try {
      // Get evaluations from evaluations table
      const query = `
        SELECT id, session_id, feedback, created_at
        FROM evaluations
        WHERE session_id = $1
        ORDER BY created_at DESC
      `

      const result = await client.query(query, [sessionId])

      // Map/normalize DB rows to documented evaluation shape
      const evaluations = result.rows.map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        feedback: row.feedback,
        createdAt: row.created_at.toISOString(),
      }))

      // Return envelope with sessionId and evaluations array
      const response = {
        sessionId,
        evaluations,
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching evaluations:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  // Authentication check
  if (!cookies) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = await getCurrentUser(cookies)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limiting check
  const clientIP = getClientIP(request)
  const rateLimitResult = await rateLimiter.check({
    identifier: user.id,
    role: user.role,
    path: '/api/evaluation',
    clientIp: clientIP,
    userAgent: request.headers.get('user-agent') || 'unknown',
    referer: request.headers.get('referer') || 'unknown',
  })

  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      },
    })
  }

  // Zod schema: sessionId required string, feedback required non-empty string OR non-empty object
  const PostBodySchema = z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
    feedback: z.union([
      z.string().min(1, 'feedback must be a non-empty string'),
      z
        .object({})
        .catchall(z.any())
        .refine((obj) => Object.keys(obj).length > 0, {
          message: 'feedback object must not be empty',
        }),
    ]),
  })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsedBody = PostBodySchema.safeParse(body)
  if (!parsedBody.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid body',
        details: parsedBody.error.issues,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { sessionId, feedback } = parsedBody.data

  const client = await pool.connect()
  let transactionStarted = false
  try {
    await client.query('BEGIN')
    transactionStarted = true

    // Insert evaluation, feedback as JSON or string
    const insertQuery = `
      INSERT INTO evaluations (session_id, feedback, created_at)
      VALUES ($1, $2, NOW())
      RETURNING id
    `
    const feedbackValue =
      typeof feedback === 'string' ? feedback : JSON.stringify(feedback)
    const insertResult = await client.query(insertQuery, [
      sessionId,
      feedbackValue,
    ])
    const evaluationId = insertResult.rows[0]?.id

    // Update session with latest evaluation feedback
    const updateQuery = `
      UPDATE sessions
      SET context = jsonb_set(
        COALESCE(context, '{}'::jsonb),
        '{latestEvaluation}',
        $1::jsonb
      ),
      updated_at = NOW()
      WHERE id = $2
    `
    await client.query(updateQuery, [
      JSON.stringify({
        feedback,
        timestamp: new Date().toISOString(),
        evaluator: 'therapist',
      }),
      sessionId,
    ])

    await client.query('COMMIT')

    return new Response(JSON.stringify({ success: true, evaluationId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch {}
    }
    console.error('Error saving evaluation:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } finally {
    client.release()
  }
}
