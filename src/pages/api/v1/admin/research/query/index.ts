import type { APIRoute } from 'astro'

import { protectRoute } from '../../../../../../lib/auth/serverAuth'
import { researchPlatform } from '../../../../../../lib/research/ResearchPlatform'
import { getQueryAuditService } from '../../../../../../lib/research/services/QueryAuditService'
import {
  createQueryFromRequest,
  type ResearchQueryRequest,
} from '../../../../../../lib/research/services/QueryDSL'
import { getQueryOutputFormatter } from '../../../../../../lib/research/services/QueryOutputFormatter'
import type { QueryResult } from '../../../../../../lib/research/types/research-types'

export const prerender = false

export const POST = protectRoute(
  { requiredRole: 'admin', validateIPMatch: true, validateUserAgent: true },
  async ({ request }) => {
    let body: ResearchQueryRequest
    try {
      body = (await request.json()) as ResearchQueryRequest
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      })
    }

    if (!body.description) {
      return new Response(
        JSON.stringify({ error: 'Query description required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const query = createQueryFromRequest(body, 'admin')

    const userId = 'admin'
    const userRole = 'admin'
    const epsilon =
      typeof body.epsilon === 'number'
        ? body.epsilon
        : (query.parameters['epsilon'] as number) || 0.1

    const result = await researchPlatform.executeResearchQuery(
      query,
      userId,
      userRole,
    )
    const queryResult = result as unknown as QueryResult

    const auditService = getQueryAuditService()
    const executionTime = queryResult.metadata?.executionTime ?? 0
    const cacheHit = queryResult.metadata?.cacheHit ?? false
    auditService.logQuery(
      query,
      userId,
      userRole,
      queryResult,
      epsilon,
      executionTime,
      cacheHit,
    )

    const outputFormat = body.outputFormat ?? 'json'
    const formatter = getQueryOutputFormatter()
    const formatted = formatter.format(
      queryResult,
      outputFormat,
      body.description,
    )

    if (outputFormat === 'json') {
      return new Response(formatted.content, {
        status: 200,
        headers: {
          'Content-Type': formatted.mimeType,
          'Cache-Control': 'no-store',
          'X-Query-Id': query.id,
        },
      })
    }

    return new Response(formatted.content, {
      status: 200,
      headers: {
        'Content-Type': formatted.mimeType,
        'Content-Disposition': `attachment; filename="${formatted.filename}"`,
        'Cache-Control': 'no-store',
        'X-Query-Id': query.id,
      },
    })
  },
)

export const GET = protectRoute(
  { requiredRole: 'admin', validateIPMatch: true, validateUserAgent: true },
  async () => {
    return new Response(
      JSON.stringify({
        endpoint: 'research-query-execute',
        method: 'POST',
        description: 'Execute a HIPAA-compliant research query',
        queryTypes: [
          'sql',
          'pattern-discovery',
          'longitudinal-analysis',
          'cohort-comparison',
          'aggregate-analysis',
        ],
        outputFormats: ['json', 'csv', 'summary'],
        anonymizationLevels: ['none', 'low', 'medium', 'high'],
        defaultEpsilon: 0.1,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    )
  },
)
