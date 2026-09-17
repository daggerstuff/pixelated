import { createAuditLog, AuditEventType, AuditEventStatus } from '@/lib/audit'
import { getSession, type Session } from '@/lib/auth/session.js'

/**
 * POST /api/ai/quad-audit
 *
 * Gateway proxy to the pe quadit audit service (POST /api/v1/audits).
 * Runs the adversarial quad-audit — three clinical judges plus the
 * Brené Brown auditor persona — over submitted content items.
 *
 * Auth: admin session required (the admin Quad Audit UI page calls this).
 * The downstream pe service enforces the educator+ role via its own JWT;
 * the gateway presents QUADIT_AUDIT_SERVICE_TOKEN for that hop.
 */

const QUADIT_AUDIT_SERVICE_URL =
  (import.meta.env['QUADIT_AUDIT_SERVICE_URL'] as string | undefined) ??
  process.env['QUADIT_AUDIT_SERVICE_URL'] ??
  ''

const QUADIT_AUDIT_SERVICE_TOKEN =
  (import.meta.env['QUADIT_AUDIT_SERVICE_TOKEN'] as string | undefined) ??
  process.env['QUADIT_AUDIT_SERVICE_TOKEN'] ??
  ''

const QUADIT_AUDIT_TIMEOUT_MS = 120_000

const MAX_ITEMS = 50
const MAX_CONTENT_CHARS = 8_000

interface AuditItemIn {
  id: string
  kind?: string
  author_role?: string
  content: string
  context?: Record<string, string>
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validateRequestBody(
  raw: unknown,
): { items: AuditItemIn[]; mode: string } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Request body must be a JSON object.' }
  }
  const body = raw as Record<string, unknown>

  const items = body['items']
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'items must be a non-empty array.' }
  }
  if (items.length > MAX_ITEMS) {
    return { error: `items exceeds the ${MAX_ITEMS} item limit.` }
  }

  const converted: AuditItemIn[] = []
  for (const candidate of items) {
    if (!candidate || typeof candidate !== 'object') {
      return { error: 'Each item must be an object.' }
    }
    const item = candidate as Record<string, unknown>
    const id = item['id']
    const content = item['content']
    if (typeof id !== 'string' || id.length === 0) {
      return { error: 'Each item requires a non-empty id.' }
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { error: `Item ${id} requires non-empty content.` }
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return {
        error: `Item ${id} exceeds the ${MAX_CONTENT_CHARS} character limit.`,
      }
    }
    converted.push({
      id,
      kind: typeof item['kind'] === 'string' ? item['kind'] : 'ai_response',
      author_role:
        typeof item['author_role'] === 'string' ? item['author_role'] : '',
      content,
    })
  }

  const mode = body['mode']
  if (mode !== undefined && mode !== 'deterministic' && mode !== 'llm') {
    return { error: "mode must be 'deterministic' or 'llm'." }
  }

  return { items: converted, mode: mode === 'llm' ? 'llm' : 'deterministic' }
}

export const POST = async ({ request }: { request: Request }) => {
  let session: Session | null = null

  try {
    session = await getSession(request)
    if (!session?.user || session.user.role !== 'admin') {
      return jsonResponse(
        { error: 'Forbidden: Admin access required' },
        session?.user ? 403 : 401,
      )
    }

    if (!QUADIT_AUDIT_SERVICE_URL) {
      return jsonResponse(
        { error: 'Quadit audit service is not configured.' },
        503,
      )
    }
    if (!QUADIT_AUDIT_SERVICE_TOKEN) {
      return jsonResponse(
        { error: 'Quadit audit service credentials are not configured.' },
        503,
      )
    }

    const raw: unknown = await request.json().catch(() => null)
    const validated = validateRequestBody(raw)
    if ('error' in validated) {
      return jsonResponse({ error: validated.error }, 422)
    }

    const upstream = await fetch(QUADIT_AUDIT_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QUADIT_AUDIT_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        items: validated.items,
        mode: validated.mode,
      }),
      signal: AbortSignal.timeout(QUADIT_AUDIT_TIMEOUT_MS),
    })

    if (!upstream.ok) {
      const errorBody: unknown = await upstream.json().catch(() => null)
      return jsonResponse(
        {
          error:
            (errorBody as Record<string, unknown> | null)?.['detail'] ??
            `Quadit audit service error (HTTP ${upstream.status}).`,
        },
        upstream.status === 401 || upstream.status === 403
          ? 502
          : upstream.status,
      )
    }

    const report: unknown = await upstream.json()

    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.quadit.audit.response',
      session.user.id,
      'ai',
      {
        itemCount: validated.items.length,
        mode: validated.mode,
        passed: (report as Record<string, unknown>)['passed'],
      },
      AuditEventStatus.SUCCESS,
    )

    return jsonResponse(report, 200)
  } catch (error: unknown) {
    console.error('Error running quadit audit:', error)
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.quadit.audit.error',
      session?.user?.id ?? 'unknown',
      'ai',
      { error: error instanceof Error ? error.message : 'unknown' },
      AuditEventStatus.FAILURE,
    )
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      500,
    )
  }
}
