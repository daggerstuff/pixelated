import type { APIRoute } from 'astro'

import type { TurnQuery, TurnPhase } from '../../../lib/agent-note-collab'
import { formatTurnError } from '../../../lib/agent-note-collab'
import { getLedger } from '../../../lib/agent-note-collab/server'
import { authenticateRequest } from '../../../lib/auth/auth0-middleware'

export const GET: APIRoute = async ({ url, request }) => {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return authResult.response!
  }

  const ledger = getLedger()
  const artifactId = url.searchParams.get('artifactId') || undefined
  const phase = (url.searchParams.get('phase') as TurnPhase) || undefined
  const role = url.searchParams.get('role') || undefined
  const limit = url.searchParams.get('limit')
    ? parseInt(url.searchParams.get('limit')!, 10)
    : undefined
  const sort = (url.searchParams.get('sort') as 'asc' | 'desc') || undefined

  const query: TurnQuery = {
    artifactId,
    phase,
    role,
    limit,
    sort,
  }

  try {
    const turns = await ledger.list(query)
    return new Response(JSON.stringify(turns), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return new Response(JSON.stringify(formatTurnError(error)), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const POST: APIRoute = async ({ request }) => {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return authResult.response!
  }

  const ledger = getLedger()

  try {
    const body = await request.json()
    const result = await ledger.submitTurn(body)

    if (result.ok) {
      return new Response(JSON.stringify(result), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error: unknown) {
    return new Response(JSON.stringify(formatTurnError(error)), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
