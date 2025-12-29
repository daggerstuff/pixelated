import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { randomBytes } from 'crypto'
// Supabase import removed - migrated to MongoDB
// Create our own audit logging service since the actual one has different signature
class AuditLoggingService {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  log(entry: {
    action: string
    resource: string
    resourceId: string
    userId?: string
    details: Record<string, unknown>
  }): void {
    console.log(`[AUDIT:${this.context}]`, entry)
  }
}

// Use the same function name but implement a simplified version
function getAuditLogger(context: string): AuditLoggingService {
  return new AuditLoggingService(context)
}

// Import the generateId function from ids.ts instead of idUtils

import { mongoClient as db } from '../../db/mongoClient'
import { v4 as uuidv4 } from 'uuid'

// Replace missing permissions module with a stub
// Setup logging
const logger = createBuildSafeLogger('data-portability-service')
const auditLogger = getAuditLogger('data-transfer')

// Types for data portability and export
export interface DataExportRequest {
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

export interface CreateDataExportParams {
  patientId: string
  initiatedBy: string
  recipientType: 'provider' | 'patient' | 'research'
  recipientName: string
  recipientEmail: string
  dataFormat: 'json' | 'csv' | 'fhir' | 'ccd' | 'hl7'
  dataSections: string[]
}

export interface DataExportResult {
  exportRequest: DataExportRequest
  message: string
  success: boolean
}

// Define the PatientProfile interface
export interface PatientProfile {
  patient_id?: string
  last_name?: string
  first_name?: string
  date_of_birth?: string
  gender?: string
  // Add other properties as needed based on actual patient_profiles table structure
}

// Define the export status types
export type ExportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled'

// Define the export formats
export type ExportFormat = 'json' | 'csv' | 'pdf' | 'xml'

// Export request interface
export interface ExportRequest {
  patientId: string
  format: ExportFormat
  initiatedBy: string
  includeCategories?: string[]
  dateRange?: {
    start?: string
    end?: string
  }
}

export interface ExportResult {
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
export interface ExportStatusResponse {
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
export interface ExportDownloadSuccessResponse {
  success: true
  exportId: string
  format: ExportFormat
  filename?: string
  fileData?: Uint8Array | string
  downloadUrl?: string
  expiresAt?: Date
}

// Export download response for errors
export interface ExportDownloadErrorResponse {
  success: false
  error:
  | 'not_found'
  | 'unauthorized'
  | 'not_ready'
  | 'expired'
  | 'internal_error'
  message?: string
  status?: ExportStatus
  progress?: number
  estimatedCompletionTime?: Date
  expiredAt?: Date
}

// Combined type for download responses
export type ExportDownloadResponse =
  | ExportDownloadSuccessResponse
  | ExportDownloadErrorResponse

export type ExportPriority = 'normal' | 'high'

export type ExportFile = {
  id: string
  exportId: string
  format: ExportFormat
  dataType: string
  url: string
  size: number
  createdAt: Date
}

export type ExportRequestInput = {
  patientId: string
  formats: ExportFormat[]
  dataTypes: string[]
  reason: string
  priority: ExportPriority
  requestedBy: string
}

export type ExportResponse = {
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
    const patient = await mockDb.patient.findUnique({
      where: { id: input.patientId },
    })

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
    await mockDb.dataExport.create({
      data: {
        id: exportRequest.id,
        patientId: exportRequest.patientId,
        requestedBy: exportRequest.requestedBy,
        formats: exportRequest.formats,
        dataTypes: exportRequest.dataTypes,
        reason: exportRequest.reason,
        priority: exportRequest.priority,
        status: exportRequest.status,
        createdAt: exportRequest.createdAt,
      },
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
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
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
    await mockDb.dataExport.update({
      where: { id: exportRequest.id },
      data: {
        status: 'failed',
        error: 'Failed to queue export job',
      },
    })

    throw error
  }
}

/**
 * Process an export request (to be run as a background job)
 * @param exportId ID of the export request to process
 */
async function processExportRequest(exportId: string): Promise<void> {
  logger.info('Starting export processing', { exportId })

  try {
    // Mark as processing
    await mockDb.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    })

    // Fetch export details
    const exportData = await mockDb.dataExport.findUnique({
      where: { id: exportId },
    })

    if (!exportData) {
      throw new Error(`Export request ${exportId} not found`)
    }

    // Generate requested files (would be a more complex process in production)
    const exportFiles: ExportFile[] = []

    for (const dataType of exportData.dataTypes) {
      for (const format of exportData.formats) {
        // Simulate file generation
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const fileId = uuidv4()
        const fileName = `${dataType}-${exportData.patientId}.${format}`
        const fileUrl = `https://storage.example.com/exports/${exportId}/${fileName}`

        // In production, this would actually generate and upload files

        // Create file record
        const file = {
          id: fileId,
          exportId: exportId,
          format: format as ExportFormat,
          dataType: dataType,
          url: fileUrl,
          size: Math.floor(randomBytes(4).readUInt32BE(0) / 429.4967296), // Cryptographically secure random size for simulation
          createdAt: new Date(),
        }

        exportFiles.push(file)

        // Save file record
        await mockDb.exportFile.create({
          data: file,
        })
      }
    }

    // Mark as completed
    await mockDb.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })

    logger.info('Export processing completed', {
      exportId,
      fileCount: exportFiles.length,
    })

    // Send notification to user (would implement in production)
    // await notifyUserOfCompletedExport(exportData.requestedBy, exportId);
  } catch (error: unknown) {
    logger.error('Error processing export', {
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
      exportId,
    })

    // Mark as failed
    await mockDb.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'failed',
        error: error instanceof Error ? String(error) : String(error),
      },
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
    // Check various access conditions:
    // 1. User is the patient
    // 2. User is a healthcare provider with access to the patient
    // 3. User is an authorized representative of the patient
    // 4. User is an admin

    // For this example, we'll use a simple implementation
    const patientUser = await mockDb.patientUser.findFirst({
      where: {
        patientId,
        userId,
      },
    })

    if (patientUser) {
      return true
    }

    // Check if user is admin
    const isAdmin = await isAdminUser(userId)
    if (isAdmin) {
      return true
    }

    // Check if user is a provider with access
    const providerAccess = await mockDb.providerPatientAccess.findFirst({
      where: {
        patientId,
        providerId: userId,
      },
    })

    if (providerAccess) {
      return true
    }

    return false
  } catch (error: unknown) {
    logger.error('Error verifying patient data access', {
      error: error instanceof Error ? String(error) : String(error),
      patientId,
      userId,
    })

    // Default to deny on error
    return false
  }
}

/**
 * Check if a user has admin privileges
 * @param userId ID of the user
 * @returns Whether the user is an admin
 */
async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const user = await mockDb.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    })

    if (!user) {
      return false
    }

    return user.roles.some((role: { name: string }) => role.name === 'admin')
  } catch (error: unknown) {
    logger.error('Error checking admin status', {
      error: error instanceof Error ? String(error) : String(error),
      userId,
    })

    // Default to deny on error
    return false
  }
}

/**
 * Get a data export request by ID
 */
export async function getDataExportRequest(
  id: string,
): Promise<DataExportRequest | null> {
  // TODO: Replace with MongoDB implementation
  try {
    const exportRequest = await mockDb.dataExport.findUnique({
      where: { id },
    })
    return exportRequest as DataExportRequest
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
    // TODO: Replace with MongoDB implementation
    let allExports = await mockDb.dataExport.findUnique({ where: {} }) // This should be a findMany in real MongoDB code

    // Apply filters manually (since mockDb is a stub)
    let results = Array.isArray(allExports) ? allExports : [allExports]
    if (filters) {
      if (filters.status) {
        results = results.filter((r) => r.status === filters.status)
      }
      if (filters.patientId) {
        results = results.filter((r) => r.patientId === filters.patientId)
      }
      if (filters.dateRange) {
        results = results.filter((r) => {
          const created = new Date(r.createdAt)
          return (
            created >= new Date(filters.dateRange!.start) &&
            created <= new Date(filters.dateRange!.end)
          )
        })
      }
    }
    return results as DataExportRequest[]
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
export interface CancelExportParams {
  exportId: string
  cancelledBy: string
  reason?: string
}

/**
 * Interface for the result of a cancel export operation
 */
export interface CancelExportResult {
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
    await mockDb.dataExport.update({
      where: { id: exportId },
      data: {
        status,
        error: options?.errorMessage,
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
        ...(status === 'processing' ? { startedAt: new Date() } : {}),
      },
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
    await updateExportStatus(params.exportId, 'failed', {
      errorMessage: `Cancelled by user: ${params.reason || 'No reason provided'}`,
    })

    // Audit log the cancellation
    auditLogger.log({
      action: 'export_cancelled',
      resource: 'patient_data',
      resourceId: exportRequest.patientId,
      userId: params.cancelledBy,
      details: {
        exportId: params.exportId,
        reason: params.reason || 'No reason provided',
      },
    })

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
export interface ExportStatusResult {
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
export interface DownloadExportResult {
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

    // Check if the user has permission to download this export
    // In a real implementation, this would check relationship with the patient
    // and other access controls
    const isInitiator = userId === exportRequest.requestedBy
    const isAuthorized = isInitiator // Replace with actual authorization check

    if (!isAuthorized) {
      logger.warn('User not authorized to download export', {
        userId,
        exportId,
        requestedBy: exportRequest.requestedBy,
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

    // Cast to get access to format and dataFormat properties
    const typedExportRequest =
      exportRequest as unknown as DataExportRequestWithFormat

    // Check if the download URL is expired
    // In a real implementation, this would check with the storage service
    if (
      exportRequest.files?.find(
        (f) => f.format === format || f.format === typedExportRequest.format,
      )?.url
    ) {
      const completedAt = new Date(exportRequest.completedAt!)
      const expirationDate = new Date(
        completedAt.getTime() + 24 * 60 * 60 * 1000,
      ) // 24 hours after completion

      if (expirationDate < new Date()) {
        logger.warn('Export download URL expired', {
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

      // Log the download
      auditLogger.log({
        action: 'export_downloaded',
        resource: 'patient_data',
        resourceId: exportRequest.patientId,
        userId,
        details: {
          exportId,
          format: format || typedExportRequest.dataFormat,
        },
      })

      // In a real implementation, we might fetch the file data here if direct download is requested
      // For now, we'll just return the download URL
      logger.info('Export download URL provided', {
        exportId,
        userId,
        format: format || typedExportRequest.dataFormat,
      })

      return {
        success: true,
        format: format || typedExportRequest.dataFormat,
        downloadUrl: typedExportRequest.downloadUrl,
        expiresAt: expirationDate.toISOString(),
      }
    }

    // If we don't have a download URL, something is wrong with the export
    logger.error('Export has no download URL', { exportId })

    return {
      success: false,
      message: 'Export has no download URL available',
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

// Mock database types for the missing models
interface Patient {
  id: string
  name: string
}

interface DataExport {
  id: string
  patientId: string
  requestedBy: string
  formats: ExportFormat[]
  dataTypes: string[]
  reason: string
  priority: ExportPriority
  status: ExportStatus
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
}

interface ExportFileModel {
  id: string
  exportId: string
  format: ExportFormat
  dataType: string
  url: string
  size: number
  createdAt: Date
}

interface PatientUser {
  id: string
  patientId: string
  userId: string
}

interface ProviderPatientAccess {
  id: string
  patientId: string
  providerId: string
}

interface User {
  id: string
  roles: { name: string }[]
}

// Define types for mock database operations
interface MockDbCreateParams<T> {
  data: T
}

interface MockDbUpdateParams<T> {
  where: { id: string }
  data: Partial<T>
}

interface MockDbFindParams {
  where: Record<string, unknown>
  include?: Record<string, unknown>
}

// Extend the db object with mock implementations
const mockDb = {
  ...db,
  // Add mock implementations for missing models
  patient: {
    findUnique: (_params: MockDbFindParams): Promise<Patient | null> => {
      return Promise.resolve({
        id: _params.where['id'] as string,
        name: 'Test Patient',
      })
    },
  },
  dataExport: {
    create: (
      _params: MockDbCreateParams<Partial<DataExport>>,
    ): Promise<DataExport> => {
      return Promise.resolve(_params.data as unknown as DataExport)
    },
    update: (_params: MockDbUpdateParams<DataExport>): Promise<DataExport> => {
      return Promise.resolve({
        ..._params.data,
        id: _params.where['id'],
      } as unknown as DataExport)
    },
    findUnique: (_params: MockDbFindParams): Promise<DataExport | null> => {
      return Promise.resolve({
        id: _params.where['id'] as string,
        patientId: process.env['PATIENT_ID'] || 'example-patient-id',
        requestedBy: 'test-user-id',
        formats: ['json'],
        dataTypes: ['profile'],
        reason: 'Test reason',
        priority: 'normal',
        status: 'pending',
        createdAt: new Date(),
        files: _params.include?.['files']
          ? [
            {
              id: 'file-1',
              exportId: _params.where['id'] as string,
              format: 'json',
              dataType: 'profile',
              url: 'https://example.com/file.json',
              size: 1024,
              createdAt: new Date(),
            },
          ]
          : undefined,
      })
    },
  },
  exportFile: {
    create: (
      _params: MockDbCreateParams<ExportFileModel>,
    ): Promise<ExportFileModel> => {
      return Promise.resolve(_params.data as unknown as ExportFileModel)
    },
  },
  patientUser: {
    findFirst: (_params: { where: unknown }): Promise<PatientUser | null> => {
      return Promise.resolve(null)
    },
  },
  providerPatientAccess: {
    findFirst: (_params: {
      where: unknown
    }): Promise<ProviderPatientAccess | null> => {
      return Promise.resolve(null)
    },
  },
  user: {
    findUnique: (_params: MockDbFindParams): Promise<User | null> => {
      return Promise.resolve({
        id: _params.where['id'] as string,
        roles: [{ name: 'user' }],
      })
    },
  },
}
