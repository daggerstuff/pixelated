import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { protectRoute } from '../../../../lib/auth/serverAuth'
import { updateDataDeletionRequest } from '../../../../lib/services/patient-rights/dataDeleteService'

// Create a logger instance for this endpoint
const logger = createBuildSafeLogger('patient-rights-api')

// Define the expected request shape
interface UpdateDeletionRequestBody {
  id: string
  status: 'pending' | 'completed' | 'denied' | 'in-progress'
  processingNotes?: string
}

export const POST: APIRoute = protectRoute({
  requiredRole: 'admin',
})(async ({ request, locals }) => {
  try {
    const { user } = locals

    // Parse and validate the request body
    const body = (await request.json()) as UpdateDeletionRequestBody

    // Basic validation
    if (!body.id || !body.status) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required fields',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const validStatuses = ['pending', 'completed', 'denied', 'in-progress']
    if (!validStatuses.includes(body.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid status value',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Update the deletion request in the database
    const result = await updateDataDeletionRequest({
      id: body.id,
      status: body.status,
      processedBy: user.id,
      processingNotes: body.processingNotes || undefined,
    })

    // Log the successful update
    logger.info('Data deletion request updated', {
      requestId: body.id,
      newStatus: body.status,
      adminUser: user.id,
    })

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Deletion request ${body.status === 'completed' ? 'approved' : body.status === 'denied' ? 'denied' : 'updated'} successfully`,
        request: result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    // Log the error
    logger.error('Error updating data deletion request', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while processing your request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})
