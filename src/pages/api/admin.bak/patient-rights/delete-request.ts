// import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import { createDataDeletionRequest } from '../../../../lib/services/patient-rights/dataDeleteService'

// Create a logger instance for this endpoint
const logger = createBuildSafeLogger('patient-rights-api')

// Define the expected request shape
interface DeleteRequestData {
  'patient-id': string
  'patient-name': string
  'deletion-scope': 'all' | 'specific'
  'data-categories'?: string[]
  'deletion-reason': string
  'additional-details'?: string
  'hipaa-confirmation': boolean
}

export const POST = async ({ request, cookies }) => {
  try {
    // Authenticate request
    const user = await getCurrentUser(cookies)
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Check if user has admin role
    if (!user.roles?.includes('admin')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Insufficient permissions',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse and validate the form data
    const formData = await request.formData()

    // Extract form values
    const patientId = formData.get('patient-id') as string
    const patientName = formData.get('patient-name') as string
    const deletionScope = formData.get('deletion-scope') as 'all' | 'specific'
    const deletionReason = formData.get('deletion-reason') as string
    const additionalDetails =
      (formData.get('additional-details') as string) || ''
    const hipaaConfirmation = formData.get('hipaa-confirmation') === 'on'

    // Get data categories if specific scope is selected
    let dataCategories: string[] = []
    if (deletionScope === 'specific') {
      // Form data can have multiple entries with the same name
      dataCategories = formData.getAll('data-categories') as string[]
    }

    // Basic validation
    if (!patientId || !patientName || !deletionScope || !deletionReason) {
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

    if (
      deletionScope === 'specific' &&
      (!dataCategories || dataCategories.length === 0)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Please select at least one data category to delete',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (!hipaaConfirmation) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'HIPAA compliance confirmation is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Prepare the request data
    const deletionRequest: DeleteRequestData = {
      'patient-id': patientId,
      'patient-name': patientName,
      'deletion-scope': deletionScope,
      'deletion-reason': deletionReason,
      'additional-details': additionalDetails,
      'hipaa-confirmation': hipaaConfirmation,
    }

    // Only include data categories if specific scope is selected
    if (deletionScope === 'specific') {
      deletionRequest['data-categories'] = dataCategories
    }

    // Create the deletion request in the database
    const result = await createDataDeletionRequest({
      patientId,
      patientName,
      dataScope: deletionScope,
      dataCategories: deletionScope === 'specific' ? dataCategories : [],
      reason: deletionReason,
      additionalDetails,
      requestedBy: user.id,
    })

    // Log the successful request
    logger.info('Data deletion request created', {
      requestId: result.id,
      patientId,
      scope: deletionScope,
      adminUser: user.id,
    })

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Deletion request submitted successfully',
        requestId: result.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    // Log the error
    logger.error('Error processing data deletion request', {
      error: error instanceof Error ? String(error) : String(error),
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
}
