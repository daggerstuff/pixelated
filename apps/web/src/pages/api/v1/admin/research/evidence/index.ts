import { protectRoute } from '../../../../../../lib/auth/serverAuth'
import {
  getEvidenceReportGenerator,
  type TemplateId,
} from '../../../../../../lib/research/services/EvidenceReportTemplates'

export const prerender = false

export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async () => {
  const generator = getEvidenceReportGenerator()
  const templates = generator.getTemplates()

  return new Response(
    JSON.stringify({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        hypothesisCount: t.hypotheses.length,
        hipaaChecklistCount: t.hipaaChecklist.length,
      })),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    },
  )
})

export const POST = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const body = await request.json()
    const { templateId, customFilters } = body as {
      templateId: TemplateId
      customFilters?: Record<string, unknown>
    }

    if (!templateId) {
      return new Response(JSON.stringify({ error: 'templateId is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      })
    }

    const generator = getEvidenceReportGenerator()
    const validIds = generator.getTemplates().map((t) => t.id)
    if (!validIds.includes(templateId)) {
      return new Response(
        JSON.stringify({
          error: `Invalid templateId. Valid: ${validIds.join(', ')}`,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const generated = await generator.generateFromTemplate(
      templateId,
      customFilters,
    )

    return new Response(
      JSON.stringify({
        report: generated.report,
        template: {
          id: generated.template.id,
          name: generated.template.name,
          category: generated.template.category,
        },
        markdown: generated.markdown,
        hipaaChecklist: generated.hipaaChecklist,
        generatedAt: generated.generatedAt,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Report-Id': generated.report.id,
          'Pragma': 'no-cache',
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  }
})
