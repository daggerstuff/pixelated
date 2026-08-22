import { getCurrentUser } from '@/lib/auth'

/**
 * Shared auth guard for workspace surface routes (documents, calendar,
 * contacts, gmail). Returns the authenticated user or a 401/403 Response.
 *
 * Guest tokens authenticate but never own workspace data — reject them here
 * so every workspace route enforces the same floor. Ownership scoping
 * (owner_id / collaborators / is_public) is applied in the SQL of each
 * route; cross-user access resolves to 404, not 403, to avoid ID
 * enumeration.
 */
export async function requireWorkspaceUser(request: Request): Promise<
  | {
      user: {
        id: string
        role: string
        accountId?: string
        workspaceId?: string
      }
    }
  | { response: Response }
> {
  const user = await getCurrentUser(request)
  if (!user) {
    return {
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Valid authentication required',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }
  if (user.role === 'guest') {
    return {
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'Forbidden',
          message: 'Guest accounts cannot access workspace data',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }
  return { user }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
