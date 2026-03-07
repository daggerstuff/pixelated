/**
 * Compatible APIRoute type for Astro API routes (define locally)
 */
// type APIRoute = (context: { request: Request }) => Promise<Response> | Response;

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import { DocumentationSystem } from '../../../lib/documentation/DocumentationSystem'
import { AIRepository } from '../../../lib/db/ai/repository'

const logger = createBuildSafeLogger('documentation-api')

// Dependency injection for DocumentationSystem
const repository = new AIRepository()
// TODO: Replace with real API keys/config in production
const aiService = {
  // Minimal stub to satisfy AIService interface for documentation export (not used for read-only export)
  getModelInfo: () => {
    throw new Error('Not implemented')
  },
  createChatCompletion: () => {
    throw new Error('Not implemented')
  },
  createStreamingChatCompletion: () => {
    throw new Error('Not implemented')
  },
  dispose: () => {},
}
const documentationSystem = new DocumentationSystem(repository, aiService)

export const GET = async ({ request }) => {
  try {
    // Authenticate request
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be authenticated to access this endpoint',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const sessionId =
      url.searchParams.get('session') || url.searchParams.get('section')

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'session parameter is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Get documentation data
    const documentation = await documentationSystem.getDocumentation(sessionId)
    if (!documentation) {
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: `No documentation found for session: ${sessionId}`,
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Format response based on requested format
    let contentType = 'application/json'
    let body: string | Uint8Array = ''

    if (format === 'json') {
      body = JSON.stringify(documentation)
      contentType = 'application/json'
    } else if (format === 'markdown') {
      // Markdown formatting for available fields only
      body =
        `# Session Documentation\n\n` +
        `**Session ID:** ${documentation.sessionId}\n\n` +
        `**Client ID:** ${documentation.clientId}\n\n` +
        `**Therapist ID:** ${documentation.therapistId}\n\n` +
        `**Start Time:** ${documentation.startTime}\n\n` +
        (documentation.endTime
          ? `**End Time:** ${documentation.endTime}\n\n`
          : '') +
        `**Notes:**\n${documentation.notes}\n\n` +
        `**Interventions:**\n${documentation.interventions.map((i) => `- ${i}`).join('\n')}\n\n` +
        `**Outcomes:**\n${documentation.outcomes.map((i) => `- ${i}`).join('\n')}\n\n` +
        `**Next Steps:**\n${documentation.nextSteps.map((i) => `- ${i}`).join('\n')}\n\n` +
        `**Risk Assessment:**\n` +
        `- Level: ${documentation.riskAssessment.level}\n` +
        `- Requires Immediate Attention: ${documentation.riskAssessment.requiresImmediateAttention}\n` +
        `- Factors: ${documentation.riskAssessment.factors.map((f) => `  - ${f}`).join('\n')}\n` +
        `- Recommendations: ${documentation.riskAssessment.recommendations.map((r) => `  - ${r}`).join('\n')}\n`
      contentType = 'text/markdown'
    } else if (format === 'pdf') {
      // PDF export not implemented
      return new Response(
        JSON.stringify({
          error: 'Not Implemented',
          message: 'PDF export is not implemented in this API endpoint.',
        }),
        {
          status: 501,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    } else {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: `Unsupported format: ${format}`,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="documentation.${format}"`,
      },
    })
  } catch (error: unknown) {
    logger.error('Error exporting documentation:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? String(error) : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
