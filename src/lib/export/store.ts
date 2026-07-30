/**
 * Export Store
 *
 * Shared in-memory store for export data with ownership tracking.
 * Provides access control functions used by both the download handler
 * and conversation export endpoint.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

// UUID v4 regex pattern for export ID validation
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Initialize logger
const logger = createBuildSafeLogger('default')

/**
 * Export result stored for download access
 * Note: 'data' uses Uint8Array to match ExportService.exportConversation() return type
 * (not ArrayBuffer, which would require a conversion at every call site)
 */
export interface ExportResult {
  id: string
  data: string | Uint8Array
  mimeType: string
  filename: string
  ownerId: string
  verificationToken?: string
}

// In-memory store for exports (in a real implementation, this would be in Redis or similar)
const exportStore: Map<string, ExportResult> = new Map<string, ExportResult>()

/**
 * Validate that a string matches UUID v4 format
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id)
}

/**
 * Get export data by ID
 */
export async function getExportById(
  id: string,
): Promise<ExportResult | undefined> {
  return exportStore.get(id)
}

/**
 * Check if user has access to this export
 * Returns true only if the user owns the export
 */
export async function checkExportAccess(
  userId: string,
  exportId: string,
): Promise<boolean> {
  const exportData = exportStore.get(exportId)
  if (!exportData) {
    return false
  }

  // User must be the owner of the export
  return exportData.ownerId === userId
}

/**
 * Record download action for audit trail
 */
export async function recordDownloadAction(
  userId: string,
  exportId: string,
): Promise<void> {
  // In a real implementation, this would record the download in the audit log
  logger.info(`User ${userId} downloaded export ${exportId}`)
}

/**
 * Store export data temporarily with ownership tracking
 * In a real implementation, this would use a database or caching system
 */
export async function storeExportData(exportData: ExportResult): Promise<void> {
  if (!isValidUUID(exportData.id)) {
    throw new Error('Invalid export ID format')
  }
  if (!exportData.ownerId) {
    throw new Error('Export owner ID is required')
  }

  exportStore.set(exportData.id, exportData)

  // Set expiration (1 hour)
  setTimeout(
    () => {
      exportStore.delete(exportData.id)
    },
    60 * 60 * 1000,
  )
}
