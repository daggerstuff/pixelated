import type { APIRoute } from 'astro'

import { getPool } from '@/lib/db'

import { jsonResponse, requireWorkspaceUser } from '../_lib'

const SCOPED_WHERE =
  '(owner_id = $2 OR $2 = ANY(collaborators) OR is_public = TRUE)'

interface DocumentRow {
  id: string
  title: string
  content: string
  owner_id: string
  collaborators: string[] | null
  version: number
  is_public: boolean
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/workspace/documents/[id] — fetch one document if the caller can
 * see it (owner / collaborator / public). Otherwise 404.
 */
export const GET: APIRoute = async ({ request, params }) => {
  const auth = await requireWorkspaceUser(request)
  if ('response' in auth) return auth.response
  const { user } = auth

  const id = params?.['id']
  if (!id) {
    return jsonResponse({ success: false, error: 'Missing document id' }, 400)
  }

  const result = await getPool().query<DocumentRow>(
    `SELECT id, title, content, owner_id, collaborators, version, is_public,
            created_at, updated_at
     FROM documents
     WHERE id = $1 AND ${SCOPED_WHERE}`,
    [id, user.id],
  )
  if (result.rowCount === 0) {
    return jsonResponse({ success: false, error: 'Document not found' }, 404)
  }
  const r = result.rows[0]

  return jsonResponse({
    success: true,
    document: {
      id: r.id,
      title: r.title,
      content: r.content,
      ownerId: r.owner_id,
      collaborators: r.collaborators ?? [],
      version: r.version,
      isPublic: r.is_public,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    },
  })
}
