import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { mongoClient } from '../../lib/db/mongoClient'
import { getAuditLogger } from '../../security/audit.logging'
import { generateId } from '../../utils/ids'

// Setup logging
const logger = createBuildSafeLogger('data-delete-service')
const auditLogger = getAuditLogger('patient-rights')

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
    const _result = await (mongoClient as any)['db']
      .collection('data_deletion_requests')
      .insertOne(deletionRequest)

    // Log the action for audit purposes
    auditLogger.log({
      action: 'create_deletion_request',
      resource: 'patient_data',
      resourceId: params.patientId,
      userId: params.requestedBy,
      details: {
        requestId,
        dataScope: params.dataScope,
        reason: params.reason,
        categories: params.dataCategories,
      },
    })

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
    const request = await (mongoClient as any)['db']
      .collection('data_deletion_requests')
      .findOne({ id })

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
  try {
  const query = (mongoClient as any)['db'].collection('data_deletion_requests')
    const filter: Record<string, unknown> = {}
    if (filters) {
      if (filters.status) {
        filter.status = filters.status
      }
      if (filters.patientId) {
        filter.patientId = filters.patientId
      }
      if (filters.dataScope) {
        filter.dataScope = filters.dataScope
      }
    }

    const requests = await query
      .find(filter)
      .sort({ dateRequested: -1 })
      .toArray()

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

    // Update the request in the database
    const result = await (mongoClient as any)['db']
      .collection('data_deletion_requests')
      .findOneAndUpdate(
        { id: params.id },
        { $set: updateData },
        { returnDocument: 'after' },
      )

    if (!result.value) {
      throw new Error('Failed to update data deletion request')
    }

    // Get the full request data for audit logging
    const updatedRequest = result.value as DataDeletionRequest

    // Log the action for audit purposes
    auditLogger.log({
      action: 'update_deletion_request',
      resource: 'patient_data',
      resourceId: updatedRequest.patientId,
      userId: params.processedBy,
      details: {
        requestId: params.id,
        newStatus: params.status,
        notes: params.processingNotes || 'No notes provided',
      },
    })

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
    auditLogger.log({
      action: 'execute_data_deletion',
      resource: 'patient_data',
      resourceId: request.patientId,
      userId: processedBy,
      details: {
        requestId: request.id,
        dataScope: request.dataScope,
        categories: request.dataCategories,
        reason: request.reason,
      },
    })
  } catch (error: unknown) {
    logger.error('Error executing data deletion', {
      error: error instanceof Error ? String(error) : String(error),
      requestId: request.id,
      patientId: request.patientId,
    })

    // We don't throw here to avoid blocking the status update
    // Instead, we log the error and continue

    // Log the failure for audit purposes
    auditLogger.log({
      action: 'data_deletion_error',
      resource: 'patient_data',
      resourceId: request.patientId,
      userId: processedBy,
      details: {
        requestId: request.id,
        error: error instanceof Error ? String(error) : String(error),
      },
    })
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

  const session = (mongoClient as any)['client'].startSession()

  try {
    await session.withTransaction(async () => {
      for (const collection of collections) {
        await (mongoClient as any)['db']
          .collection(collection)
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

    // Delete from each table for this category
      for (const table of tables) {
      await (mongoClient as any)['db']
        .collection(table)
        .deleteMany({ patient_id: patientId })
    }
  }
}
