import type { APIRoute } from 'astro'
import { z } from 'zod'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import { getSession } from '../../../lib/auth/session'

const logger = createBuildSafeLogger('api:patient-rights:update-export')

const parseJsonBody = (bodyText: string): unknown => {
  if (!bodyText) {
    return null
  }

  try {
    return JSON.parse(bodyText)
  } catch {
    return null
  }
}

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
      downloadUrl: z.url().optional(),
      expiresAt: z.string().optional(),
      encryptionKeyUrl: z.url().optional(),
      fileSize: z.number().optional(),
      fileChecksum: z.string().optional(),
    })
    .optional(),
})

export const put: APIRoute = async ({ request }) => {
  try {
    // Verify user is authenticated and authorized
    const sessionData = await getSession(request)
    if (!sessionData) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { user } = sessionData

    // Check if user has permission to update export requests
    if (!user.permissions?.includes('update:data_exports')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Parse and validate request body
    const requestDataText = await request.text()
    const requestData = parseJsonBody(requestDataText)
    if (!requestData || typeof requestData !== 'object') {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid request data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const validationResult = updateExportSchema.safeParse(requestData)

    if (!validationResult.success) {
      logger.warn('Invalid export update data', {
        errors: validationResult.error.issues,
        userId: user.id,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const validatedData = validationResult.data

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

    // Log the update for audit purposes
    logger.info('Export request updated', {
      exportId: validatedData.exportId,
      userId: user.id,
      newStatus: validatedData.status,
      hasCompletionDetails: !!validatedData.completionDetails,
    })

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
