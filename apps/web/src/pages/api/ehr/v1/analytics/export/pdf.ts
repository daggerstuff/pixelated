import PDFDocument from 'pdfkit'

import {
  resolveTenantId,
  requireEHRPermission,
  ehrValidationError,
  sanitizeSearchParam,
} from '@/lib/ehr-native/api'
import {
  AnalyticsService,
  canAccessDashboard,
  DASHBOARD_TYPES,
  type DashboardType,
  type DashboardFilter,
} from '@/lib/ehr-native/services'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'

/**
 * POST /api/ehr/v1/analytics/export/pdf
 * Generates a server-side PDF export of dashboard metrics.
 *
 * Body:
 *   type (required) — dashboard type
 *   filter (optional) — dashboard filter (timeRange, provider, location, payer)
 *   title (optional) — custom report title
 * @returns 200 with PDF binary (application/pdf), or 403/400
 */
export const POST = withV1Contract(
  'exportDashboardPDF',
  async (ctx, caller) => {
    const tenantId = resolveTenantId(caller.user.accountId)
    if (!tenantId)
      return ehrValidationError('Tenant association required for EHR access.')

    const raw = await ctx.request.json().catch(() => null)
    if (!raw) return ehrValidationError('Request body must be valid JSON.')

    const rawType = raw.type
    if (!rawType || typeof rawType !== 'string')
      return ehrValidationError('type is required in request body.')

    const type = sanitizeSearchParam(rawType, 20) as DashboardType
    if (!DASHBOARD_TYPES.includes(type))
      return ehrValidationError(
        `type must be one of: ${DASHBOARD_TYPES.join(', ')}`,
      )

    if (!canAccessDashboard(caller.user.role as any, type))
      return ehrValidationError(
        `Your role does not have permission to access the ${type} dashboard.`,
      )

    // PDF export requires export_phi permission (PHI in dashboard data)
    const perm = await requireEHRPermission(
      caller.user.role,
      'export_phi',
      caller.user.id,
      tenantId,
    )
    if (!perm.allowed) return perm.response

    const filter: DashboardFilter = raw.filter ?? {}
    if (filter.providerId)
      filter.providerId = sanitizeSearchParam(filter.providerId, 64)
    if (filter.siteId) filter.siteId = sanitizeSearchParam(filter.siteId, 64)
    if (filter.payerId) filter.payerId = sanitizeSearchParam(filter.payerId, 64)

    const service = new AnalyticsService(perm.rlsContext)

    let metrics: Record<string, unknown>
    try {
      metrics = (await service.getDashboard(
        type,
        caller.user.role as any,
        filter,
      )) as Record<string, unknown>
    } catch (err) {
      return ehrValidationError(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve dashboard data for export.',
      )
    }

    // Build PDF
    const title = (raw.title as string) || `EHR Dashboard — ${type}`
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).font('Helvetica').fillColor('#666')
    doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' })
    doc.text(`User: ${caller.user.id} | Role: ${caller.user.role}`, {
      align: 'center',
    })
    if (filter.timeRange) {
      doc.text(`Period: ${filter.timeRange.start} to ${filter.timeRange.end}`, {
        align: 'center',
      })
    }
    doc.moveDown(1)
    doc.fillColor('#000')

    // Render metrics sections
    const renderSection = (label: string, data: unknown, depth = 0) => {
      if (data === null || data === undefined) return
      const indent = depth * 15
      if (typeof data === 'number') {
        doc.fontSize(10).font('Helvetica')
        doc.text(`${label}: ${data.toLocaleString()}`, indent + 50)
      } else if (typeof data === 'string') {
        doc.fontSize(10).font('Helvetica')
        doc.text(`${label}: ${data}`, indent + 50)
      } else if (typeof data === 'boolean') {
        doc.fontSize(10).font('Helvetica')
        doc.text(`${label}: ${data ? 'Yes' : 'No'}`, indent + 50)
      } else if (Array.isArray(data)) {
        doc.fontSize(11).font('Helvetica-Bold')
        doc.text(`${label} (${data.length} items)`, indent + 50)
        doc.moveDown(0.2)
        data.forEach((item, i) => {
          renderSection(`${i + 1}`, item, depth + 1)
        })
        doc.moveDown(0.3)
      } else if (typeof data === 'object') {
        if (depth === 0) {
          doc.fontSize(13).font('Helvetica-Bold')
          doc.text(label, { underline: true })
          doc.moveDown(0.3)
        } else {
          doc.fontSize(11).font('Helvetica-Bold')
          doc.text(label, indent + 50)
          doc.moveDown(0.2)
        }
        for (const [key, value] of Object.entries(
          data as Record<string, unknown>,
        )) {
          renderSection(key, value, depth + 1)
        }
        doc.moveDown(0.3)
      }
    }

    renderSection('Dashboard Metrics', metrics)

    // Footer
    doc.moveDown(2)
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#999')
    doc.text(
      'This document contains Protected Health Information (PHI). Handle per HIPAA compliance guidelines.',
      { align: 'center' },
    )

    doc.end()

    // Wait for PDF to finish
    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve())
    })

    const pdfBuffer = Buffer.concat(chunks)

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dashboard-${type}-${Date.now()}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  },
)
