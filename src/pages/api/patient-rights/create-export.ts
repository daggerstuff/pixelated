import { z } from 'zod'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { auth } from '@/lib/auth'
import { randomUUID } from 'crypto'

// Create a logger instance
const logger = createBuildSafeLogger('patient-rights-export')

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

export const POST = async ({ request }) => {
  try {
    // Verify user is authenticated and authorized
    const session = await auth.verifySession(request)
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check if user has permission to create export requests
    if (
      !(session as unknown as AuthUser).permissions?.includes(
        'create:data_exports',
      )
    ) {
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Parse and validate request body
    const requestData = await request.json()
    const validationResult = createExportSchema.safeParse(requestData)

    if (!validationResult.success) {
      logger.warn('Invalid export request data', {
        errors: validationResult.error.errors,
        userId: session.userId,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const validatedData = validationResult.data

    // Create a new export request
    const exportRequest = {
      id: randomUUID(),
      patientId: validatedData.patientId,
      initiatedBy: session.userId,
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
      userId: session.userId,
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
