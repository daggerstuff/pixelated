import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import mongoClient from '../../db/mongoClient'
import type { DataDeletionRequest as DeletionRequest } from './dataDeleteService'
import { getAuditLogger } from '../../ai/bias-detection/audit'

const logger = createBuildSafeLogger()
const auditLogger = getAuditLogger()

// Types for deletion requests
export interface DataDeletionRequest {
  id: string
  patientId: string
  patientName: string
  dataScope: 'all' | 'specific'
  dataCategories: string[]
  reason: string
  additionalDetails?: string
  status: 'pending' | 'completed' | 'denied' | 'in-progress'
  dateRequested: string
  dateProcessed?: string
  requestedBy: string
  processedBy?: string
  processingNotes?: string
}

export interface CreateDataDeletionRequestParams {
  patientId: string
  patientName: string
  dataScope: 'all' | 'specific'
  dataCategories: string[]
  reason: string
  additionalDetails?: string
  requestedBy: string
}

export interface UpdateDataDeletionRequestParams {
  id: string
  status: 'pending' | 'completed' | 'denied' | 'in-progress'
  processedBy: string
  processingNotes?: string
}

/**
 * Create a new data deletion request
 */
export async function createDataDeletionRequest(
  params: CreateDataDeletionRequestParams,
): Promise<DataDeletionRequest> {
  try {
    const requestId = `DEL-${new Date().getFullYear()}-${generateId(4)}`

    // Create new deletion request record
    const deletionRequest: DataDeletionRequest = {
      id: requestId,
      patientId: params.patientId,
      patientName: params.patientName,
      dataScope: params.dataScope,
      dataCategories: params.dataCategories,
      reason: params.reason,
      additionalDetails: params.additionalDetails,
      status: 'pending',
      dateRequested: new Date().toISOString(),
      requestedBy: params.requestedBy,
    }

    // Insert into database
    const db = mongoClient.getDb()
    const collection = db.collection<DeletionRequest>('dataDeletionRequests')
    await collection.insertOne(deletionRequest)

    return deletionRequest
  } catch (error: unknown) {
    logger.error('Error in createDataDeletionRequest', {
      error: error instanceof Error ? String(error) : String(error),
      params,
    })
    throw error
  }
}

/**
 * Get a data deletion request by ID
 */
export async function getDataDeletionRequest(
  id: string,
): Promise<DataDeletionRequest | null> {
  try {
    const db = mongoClient.getDb()
    const collection = db.collection<DeletionRequest>('dataDeletionRequests')
    const request = await collection.findOne({ id })

    return request as DataDeletionRequest | null
  } catch (error: unknown) {
    logger.error('Error in getDataDeletionRequest', {
      error: error instanceof Error ? String(error) : String(error),
      id,
    })
    throw error
  }
}

/**
 * Get all data deletion requests
 */
export async function getAllDataDeletionRequests(filters?: {
  status?: 'pending' | 'completed' | 'denied' | 'in-progress'
  patientId?: string
  dataScope?: 'all' | 'specific'
}): Promise<DataDeletionRequest[]> {
  const query: Partial<DataDeletionRequest> = {}

  if (filters) {
    // Use bracket notation for index signature properties
    if (filters['status']) {
      query.status = filters['status']
    }
    if (filters['patientId']) {
      query.patientId = filters['patientId']
    }
    if (filters['dataScope']) {
      query.dataScope = filters['dataScope']
    }
  }

  try {
    const db = mongoClient.getDb()
    const collection = db.collection<DeletionRequest>('dataDeletionRequests')
    const requests = await collection.find(query).toArray()

    return requests as DataDeletionRequest[]
  } catch (error: unknown) {
    logger.error('Error in getAllDataDeletionRequests', {
      error: error instanceof Error ? String(error) : String(error),
      filters,
    })
    throw error
  }
}

/**
 * Update the status of a data deletion request
 */
export async function updateDataDeletionRequest(
  params: UpdateDataDeletionRequestParams,
): Promise<DataDeletionRequest> {
  try {
    const updateData: Partial<DataDeletionRequest> = {
      status: params.status,
      processedBy: params.processedBy,
      processingNotes: params.processingNotes,
    }

    // If status is 'completed' or 'denied', add the processing date
    if (params.status === 'completed' || params.status === 'denied') {
      updateData.dateProcessed = new Date().toISOString()
    }

    const db = mongoClient.getDb()
    const collection = db.collection<DeletionRequest>('dataDeletionRequests')

    // Update the request in the database
    const result = await collection.findOneAndUpdate(
      { id: params.id },
      { $set: updateData },
      { returnDocument: 'after' },
    )

    if (!result) {
      throw new Error('Failed to update data deletion request')
    }

    // Get the full request data for audit logging
    const updatedRequest = result as DataDeletionRequest

    // Log the action for audit purposes
    auditLogger.logAction(
      { userId: params.processedBy, role: 'system' as const },
      'update_deletion_request',
      'patient_data',
      {
        requestId: params.id,
        newStatus: params.status,
        notes: params.processingNotes || 'No notes provided',
      },
      { ipAddress: '::1', userAgent: 'system' },
    )

    // If the request is completed, actually perform the data deletion
    if (params.status === 'completed') {
      await executeDataDeletion(updatedRequest, params.processedBy)
    }

    return updatedRequest
  } catch (error: unknown) {
    logger.error('Error in updateDataDeletionRequest', {
      error: error instanceof Error ? String(error) : String(error),
      params,
    })
    throw error
  }
}

/**
 * Execute the actual data deletion process
 * This is called after a deletion request is approved and marked as 'completed'
 */
async function executeDataDeletion(
  request: DataDeletionRequest,
  processedBy: string,
): Promise<void> {
  try {
    logger.info('Executing data deletion', {
      requestId: request.id,
      patientId: request.patientId,
      scope: request.dataScope,
    })

    // For 'all' scope, delete all patient data
    if (request.dataScope === 'all') {
      // Delete from each relevant table
      await deleteAllPatientData(request.patientId)

      logger.info('Completed full patient data deletion', {
        requestId: request.id,
        patientId: request.patientId,
      })
    }
    // For 'specific' scope, delete only selected categories
    else if (
      request.dataScope === 'specific' &&
      request.dataCategories.length > 0
    ) {
      await deleteSpecificPatientData(request.patientId, request.dataCategories)

      logger.info('Completed specific patient data deletion', {
        requestId: request.id,
        patientId: request.patientId,
        categories: request.dataCategories,
      })
    }

    // Log the deletion action for audit purposes
    auditLogger.logAction(
      { userId: processedBy, role: 'system' as const },
      'execute_data_deletion',
      'patient_data',
      {
        requestId: request.id,
        dataScope: request.dataScope,
        categories: request.dataCategories,
        reason: request.reason,
      },
      { ipAddress: '::1', userAgent: 'system' },
    )
  } catch (error: unknown) {
    logger.error('Error executing data deletion', {
      error: error instanceof Error ? String(error) : String(error),
      requestId: request.id,
      patientId: request.patientId,
    })

    // We don't throw here to avoid blocking the status update
    // Instead, we log the error and continue

    // Log the failure for audit purposes
    auditLogger.logAction(
      { userId: processedBy, role: 'system' as const },
      'data_deletion_error',
      'patient_data',
      {
        requestId: request.id,
        error: error instanceof Error ? String(error) : String(error),
      },
      { ipAddress: '::1', userAgent: 'system' },
    )
  }
}

/**
 * Delete all data for a patient
 */
async function deleteAllPatientData(patientId: string): Promise<void> {
  const collections = [
    'patient_profiles',
    'patient_demographics',
    'therapy_sessions',
    'session_notes',
    'patient_assessments',
    'assessment_results',
    'emotion_records',
    'emotion_tracking_data',
    'clinical_notes',
    'therapist_observations',
    'patient_messages',
    'communication_logs',
    'patient_uploads',
    'media_files',
  ]

  const db = mongoClient.getDb()
  const { client } = db
  const session = client.startSession()

  try {
    await session.withTransaction(async () => {
      for (const collectionName of collections) {
        await db
          .collection(collectionName)
          .deleteMany({ patient_id: patientId }, { session })
      }
    })
  } finally {
    await session.endSession()
  }
}

/**
 * Delete specific categories of patient data
 */
async function deleteSpecificPatientData(
  patientId: string,
  categories: string[],
): Promise<void> {
  // Map categories to database tables
  const categoryTableMap: Record<string, string[]> = {
    demographics: ['patient_profiles', 'patient_demographics'],
    sessions: ['therapy_sessions', 'session_notes'],
    assessments: ['patient_assessments', 'assessment_results'],
    emotions: ['emotion_records', 'emotion_tracking_data'],
    notes: ['clinical_notes', 'therapist_observations'],
    messages: ['patient_messages', 'communication_logs'],
    media: ['patient_uploads', 'media_files'],
  }

  // Process each requested category
  for (const category of categories) {
    const tables = categoryTableMap[category]

    // Skip unknown categories
    if (!tables) {
      logger.warn(`Unknown data category in deletion request: ${category}`)
      continue
    }

    const db = mongoClient.getDb()

    // Delete from each table for this category
    for (const table of tables) {
      await db.collection(table).deleteMany({ patient_id: patientId })
    }
  }
}

function generateId(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
