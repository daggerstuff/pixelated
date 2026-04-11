import { randomUUID } from 'node:crypto'

import type { APIRoute } from 'astro'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth/types'
import { query, initializeDatabase } from '@/lib/db'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Create a logger instance
const logger = createBuildSafeLogger('patient-rights-export')

/**
 * Check whether a therapist/provider has an existing session with the target patient.
 * This is the database-backed IDOR guard that replaces the stub.
 */
async function therapistHasSessionWithPatient(
  therapistId: string,
  patientId: string,
): Promise<boolean> {
  try {
    await initializeDatabase()
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM sessions
        WHERE therapist_id = $1
          AND client_id = $2
          AND state != 'cancelled'
      ) AS exists`,
      [therapistId, patientId],
    )
    return result.rows[0]?.exists === true
  } catch (err) {
    // If DB is unavailable we fail closed — deny access
    logger.error('Failed to verify therapist-patient assignment', {
      therapistId,
      patientId,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// Schema for validating the request body
const createExportSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  dataFormat: z.enum(['json', 'csv', 'fhir', 'ccd', 'hl7']),
  dataSections: z
    .array(z.string())
    .min(1, 'At least one data section must be selected'),
  recipientType: z.enum(['patient', 'provider', 'research']),
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientEmail: z.string().email('Valid email address is required'),
  notes: z.string().optional(),
  includeEncryptionKey: z.boolean().optional().default(true),
})

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify user is authenticated and authorized
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Resolve the full user object to check permissions
    // currentUser from getCurrentUser only has id and role – we need permissions
    // so we model a minimal AuthUser from the JWT claims available
    const sessionUser = currentUser as unknown as AuthUser

    // Check if user has permission to create export requests
    if (!sessionUser.permissions?.includes('create:data_exports')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Parse and validate request body
    const requestData = await request.json()
    const validationResult = createExportSchema.safeParse(requestData)

    if (!validationResult.success) {
      const { fieldErrors } = validationResult.error.flatten()
      logger.warn('Invalid export request data', {
        errors: fieldErrors,
        userId: currentUser.id,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request data',
          errors: fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const validatedData = validationResult.data

    // IDOR guard: verify the requesting user is authorized for this specific patient.
    // Role alone is insufficient — we enforce resource-level ownership.
    const isAdmin =
      currentUser.role === 'admin' || currentUser.role === 'superadmin'
    const isSelf = currentUser.id === validatedData.patientId

    // Therapists and providers must have an existing session with the patient in the DB.
    const isTherapistOrProvider =
      currentUser.role === 'therapist' || currentUser.role === 'provider'
    const hasAssignedSession =
      isTherapistOrProvider &&
      (await therapistHasSessionWithPatient(
        currentUser.id,
        validatedData.patientId,
      ))

    if (!isAdmin && !isSelf && !hasAssignedSession) {
      logger.warn('IDOR attempt blocked on export creation', {
        requestingUserId: currentUser.id,
        requestingRole: currentUser.role,
        targetPatientId: validatedData.patientId,
      })
      return new Response(
        JSON.stringify({
          success: false,
          message:
            'You do not have permission to export data for this patient.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Create a new export request
    const exportRequest = {
      id: randomUUID(),
      patientId: validatedData.patientId,
      initiatedBy: currentUser.id,
      initiatedDate: new Date().toISOString(),
      recipientType: validatedData.recipientType,
      recipientName: validatedData.recipientName,
      recipientEmail: validatedData.recipientEmail,
      dataFormat: validatedData.dataFormat,
      dataSections: validatedData.dataSections,
      status: 'pending' as const,
      notes: validatedData.notes,
      includeEncryptionKey: validatedData.includeEncryptionKey,
    }

    // In a real implementation, you would save this to your database
    // For this example, we'll just return success
    // db.exportRequests.create(exportRequest);

    // Log the export request for audit purposes
    logger.info('Export request created', {
      exportId: exportRequest.id,
      patientId: exportRequest.patientId,
      userId: currentUser.id,
      recipientType: exportRequest.recipientType,
      recipientEmail: exportRequest.recipientEmail,
      dataFormat: exportRequest.dataFormat,
      dataSections: exportRequest.dataSections.join(','),
    })

    // Queue the export job for processing
    // In a real implementation, you would add this to a queue
    // queue.add('process-export-request', { exportId: exportRequest.id });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Export request created successfully',
        data: {
          exportId: exportRequest.id,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    logger.error('Error creating export request', { error })

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while processing your request',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
