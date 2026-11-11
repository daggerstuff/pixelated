import { z } from 'zod'

import { hashPassword } from '../../../../lib/auth/utils'
import { userManager, initializeDatabase } from '../../../../lib/db'
import { WorkspaceResolutionError } from '../../../../lib/db/workspace'

/** Stable response code for a registration that cannot be provisioned. */
const WORKSPACE_UNAVAILABLE_CODE = 'WORKSPACE_UNAVAILABLE'

/**
 * Why a user could not be provisioned for want of a workspace, or `null`.
 *
 * `users.workspace_id` is `NOT NULL` with no default (migration 011). The
 * create path resolves the seeded `personal` workspace before it inserts, so
 * the normal failure is `WorkspaceResolutionError`. A `23502` on that column is
 * still mapped here as a backstop: it is the exact error this route used to
 * answer with an opaque `500`, and it must never do so again.
 */
function describeWorkspaceFailure(error: unknown): string | null {
  if (error instanceof WorkspaceResolutionError) return error.message
  if (!error || typeof error !== 'object') return null

  const candidate = error as {
    code?: unknown
    column?: unknown
    message?: unknown
  }
  if (candidate.code !== '23502') return null

  const column = typeof candidate.column === 'string' ? candidate.column : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  if (!`${column} ${message}`.includes('workspace_id')) return null

  return 'Cannot create the account: no default workspace is provisioned'
}

// Register schema
const RegisterSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(8),
  termsAccepted: z.boolean(),
})

export async function POST({ request }: { request: Request }) {
  try {
    // Initialize database if not already done
    initializeDatabase()

    // Parse request body
    const body = await request.json()

    // Validate request data
    const result = RegisterSchema.safeParse(body)
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result?.error.issues[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { fullName, email, password, termsAccepted } = result.data

    // Additional validation
    if (!termsAccepted) {
      return new Response(
        JSON.stringify({ error: 'You must accept the Terms of Service' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check if user already exists
    const existingUser = await userManager.getUserByEmail(email)
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password) // This will hash the password

    // Split full name
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] ?? ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Create new user
    const userId = await userManager.createUser({
      email,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      role: 'user',
    })

    return new Response(
      JSON.stringify({
        message: 'User registered successfully',
        userId,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    const workspaceFailure = describeWorkspaceFailure(error)
    if (workspaceFailure) {
      return new Response(
        JSON.stringify({
          error: workspaceFailure,
          code: WORKSPACE_UNAVAILABLE_CODE,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
