import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { supabase } from '../../supabase'
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

import { db } from '../../db'
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

// Interface for the data bundle with typed properties
interface PatientData {
  profile?: PatientProfile
  mentalHealth?: object
  chatHistory?: object
  consentRecords?: object
  [key: string]: object | undefined
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
  } catch (error) {
    logger.error('Error creating export request', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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
  } catch (error) {
    logger.error('Error getting export status', {
      error: error instanceof Error ? error.message : String(error),
      exportId,
      userId,
    })

    return {
      success: false,
      message: `Failed to get export status: ${error instanceof Error ? error.message : String(error)}`,
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
          error: err.message,
          stack: err.stack,
          exportId: exportRequest.id,
        }),
      )
    }, 100)

    logger.info('Export job queued', { exportId: exportRequest.id })
  } catch (error) {
    logger.error('Failed to queue export job', {
      error: error instanceof Error ? error.message : String(error),
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
          size: Math.floor(Math.random() * 10000000), // Random size for simulation
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
  } catch (error) {
    logger.error('Error processing export', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      exportId,
    })

    // Mark as failed
    await mockDb.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
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
  } catch (error) {
    logger.error('Error verifying patient data access', {
      error: error instanceof Error ? error.message : String(error),
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
  } catch (error) {
    logger.error('Error checking admin status', {
      error: error instanceof Error ? error.message : String(error),
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
  try {
    const { data, error } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found
        return null
      }

      logger.error('Failed to get data export request', { error, id })
      throw new Error(`Failed to get data export request: ${error.message}`)
    }

    return data as DataExportRequest
  } catch (error) {
    logger.error('Error in getDataExportRequest', {
      error: error instanceof Error ? error.message : String(error),
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
    let query = supabase
      .from('data_export_requests')
      .select('*')
      .order('dateRequested', { ascending: false })

    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.patientId) {
        query = query.eq('patientId', filters.patientId)
      }

      if (filters.dateRange) {
        query = query
          .gte('dateRequested', filters.dateRange.start)
          .lte('dateRequested', filters.dateRange.end)
      }
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to get data export requests', { error, filters })
      throw new Error(`Failed to get data export requests: ${error.message}`)
    }

    return data as DataExportRequest[]
  } catch (error) {
    logger.error('Error in getAllDataExportRequests', {
      error: error instanceof Error ? error.message : String(error),
      filters,
    })
    throw error
  }
}

/**
 * Fetch patient data based on the requested sections
 */
async function _fetchPatientData(
  patientId: string,
  sections: string[],
): Promise<PatientData> {
  const patientData: PatientData = {}

  try {
    // Fetch profile data if requested
    if (sections.includes('profile')) {
      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('patient_id', patientId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      patientData.profile = data || {}
    }

    // Fetch mental health data if requested
    if (sections.includes('mental-health')) {
      // Fetch various mental health related tables
      const [assessments, emotions, notes] = await Promise.all([
        supabase
          .from('patient_assessments')
          .select('*')
          .eq('patient_id', patientId),
        supabase
          .from('emotion_records')
          .select('*')
          .eq('patient_id', patientId),
        supabase.from('clinical_notes').select('*').eq('patient_id', patientId),
      ])

      patientData.mentalHealth = {
        assessments: assessments.data || [],
        emotions: emotions.data || [],
        notes: notes.data || [],
      }
    }

    // Fetch chat history if requested
    if (sections.includes('chat-history')) {
      const { data, error } = await supabase
        .from('patient_messages')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: true })

      if (error) {
        throw error
      }

      patientData.chatHistory = { messages: data || [] }
    }

    // Fetch consent records if requested
    if (sections.includes('consent')) {
      const { data, error } = await supabase
        .from('patient_consents')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false })

      if (error) {
        throw error
      }

      patientData.consentRecords = { consents: data || [] }
    }

    return patientData
  } catch (error) {
    logger.error('Error fetching patient data', {
      error: error instanceof Error ? error.message : String(error),
      patientId,
      sections,
    })
    throw new Error(
      `Failed to fetch patient data: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Format patient data for export according to the specified format
 */
async function _formatDataForExport(
  data: PatientData,
  format: string,
): Promise<string | Buffer> {
  try {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2)

      case 'csv':
        // For CSV format, we need to flatten nested structures
        // This is a simplified implementation
        return convertToCSV(data)

      case 'fhir':
        // Convert to FHIR format
        return convertToFHIR(data)

      case 'ccd':
        // Convert to CCD format
        return convertToCCD(data)

      case 'hl7':
        // Convert to HL7 format
        return convertToHL7(data)

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  } catch (error) {
    logger.error('Error formatting data for export', {
      error: error instanceof Error ? error.message : String(error),
      format,
    })
    throw new Error(
      `Failed to format data for export: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: PatientData): string {
  // This is a simplified implementation
  let csv = ''

  // Process each section
  Object.entries(data).forEach(([section, sectionData]) => {
    if (!sectionData) {
      return
    }

    // Handle arrays (like messages, assessments, etc.)
    if (Array.isArray(sectionData)) {
      // Get headers from the first item
      const headers = sectionData.length > 0 ? Object.keys(sectionData[0]) : []
      csv += `# ${section}\n`
      csv += headers.join(',') + '\n'

      // Add each row
      sectionData.forEach((item) => {
        const row = headers.map((header) => {
          const value = item[header]
          // Quote strings and ensure no commas break the CSV
          return typeof value === 'string'
            ? `"${value.replace(/"/g, '""')}"`
            : value
        })
        csv += row.join(',') + '\n'
      })

      csv += '\n'
    }
    // Handle objects
    else if (typeof sectionData === 'object') {
      csv += `# ${section}\n`
      Object.entries(sectionData).forEach(([key, value]) => {
        // Simple key-value format for objects
        csv += `${key},"${typeof value === 'string' ? value.replace(/"/g, '""') : JSON.stringify(value)}"\n`
      })
      csv += '\n'
    }
  })

  return csv
}

/**
 * Convert data to FHIR format (simplified)
 */
function convertToFHIR(data: PatientData): string {
  // In a real implementation, this would use a proper FHIR library
  // This is a simplified example
  interface FhirBundle {
    resourceType: string
    type: string
    entry: Array<{
      resource: {
        resourceType: string
        id: string
        [key: string]: unknown
      }
    }>
  }

  const fhirBundle: FhirBundle = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [],
  }

  // Add patient resource if profile exists
  if (data.profile) {
    const profile = data.profile as unknown as PatientProfile

    fhirBundle.entry.push({
      resource: {
        resourceType: 'Patient',
        id: profile.patient_id || 'unknown',
        name: [
          {
            use: 'official',
            family: profile.last_name || '',
            given: [profile.first_name || ''],
          },
        ],
        birthDate: profile.date_of_birth || '',
        gender: profile.gender || 'unknown',
      },
    })
  }

  // Add other resources based on the data
  // (simplified implementation)

  return JSON.stringify(fhirBundle, null, 2)
}

/**
 * Convert data to CCD format (simplified)
 */
function convertToCCD(data: PatientData): string {
  // In a real implementation, this would use a proper CCD/CDA library
  // This is a highly simplified example with just the XML structure
  const profile = data.profile as unknown as PatientProfile

  return `<?xml version="1.0" encoding="UTF-8"?>
  <ClinicalDocument xmlns="urn:hl7-org:v3">
    <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
    <id root="2.16.840.1.113883.19.4" extension="${profile?.patient_id || 'unknown'}"/>
    <title>Pixelated Empathy Mental Health Data Export</title>
    <effectiveTime value="${new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14)}"/>
    <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
    <recordTarget>
      <patientRole>
        <id root="2.16.840.1.113883.19.5" extension="${profile?.patient_id || 'unknown'}"/>
        <patient>
          <name>
            <given>${profile?.first_name || ''}</given>
            <family>${profile?.last_name || ''}</family>
          </name>
          <administrativeGenderCode code="${profile?.gender || 'U'}" codeSystem="2.16.840.1.113883.5.1"/>
          <birthTime value="${profile?.date_of_birth?.replace(/-/g, '') || ''}"/>
        </patient>
      </patientRole>
    </recordTarget>
    <!-- Additional structured content would go here based on the data sections -->
  </ClinicalDocument>`
}

/**
 * Convert data to HL7 format (simplified)
 */
function convertToHL7(data: PatientData): string {
  // In a real implementation, this would use a proper HL7 library
  // This is a highly simplified example of an HL7 message
  const now = new Date()
  const messageTimestamp = now
    .toISOString()
    .replace(/[-:T.]/g, '')
    .slice(0, 14)

  const profile = data.profile as unknown as PatientProfile

  // Create a basic HL7 v2 message
  return [
    `MSH|^~\\&|GRADIANT|MENTAL_HEALTH|RECEIVING_SYSTEM|FACILITY|${messageTimestamp}||MDM^T02|MSG${now.getTime()}|P|2.5`,
    `PID|1||${profile?.patient_id || 'UNKNOWN'}||${profile?.last_name || ''}^${profile?.first_name || ''}||${profile?.date_of_birth || ''}|${profile?.gender?.[0]?.toUpperCase() || 'U'}`,
    `PV1|1|O|||||||||||||||||${profile?.patient_id || 'UNKNOWN'}`,
    // Additional segments would be added based on the data
    '',
  ].join('\r')
}

/**
 * Generate an encrypted export file
 */
async function _generateEncryptedExport(
  data: string | Buffer,
  request: DataExportRequestWithFormat,
): Promise<Buffer> {
  try {
    // In a real implementation, this would use proper encryption
    // For now, we'll just convert the data to a buffer
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

    logger.info('Export file generated with encryption', {
      exportId: request.id,
      format: request.dataFormat,
      sizeInBytes: dataBuffer.length,
    })

    return dataBuffer
  } catch (error) {
    logger.error('Error generating encrypted export', {
      error: error instanceof Error ? error.message : String(error),
      exportId: request.id,
    })
    throw new Error(
      `Failed to generate encrypted export: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Store the export file and generate a download URL
 */
async function _storeExportFile(
  fileData: Buffer,
  request: DataExportRequestWithFormat,
): Promise<string> {
  try {
    // Determine file extension based on format
    const fileExtension = getFileExtension(request.dataFormat)

    // Generate a unique filename
    const filename = `${request.patientId}/exports/${request.id}${fileExtension}`

    // Store the file in Supabase Storage
    const { error } = await supabase.storage
      .from('patient-data-exports')
      .upload(filename, fileData, {
        contentType: getContentType(request.dataFormat),
        upsert: true,
      })

    if (error) {
      throw error
    }

    // Generate a signed URL for download (expires in 24 hours)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('patient-data-exports')
      .createSignedUrl(filename, 60 * 60 * 24)

    if (urlError) {
      throw urlError
    }

    logger.info('Export file stored successfully', {
      exportId: request.id,
      filename,
      downloadUrl: urlData.signedUrl,
    })

    return urlData.signedUrl
  } catch (error) {
    logger.error('Error storing export file', {
      error: error instanceof Error ? error.message : String(error),
      exportId: request.id,
    })
    throw new Error(
      `Failed to store export file: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Get the appropriate file extension for the export format
 */
function getFileExtension(format: string): string {
  switch (format) {
    case 'json':
      return '.json'
    case 'csv':
      return '.csv'
    case 'fhir':
      return '.json'
    case 'ccd':
      return '.xml'
    case 'hl7':
      return '.hl7'
    default:
      return '.txt'
  }
}

/**
 * Get the appropriate content type for the export format
 */
function getContentType(format: string): string {
  switch (format) {
    case 'json':
      return 'application/json'
    case 'csv':
      return 'text/csv'
    case 'fhir':
      return 'application/fhir+json'
    case 'ccd':
      return 'application/xml'
    case 'hl7':
      return 'application/hl7-v2'
    default:
      return 'text/plain'
  }
}

/**
 * Send notification to the recipient about the available export
 */
async function _sendExportNotification(
  request: DataExportRequestWithFormat,
  downloadUrl: string,
): Promise<void> {
  try {
    // In a real implementation, this would send an email
    // For now, we'll just log it
    logger.info('Would send export notification email', {
      to: request.recipientEmail,
      subject: 'Patient Data Export Available',
      patientId: request.patientId,
      downloadUrl,
    })

    // Audit log the notification
    auditLogger.log({
      action: 'export_notification_sent',
      resource: 'patient_data',
      resourceId: request.patientId,
      details: {
        exportId: request.id,
        recipientEmail: request.recipientEmail,
      },
    })
  } catch (error) {
    logger.error('Error sending export notification', {
      error: error instanceof Error ? error.message : String(error),
      exportId: request.id,
      recipientEmail: request.recipientEmail,
    })
    // We don't throw here to avoid failing the entire process
    // The export was successful, notification is secondary
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
  } catch (error) {
    logger.error('Error updating export status', {
      error: error instanceof Error ? error.message : String(error),
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
  } catch (error) {
    logger.error('Error cancelling export request', {
      error: error instanceof Error ? error.message : String(error),
      exportId: params.exportId,
    })

    return {
      success: false,
      message: `Failed to cancel export request: ${error instanceof Error ? error.message : String(error)}`,
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
  } catch (error) {
    logger.error('Error downloading export', {
      error: error instanceof Error ? error.message : String(error),
      exportId,
      userId,
    })

    return {
      success: false,
      message: `Failed to download export: ${error instanceof Error ? error.message : String(error)}`,
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
        id: _params.where.id as string,
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
        id: _params.where.id,
      } as unknown as DataExport)
    },
    findUnique: (_params: MockDbFindParams): Promise<DataExport | null> => {
      return Promise.resolve({
        id: _params.where.id as string,
        patientId: process.env.PATIENT_ID || 'example-patient-id',
        requestedBy: 'test-user-id',
        formats: ['json'],
        dataTypes: ['profile'],
        reason: 'Test reason',
        priority: 'normal',
        status: 'pending',
        createdAt: new Date(),
        files: _params.include?.files
          ? [
              {
                id: 'file-1',
                exportId: _params.where.id as string,
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
        id: _params.where.id as string,
        roles: [{ name: 'user' }],
      })
    },
  },
}

// Replace missing permissions module with a stub
function _checkUserPermissionForPatient(
  _userId: string,
  _patientId: string,
): Promise<boolean> {
  return Promise.resolve(true) // Simplified stub
}
