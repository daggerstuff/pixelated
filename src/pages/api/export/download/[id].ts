export const prerender = false


import { getSession } from '../../../../lib/auth/session'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Type for export results
interface ExportResult {
  id: string
  data: string | ArrayBuffer
  mimeType: string
  filename: string
  verificationToken?: string
}

// Initialize services
const logger = createBuildSafeLogger('default')

// In-memory store for exports (in a real implementation, this would be in Redis or similar)
const exportStore: Map<string, ExportResult> = new Map<string, ExportResult>()

/**
 * API endpoint for downloading exported conversations
 * GET /api/export/download/:id
 */
export const GET: APIRoute = async ({ params, request }) => {
  try {
    // Verify authentication
    const session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { id } = params
    if (!id) {
      return new Response(JSON.stringify({ error: 'Export ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get export from store
    // In a real implementation, this would fetch from the database or temporary storage
    const exportData = await getExportById(id)
    if (!exportData) {
      return new Response(JSON.stringify({ error: 'Export not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if user has access to this export
    const hasAccess = await checkExportAccess(session.user.id, id)
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this export' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Prepare response
    const responseData =
      typeof exportData.data === 'string'
        ? exportData.data
        : new Uint8Array(exportData.data)

    // Log download for audi
    await recordDownloadAction(session.user.id, id)

    // Return the file
    return new Response(responseData, {
      status: 200,
      headers: {
        'Content-Type': exportData.mimeType,
        'Content-Disposition': `attachment; filename="${exportData.filename}"`,
        'X-Verification-Token': exportData.verificationToken || '',
      },
    })
  } catch (error: unknown) {
    logger.error('Export download API error:', {
      error: error instanceof Error ? String(error) : String(error),
    })
    return new Response(JSON.stringify({ error: 'Download failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Get export data by ID
 */
async function getExportById(id: string): Promise<ExportResult | undefined> {
  // In a real implementation, this would fetch from the database or temporary storage
  return exportStore.get(id)
}

/**
 * Check if user has access to this export
 */
async function checkExportAccess(
  _userId: string,
  _exportId: string,
): Promise<boolean> {
  // In a real implementation, this would check access permissions
  // For this example, we'll assume the check passes
  return true
}

/**
 * Record download action for audit trail
 */
async function recordDownloadAction(
  userId: string,
  exportId: string,
): Promise<void> {
  // In a real implementation, this would record the download in the audit log
  logger.info(`User ${userId} downloaded export ${exportId}`)
}

/**
 * Store export data temporarily
 * In a real implementation, this would use a database or caching system
 */
export async function storeExportData(exportData: ExportResult): Promise<void> {
  exportStore.set(exportData.id, exportData)

  // Set expiration (1 hour)
  setTimeout(
    () => {
      exportStore.delete(exportData.id)
    },
    60 * 60 * 1000,
  )
}
