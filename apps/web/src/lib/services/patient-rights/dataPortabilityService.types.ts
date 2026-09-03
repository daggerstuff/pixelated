/**
 * Data portability type definitions.
 * Extracted from dataPortabilityService.ts; pure type surface, no runtime logic.
 */

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
  'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled'

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
    'not_found' | 'unauthorized' | 'not_ready' | 'expired' | 'internal_error'
  message?: string
  status?: ExportStatus
  progress?: number
  estimatedCompletionTime?: Date
  expiredAt?: Date
}

// Combined type for download responses
export type ExportDownloadResponse =
  ExportDownloadSuccessResponse | ExportDownloadErrorResponse

export type ExportPriority = 'normal' | 'high'

export type ExportFile = {
  id: string
  exportId: string
  format: ExportFormat
  dataType: string
  url: string
  size: number
  createdAt: Date
  content?: string
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
export interface DataExportRequestWithFormat extends DataExportRequest {
  format: ExportFormat
  dataFormat: string
  downloadUrl?: string
  recipientEmail?: string
}
