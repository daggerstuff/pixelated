import type { APIRoute } from 'astro'
import { protectRoute } from '../../../../../../lib/auth/serverAuth'
import { dslToSQL, createQueryFromRequest, type ResearchQueryRequest } from '../../../../../../lib/research/services/QueryDSL'
import { getQueryOutputFormatter } from '../../../../../../lib/research/services/QueryOutputFormatter'

export const prerender = false

export const POST = protectRoute(
  { requiredRole: 'admin', validateIPMatch: true, validateUserAgent: true },
  async ({ request }) => {
    let body: ResearchQueryRequest
    try {
      body = (await request.json()) as ResearchQueryRequest
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
      )
    }

    if (!body.dsl) {
      return new Response(
        JSON.stringify({ error: 'DSL filter required for this endpoint' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
      )
    }

    const sql = dslToSQL(body.dsl)

    return new Response(
      JSON.stringify({
        sql,
        description: body.description,
        epsilon: body.epsilon ?? 0.1,
        outputFormat: body.outputFormat ?? 'json',
        anonymizationLevel: body.anonymizationLevel ?? 'high',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    )
  },
)
