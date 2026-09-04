import { v4 as uuidv4 } from 'uuid'

import { dataExportDAO } from '../mongodb.dao'
import { createAuditLog, AuditEventType } from '../../audit'
import { userManager } from '../../db'
import { aiRepository } from '../../db/ai'
import mongoClient from '../../db/mongoClient'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('data-portability-service')

interface DataExportRequest {
  id: string
  patientId: string
  formats: ExportFormat[]
  dataTypes: string[]
  reason: string
  priority: ExportPriority
  requestedBy: string
  status: ExportStatus
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  files?: ExportFile[]
  error?: string
}

interface CreateDataExportParams {
  patientId: string
  initiatedBy: string
  recipientType: 'provider' | 'patient' | 'research'
  recipientName: string
  recipientEmail: string
  dataFormat: 'json' | 'csv' | 'fhir' | 'ccd' | 'hl7'
  dataSections: string[]
}

interface DataExportResult {
  exportRequest: DataExportRequest
  message: string
  success: boolean
}

// Define the PatientProfile interface
interface PatientProfile {
  patient_id?: string
  last_name?: string
  first_name?: string
  date_of_birth?: string
  gender?: string
  // Add other properties as needed based on actual patient_profiles table structure
}

// Define the export status types
type ExportStatus =
  'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled'

// Define the export formats
export type ExportFormat = 'json' | 'csv' | 'pdf' | 'xml'

// Export request interface
interface ExportRequest {
  patientId: string
  format: ExportFormat
  initiatedBy: string
  includeCategories?: string[]
  dateRange?: {
    start?: string
    end?: string
  }
}

interface ExportResult {
  success: boolean
  exportId?: string
  status?: ExportStatus
  downloadUrl?: string
  createdAt?: Date
  updatedAt?: Date
  error?: string
  message?: string
}

// Export status response
interface ExportStatusResponse {
  success: boolean
  exportId: string
  status: ExportStatus
  progress: number
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  expiresAt?: Date
  downloadUrl?: string
  format: ExportFormat
  dataTypes: string[]
  estimatedCompletionTime?: Date
  error?: string
  message?: string
}

// Export download response for successful operations
interface ExportDownloadSuccessResponse {
  success: true
  exportId: string
  format: ExportFormat
  filename?: string
  fileData?: Uint8Array | string
  downloadUrl?: string
  expiresAt?: Date
}

// Export download response for errors
interface ExportDownloadErrorResponse {
  success: false
  error:
    'not_found' | 'unauthorized' | 'not_ready' | 'expired' | 'internal_error'
  message?: string
  status?: ExportStatus
  progress?: number
  estimatedCompletionTime?: Date
  expiredAt?: Date
}

// Combined type for download responses
type ExportDownloadResponse =
  ExportDownloadSuccessResponse | ExportDownloadErrorResponse

type ExportPriority = 'normal' | 'high'

type ExportFile = {
  id: string
  exportId: string
  format: ExportFormat
  dataType: string
  url: string
  size: number
  createdAt: Date
  content?: string
}

type ExportRequestInput = {
  patientId: string
  formats: ExportFormat[]
  dataTypes: string[]
  reason: string
  priority: ExportPriority
  requestedBy: string
}

type ExportResponse = {
  success: boolean
  exportId?: string
  status?: ExportStatus
  createdAt?: Date
  files?: ExportFile[]
  error?: string
  message?: string
}

// Add missing interface for extended DataExportRequest with format
interface DataExportRequestWithFormat extends DataExportRequest {
  format: ExportFormat
  dataFormat: string
  downloadUrl?: string
  recipientEmail?: string
}

// Interface for profile data
/**
 * Create a new data export request
 */
export async function createDataExportRequest(
  input: ExportRequestInput,
): Promise<ExportResponse> {
  try {
    // Verify patient exists
    const patient = (await userManager.getUserById(input.patientId)) as {
      id: string
    } | null

    if (!patient) {
      logger.warn('Export request for non-existent patient', {
        patientId: input.patientId,
      })
      return {
        success: false,
        error: 'not_found',
        message: 'Patient not found',
      }
    }

    // Verify user has access to patient data
    const hasAccess = await verifyPatientDataAccess(
      input.patientId,
      input.requestedBy,
    )
    if (!hasAccess) {
      logger.warn('Unauthorized export request', {
        patientId: input.patientId,
        requestedBy: input.requestedBy,
      })
      return {
        success: false,
        error: 'unauthorized',
        message: "Not authorized to export this patient's data",
      }
    }

    // Create export record
    const exportId = uuidv4()
    const now = new Date()

    const exportRequest: DataExportRequest = {
      id: exportId,
      patientId: input.patientId,
      formats: input.formats,
      dataTypes: input.dataTypes,
      reason: input.reason,
      priority: input.priority,
      requestedBy: input.requestedBy,
      status: 'pending',
      createdAt: now,
    }

    // Save to database
    await dataExportDAO.create({
      id: exportRequest.id,
      patientId: exportRequest.patientId,
      requestedBy: exportRequest.requestedBy,
      formats: exportRequest.formats,
      dataTypes: exportRequest.dataTypes,
      reason: exportRequest.reason,
      priority: exportRequest.priority,
      status: exportRequest.status,
      createdAt: exportRequest.createdAt,
    })

    // Trigger export job (will be processed asynchronously)
    await queueExportJob(exportRequest)

    logger.info('Data export request created', {
      exportId,
      patientId: input.patientId,
      requestedBy: input.requestedBy,
    })

    return {
      success: true,
      exportId: exportId,
      status: 'pending',
      createdAt: now,
      message: 'Export request created successfully',
    }
  } catch (error: unknown) {
    logger.error('Error creating export request', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? error?.stack : undefined,
      input,
    })

    return {
      success: false,
      error: 'internal_error',
      message: 'Failed to create export request due to an internal error',
    }
  }
}

/**
 * Get detailed information about a data export request
 */
export async function getDataExportDetails(
  exportId: string,
  userId: string,
): Promise<ExportStatusResult> {
  try {
    // Get the export request
    const exportRequest = await getDataExportRequest(exportId)

    if (!exportRequest) {
      logger.warn('Export request not found for status check', { exportId })
      return {
        success: false,
        error: 'not_found',
        message: `Export request with ID ${exportId} not found`,
      }
    }

    // Check if the user has permission to view this export
    // In a real implementation, this would check relationship with the patient
    // and other access controls
    const isInitiator = userId === exportRequest.requestedBy
    const isAuthorized = isInitiator // Replace with actual authorization check

    if (!isAuthorized) {
      logger.warn('User not authorized to view export status', {
        userId,
        exportId,
        requestedBy: exportRequest.requestedBy,
      })

      return {
        success: false,
        error: 'unauthorized',
        message: 'You are not authorized to view this export request',
      }
    }

    // Calculate progress based on status
    let progress = 0
    switch (exportRequest.status) {
      case 'pending':
        progress = 0
        break
      case 'processing':
        // In a real implementation, this might come from a progress tracker
        progress = 50
        break
      case 'completed':
        progress = 100
        break
      case 'failed':
        progress = 100
        break
      case 'cancelled':
        progress = 100
        break
      case 'expired':
        progress = 100
        break
      default:
        progress = 0
    }

    // Calculate estimated completion time
    // In a real implementation, this would be more sophisticated
    const createdAt = new Date(exportRequest.createdAt)
    const estimatedCompletionTime = new Date(
      createdAt.getTime() + 5 * 60 * 1000,
    ) // 5 minutes from creation

    // Calculate download URL expiration
    // In a real implementation, this would come from the storage service
    const completedAt = exportRequest.completedAt
      ? new Date(exportRequest.completedAt)
      : null
    const expiresAt = completedAt
      ? new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)
      : null // 24 hours after completion

    logger.info('Export status retrieved successfully', {
      exportId,
      status: exportRequest.status,
    })

    // Cast to get access to format property (even though it's not there, this helps TypeScript)
    const typedExportRequest =
      exportRequest as unknown as DataExportRequestWithFormat

    // Return the status information
    return {
      success: true,
      exportId: exportRequest.id,
      status: exportRequest.status,
      progress,
      createdAt: exportRequest.createdAt.toISOString(),
      updatedAt: exportRequest.completedAt
        ? exportRequest.completedAt.toISOString()
        : exportRequest.createdAt.toISOString(),
      estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      completedAt: exportRequest.completedAt
        ? exportRequest.completedAt.toISOString()
        : undefined,
      downloadUrl: exportRequest.files?.find(
        (f) => f.format === typedExportRequest.format,
      )?.url,
      expiresAt: expiresAt?.toISOString(),
      formats: [typedExportRequest.format],
      dataTypes: exportRequest.dataTypes,
      patientId: exportRequest.patientId,
      requestedBy: exportRequest.requestedBy,
      priority: 'normal',
    }
  } catch (error: unknown) {
    logger.error('Error getting export status', {
      error: error instanceof Error ? String(error) : String(error),
      exportId,
      userId,
    })

    return {
      success: false,
      message: `Failed to get export status: ${error instanceof Error ? String(error) : String(error)}`,
    }
  }
}

/**
 * Queue an export job for asynchronous processing
 * @param exportRequest Export request data
 */
async function queueExportJob(exportRequest: DataExportRequest): Promise<void> {
  try {
    // Here we would typically queue a job to a background worker
    // For this example, we'll simulate starting the export process

    // In production, use a proper job queue like Bull, Celery, or a cloud service
    setTimeout(() => {
      processExportRequest(exportRequest.id).catch((err) =>
        logger.error('Error in export processing job', {
          error: (err as Error)?.message || String(err),
          stack: (err as Error)?.stack,
          exportId: exportRequest.id,
        }),
      )
    }, 100)

    logger.info('Export job queued', { exportId: exportRequest.id })
  } catch (error: unknown) {
    logger.error('Failed to queue export job', {
      error: error instanceof Error ? String(error) : String(error),
      exportId: exportRequest.id,
    })

    // Update status to failed
    await dataExportDAO.update(exportRequest.id, {
      status: 'failed',
      error: 'Failed to queue export job',
    })

    throw error
  }
}

/**
 * Map of data categories to MongoDB collections (mirrors dataDeleteService.ts)
 */
const PATIENT_DATA_COLLECTIONS: Record<string, string[]> = {
  demographics: ['patient_profiles', 'patient_demographics'],
  sessions: ['therapy_sessions', 'session_notes'],
  assessments: ['patient_assessments', 'assessment_results'],
  emotions: ['emotion_records', 'emotion_tracking_data'],
  notes: ['clinical_notes', 'therapist_observations'],
  messages: ['patient_messages', 'communication_logs'],
  media: ['patient_uploads', 'media_files'],
}

/** All patient data collections */
const ALL_PATIENT_COLLECTIONS = Object.values(PATIENT_DATA_COLLECTIONS).flat()

/**
 * Fetch patient data from MongoDB collections based on requested data types.
 */
async function fetchPatientData(
  patientId: string,
  dataTypes: string[],
): Promise<Record<string, unknown[]>> {
  const db = mongoClient.db
  const result: Record<string, unknown[]> = {}

  const collectionsToQuery = new Set<string>()
  if (dataTypes.includes('all')) {
    ALL_PATIENT_COLLECTIONS.forEach((c) => collectionsToQuery.add(c))
  } else {
    for (const dt of dataTypes) {
      const cols = PATIENT_DATA_COLLECTIONS[dt]
      if (cols) {
        cols.forEach((c) => collectionsToQuery.add(c))
      } else {
        // If the data type is a direct collection name, use it
        collectionsToQuery.add(dt)
      }
    }
  }

  for (const collectionName of collectionsToQuery) {
    try {
      const docs = await db
        .collection(collectionName)
        .find({ patient_id: patientId })
        .toArray()
      result[collectionName] = docs
    } catch (err) {
      logger.warn('Failed to query collection for export', {
        collectionName,
        patientId,
        error: err instanceof Error ? err.message : String(err),
      })
      result[collectionName] = []
    }
  }

  return result
}

/**
 * Convert fetched patient data to the requested format.
 */
function formatExportData(
  data: Record<string, unknown[]>,
  format: ExportFormat,
): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2)
  }
  if (format === 'csv') {
    const lines: string[] = []
    for (const [collectionName, records] of Object.entries(data)) {
      lines.push(`# ${collectionName}`)
      if (records.length === 0) {
        lines.push('')
        continue
      }
      const headers = Object.keys(records[0] as Record<string, unknown>)
      lines.push(headers.join(','))
      for (const record of records) {
        const row = headers
          .map((h) => {
            const val = (record as Record<string, unknown>)[h]
            if (val === null || val === undefined) return ''
            if (typeof val === 'object') {
              return `"${JSON.stringify(val).replace(/"/g, '""')}"`
            }
            if (typeof val === 'string') {
              return `"${val.replace(/"/g, '""')}"`
            }
            // number, boolean, bigint, symbol
            return `"${JSON.stringify(val).replace(/"/g, '""')}"`
          })
          .join(',')
        lines.push(row)
      }
      lines.push('')
    }
    return lines.join('\n')
  }
  // For xml and pdf, serialize as JSON within an XML wrapper / base64 placeholder
  if (format === 'xml') {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<export>\n${Object.entries(
      data,
    )
      .map(
        ([collection, records]) =>
          `  <collection name="${collection}">\n${records
            .map((r) => `    <record>${JSON.stringify(r)}</record>`)
            .join('\n')}\n  </collection>`,
      )
      .join('\n')}\n</export>`
  }
  // pdf: return JSON representation (real PDF generation would need a library)
  return JSON.stringify(data, null, 2)
}

/**
 * Process an export request (to be run as a background job)
 * @param exportId ID of the export request to process
 */
async function processExportRequest(exportId: string): Promise<void> {
  logger.info('Starting export processing', { exportId })

  try {
    // Mark as processing
    await dataExportDAO.update(exportId, {
      status: 'processing',
      startedAt: new Date(),
    })

    // Fetch export details
    const exportData = await dataExportDAO.findById(exportId)

    if (!exportData) {
      throw new Error(`Export request ${exportId} not found`)
    }

    // Fetch actual patient data from MongoDB
    const patientData = await fetchPatientData(
      exportData.patientId,
      exportData.dataTypes,
    )

    // Generate files for each requested format
    const exportFiles: ExportFile[] = []

    for (const format of (exportData.formats || []) as ExportFormat[]) {
      const fileContent = formatExportData(patientData, format)
      const contentBuffer = Buffer.from(fileContent, 'utf-8')
      const fileId = uuidv4()

      const file: ExportFile = {
        id: fileId,
        exportId: exportId,
        format: format,
        dataType: exportData.dataTypes.join(','),
        url: `data:${format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/octet-stream'};base64,${contentBuffer.toString('base64')}`,
        size: contentBuffer.length,
        createdAt: new Date(),
        content: contentBuffer.toString('base64'),
      }

      exportFiles.push(file)
      await dataExportDAO.addFile(exportId, file)
    }

    // Mark as completed
    await dataExportDAO.update(exportId, {
      status: 'completed',
      completedAt: new Date(),
    })

    logger.info('Export processing completed', {
      exportId,
      fileCount: exportFiles.length,
    })

    // Send notification to user (would implement in production)
  } catch (error: unknown) {
    logger.error('Error processing export', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? error?.stack : undefined,
      exportId,
    })

    // Mark as failed
    await dataExportDAO.update(exportId, {
      status: 'failed',
      error: error instanceof Error ? String(error) : String(error),
    })
  }
}

/**
 * Check if a user has access to patient data
 * @param patientId ID of the patient
 * @param userId ID of the user
 * @returns Whether the user has access to the patient's data
 */
async function verifyPatientDataAccess(
  patientId: string,
  userId: string,
): Promise<boolean> {
  try {
    const user = (await userManager.getUserById(userId)) as {
      id: string
      role?: string
    } | null
    if (!user) return false
    const userRoleVal = user.role ?? ''
    if (userRoleVal === 'admin' || userRoleVal === 'staff') return true
    if (userRoleVal === 'patient') return patientId === userId
    if (userRoleVal === 'therapist') {
      return await aiRepository.isTherapistForClient(userId, patientId)
    }
    return false
  } catch (e) {
    logger.error('Access verification error', { error: String(e) })
    return false
  }
}

/**
 * Get a data export request by ID
 */
export async function getDataExportRequest(
  id: string,
): Promise<DataExportRequest | null> {
  try {
    const exportRequest = await dataExportDAO.findById(id)
    return exportRequest as unknown as DataExportRequest
  } catch (error: unknown) {
    logger.error('Error in getDataExportRequest', {
      error: error instanceof Error ? String(error) : String(error),
      id,
    })
    throw error
  }
}

/**
 * Get all data export requests
 */
export async function getAllDataExportRequests(filters?: {
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  patientId?: string
  dateRange?: { start: string; end: string }
}): Promise<DataExportRequest[]> {
  try {
    const dbFilters: Record<string, unknown> = {}
    if (filters) {
      if (filters.status) {
        dbFilters['status'] = filters.status
      }
      if (filters.patientId) {
        dbFilters['patientId'] = filters.patientId
      }
      if (filters.dateRange) {
        dbFilters['createdAt'] = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end),
        }
      }
    }

    const results = await dataExportDAO.findAll(dbFilters)
    return results as unknown as DataExportRequest[]
  } catch (error: unknown) {
    logger.error('Error in getAllDataExportRequests', {
      error: error instanceof Error ? String(error) : String(error),
      filters,
    })
    throw error
  }
}

/**
 * Interface for the parameters required to cancel an export request
 */
interface CancelExportParams {
  exportId: string
  cancelledBy: string
  reason?: string
}

/**
 * Interface for the result of a cancel export operation
 */
interface CancelExportResult {
  success: boolean
  message: string
  status?: string
}

/**
 * Update the status of an export request
 */
async function updateExportStatus(
  exportId: string,
  status: ExportStatus,
  options?: { errorMessage?: string },
): Promise<void> {
  try {
    await dataExportDAO.update(exportId, {
      status,
      error: options?.errorMessage,
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
      ...(status === 'processing' ? { startedAt: new Date() } : {}),
    })

    logger.info(`Export status updated to ${status}`, { exportId })
  } catch (error: unknown) {
    logger.error('Error updating export status', {
      error: error instanceof Error ? String(error) : String(error),
      exportId,
    })
    throw error
  }
}

/**
 * Cancel a data export request
 */
export async function cancelDataExportRequest(
  params: CancelExportParams,
): Promise<CancelExportResult> {
  try {
    // Get the export request
    const exportRequest = await getDataExportRequest(params.exportId)

    if (!exportRequest) {
      logger.warn('Export request not found for cancellation', {
        exportId: params.exportId,
      })
      return {
        success: false,
        message: `Export request with ID ${params.exportId} not found`,
      }
    }

    // Check if the export request can be cancelled
    if (exportRequest.status === 'completed') {
      logger.warn('Cannot cancel completed export request', {
        exportId: params.exportId,
        status: exportRequest.status,
      })
      return {
        success: false,
        message: 'Cannot cancel an export request that has already completed',
        status: exportRequest.status,
      }
    }

    if (exportRequest.status === 'failed') {
      logger.warn('Cannot cancel failed export request', {
        exportId: params.exportId,
        status: exportRequest.status,
      })
      return {
        success: false,
        message: 'Cannot cancel an export request that has already failed',
        status: exportRequest.status,
      }
    }

    // Update the export request status to 'cancelled'
    await updateExportStatus(params.exportId, 'cancelled', {
      errorMessage: `Cancelled by user: ${params.reason ?? 'No reason provided'}`,
    })

    // Audit log the cancellation
    await createAuditLog(
      AuditEventType.SECURITY,
      'export_cancelled',
      params.cancelledBy,
      'data_portability',
      {
        exportId: params.exportId,
        reason: params.reason ?? 'No reason provided',
        patientId: exportRequest.patientId,
      },
    )

    logger.info('Export request cancelled successfully', {
      exportId: params.exportId,
      cancelledBy: params.cancelledBy,
      reason: params.reason,
    })

    return {
      success: true,
      message: 'Export request cancelled successfully',
      status: 'cancelled',
    }
  } catch (error: unknown) {
    logger.error('Error cancelling export request', {
      error: error instanceof Error ? String(error) : String(error),
      exportId: params.exportId,
    })

    return {
      success: false,
      message: `Failed to cancel export request: ${error instanceof Error ? String(error) : String(error)}`,
    }
  }
}

/**
 * Interface for the result of a get export status operation
 */
interface ExportStatusResult {
  success: boolean
  error?: string
  message?: string
  exportId?: string
  status?: string
  progress?: number
  createdAt?: string
  updatedAt?: string
  estimatedCompletionTime?: string
  completedAt?: string
  downloadUrl?: string
  expiresAt?: string
  formats?: string[]
  dataTypes?: string[]
  patientId?: string
  requestedBy?: string
  priority?: string
}

/**
 * Interface for the result of a download data export operation
 */
interface DownloadExportResult {
  success: boolean
  error?: string
  message?: string
  status?: string
  progress?: number
  estimatedCompletionTime?: string
  expiredAt?: string
  format?: string
  fileData?: Buffer
  filename?: string
  downloadUrl?: string
  expiresAt?: string
}

/**
 * Download a data export file
 */
export async function downloadDataExport(
  exportId: string,
  userId: string,
  format?: string,
): Promise<DownloadExportResult> {
  try {
    // Get the export request
    const exportRequest = await getDataExportRequest(exportId)

    if (!exportRequest) {
      logger.warn('Export request not found for download', { exportId })
      return {
        success: false,
        error: 'not_found',
        message: `Export request with ID ${exportId} not found`,
      }
    }

    // Verify the user has permission to access this patient's data
    const isAuthorized = await verifyPatientDataAccess(
      userId,
      exportRequest.patientId,
    )

    if (!isAuthorized) {
      logger.warn('User not authorized to download export', {
        userId,
        exportId,
        patientId: exportRequest.patientId,
      })

      return {
        success: false,
        error: 'unauthorized',
        message: 'You are not authorized to download this export',
      }
    }

    // Check if the export is ready for download
    if (exportRequest.status !== 'completed') {
      logger.warn('Export not ready for download', {
        exportId,
        status: exportRequest.status,
      })

      // Calculate progress and estimated completion time
      let progress = 0
      switch (exportRequest.status) {
        case 'pending':
          progress = 0
          break
        case 'processing':
          progress = 50
          break
        case 'cancelled':
          progress = 100
          break
        case 'expired':
          progress = 100
          break
        case 'failed':
          progress = 100
          break
        default:
          progress = 0
      }

      const createdAt = new Date(exportRequest.createdAt)
      const estimatedCompletionTime = new Date(
        createdAt.getTime() + 5 * 60 * 1000,
      ) // 5 minutes from creation

      return {
        success: false,
        error: 'not_ready',
        message: 'Export is not ready for download',
        status: exportRequest.status,
        progress,
        estimatedCompletionTime: estimatedCompletionTime.toISOString(),
      }
    }

    // Find the matching file by format (or pick the first file if no format specified)
    const files = exportRequest.files ?? []
    const targetFile = format
      ? files.find((f) => f.format === format)
      : files[0]

    if (!targetFile) {
      logger.error('No matching export file found', { exportId, format })

      return {
        success: false,
        error: 'not_found',
        message: `No export file found${format ? ` in ${format} format` : ''}`,
      }
    }

    // Check expiration (24 hours after completion)
    const completedAt = exportRequest.completedAt
      ? new Date(exportRequest.completedAt)
      : new Date()
    const expirationDate = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)

    if (expirationDate < new Date()) {
      logger.warn('Export file expired', {
        exportId,
        completedAt: exportRequest.completedAt,
        expiredAt: expirationDate.toISOString(),
      })

      return {
        success: false,
        error: 'expired',
        message: 'Export has expired and is no longer available for download',
        expiredAt: expirationDate.toISOString(),
      }
    }

    // Decode the stored file content
    const fileData = targetFile.content
      ? Buffer.from(targetFile.content, 'base64')
      : Buffer.from('')

    // Generate a filename
    const fileExt =
      targetFile.format === 'json'
        ? 'json'
        : targetFile.format === 'csv'
          ? 'csv'
          : targetFile.format === 'xml'
            ? 'xml'
            : 'pdf'
    const filename = `patient-export-${exportRequest.patientId}-${targetFile.id.slice(0, 8)}.${fileExt}`

    // Log the download for HIPAA audit
    await createAuditLog(
      AuditEventType.SECURITY,
      'export_downloaded',
      userId,
      'data_portability',
      {
        exportId,
        format: targetFile.format,
        patientId: exportRequest.patientId,
        fileSize: targetFile.size,
      },
    )

    logger.info('Export file downloaded', {
      exportId,
      userId,
      format: targetFile.format,
      fileSize: targetFile.size,
    })

    return {
      success: true,
      format: targetFile.format,
      fileData,
      filename,
      expiresAt: expirationDate.toISOString(),
    }
  } catch (error: unknown) {
    logger.error('Error downloading export', {
      error: error instanceof Error ? String(error) : String(error),
      exportId,
      userId,
    })

    return {
      success: false,
      message: `Failed to download export: ${error instanceof Error ? String(error) : String(error)}`,
    }
  }
}
