// import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { getSession } from '../../../lib/auth/session'

const logger = createBuildSafeLogger('api:patient-rights:update-export')

// Schema for validating the request body
const updateExportSchema = z.object({
  exportId: z.string().min(1, 'Export ID is required'),
  status: z.enum([
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'delivered',
  ]),
  notes: z.string().optional(),
  completionDetails: z
    .object({
      downloadUrl: z.string().url().optional(),
      expiresAt: z.string().optional(),
      encryptionKeyUrl: z.string().url().optional(),
      fileSize: z.number().optional(),
      fileChecksum: z.string().optional(),
    })
    .optional(),
})

export const put = async ({ request }) => {
  try {
    // Verify user is authenticated and authorized
    const sessionData = await getSession(request)
    if (!sessionData || !sessionData.user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { user } = sessionData

    // Check if user has permission to update export requests
    if (!user.app_metadata?.permissions?.includes('update:data_exports')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Parse and validate request body
    const requestData = await request.json()
    const validationResult = updateExportSchema.safeParse(requestData)

    if (!validationResult.success) {
      logger.warn('Invalid export update data', {
        errors: validationResult.error.errors,
        userId: user.id,
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

    // In a real implementation, you would retrieve the existing export request
    // const existingExport = await db.exportRequests.findUnique({ where: { id: validatedData.exportId } });

    // if (!existingExport) {
    //   return new Response(
    //     JSON.stringify({ success: false, message: 'Export request not found' }),
    //     { status: 404, headers: { 'Content-Type': 'application/json' } }
    //   );
    // }

    // Check for valid status transitions
    // This ensures status changes follow a logical flow
    // const validTransitions = {
    //   pending: ['processing', 'cancelled'],
    //   processing: ['completed', 'failed'],
    //   completed: ['delivered'],
    //   failed: ['pending'],
    //   cancelled: [],
    //   delivered: []
    // };

    // if (!validTransitions[existingExport.status].includes(validatedData.status)) {
    //   return new Response(
    //     JSON.stringify({
    //       success: false,
    //       message: `Invalid status transition from ${existingExport.status} to ${validatedData.status}`
    //     }),
    //     { status: 400, headers: { 'Content-Type': 'application/json' } }
    //   );
    // }

    // Required fields for specific status transitions
    if (
      validatedData.status === 'completed' &&
      !validatedData.completionDetails
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Completion details are required when status is completed',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Update the export request
    // In a real implementation, you would update the record in your database
    // const updatedExport = await db.exportRequests.update({
    //   where: { id: validatedData.exportId },
    //   data: {
    //     status: validatedData.status,
    //     notes: validatedData.notes,
    //     completionDetails: validatedData.completionDetails,
    //     lastUpdatedBy: user.id,
    //     lastUpdatedAt: new Date().toISOString()
    //   }
    // });

    // Log the update for audit purposes
    logger.info('Export request updated', {
      exportId: validatedData.exportId,
      userId: user.id,
      newStatus: validatedData.status,
      hasCompletionDetails: !!validatedData.completionDetails,
    })

    // If status changed to 'delivered', send notification to patient/recipient
    // if (validatedData.status === 'delivered') {
    //   await notificationService.sendExportDeliveryNotification(validatedData.exportId);
    // }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Export request updated successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    logger.error('Error updating export request', { error })

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while processing your request',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
