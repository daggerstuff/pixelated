import type { APIRoute } from 'astro'

import { getPool } from '@/lib/db'

import { jsonResponse, requireWorkspaceUser } from '../_lib'

const SCOPED_WHERE =
  '(owner_id = $1 OR $1 = ANY(collaborators) OR is_public = TRUE)'

interface DocumentSummaryRow {
  id: string
  title: string
  owner_id: string
  version: number
  is_public: boolean
  created_at: Date
  updated_at: Date
}

const toSummary = (r: DocumentSummaryRow) => ({
  id: r.id,
  title: r.title,
  ownerId: r.owner_id,
  version: r.version,
  isPublic: r.is_public,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

/**
 * GET /api/workspace/documents — list documents visible to the caller.
 *
 * Scoping predicate matches DocumentService.getDocument exactly
 * (owner / collaborator / public). Cross-user documents are invisible
 * (404 on [id]), not 403, to avoid ID enumeration.
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const params = new URL(request.url).searchParams
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') ?? '50', 10) || 50, 1),
    200,
  )
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)

  const result = await getPool().query<DocumentSummaryRow>(
    `SELECT id, title, owner_id, version, is_public, created_at, updated_at
     FROM documents
     WHERE ${SCOPED_WHERE}
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset],
  )

  return jsonResponse({
    success: true,
    documents: result.rows.map(toSummary),
  })
}

/**
 * POST /api/workspace/documents — create a document owned by the caller.
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  let body: { title?: unknown; content?: unknown; isPublic?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
  }
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return jsonResponse({ success: false, error: 'title is required' }, 400)
  }
  const content = typeof body.content === 'string' ? body.content : ''

  const result = await getPool().query<DocumentSummaryRow>(
    `INSERT INTO documents (title, content, owner_id, is_public)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, owner_id, version, is_public, created_at, updated_at`,
    [body.title.trim(), content, user.id, body.isPublic === true],
  )
  const r = result.rows[0]

  return jsonResponse({ success: true, document: toSummary(r) }, 201)
}
