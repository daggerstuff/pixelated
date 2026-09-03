import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Create logger instance
const logger = createBuildSafeLogger('initiate-export')

// Add permissions to AuthUser if not defined in the type
declare module '../../../lib/auth' {
  interface AuthUser {
    permissions?: string[]
  }
}

// Schema for validating export request data
const initiateExportSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  dataFormats: z
    .array(z.enum(['json', 'csv', 'pdf', 'xml']))
    .min(1, 'At least one data format is required'),
  dataSections: z
    .array(z.string())
    .min(1, 'At least one data section is required'),
  recipientType: z.enum(['patient', 'provider', 'third-party']),
  recipientDetails: z.object({
    name: z.string().min(1, 'Recipient name is required'),
    email: z.email('Valid email is required'),
    organization: z.string().optional(),
    phone: z.string().optional(),
  }),
  notes: z.string().optional(),
  encryptionRequested: z.boolean().default(false),
  urgencyLevel: z.enum(['standard', 'urgent']).default('standard'),
})

export const POST = async ({
  request,
  cookies,
}: {
  request: Request
  cookies: any
}) => {
  try {
    // Get current user - use cookies instead of request
    const user = await getCurrentUser(cookies)

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const userRecord = user as Record<string, unknown>
    const userPermissions = userRecord['permissions'] as string[] | undefined
    // Check permissions
    const hasPermission =
      userPermissions?.includes('data:export:create') ??
      userPermissions?.includes('admin:patient-rights')

    if (!hasPermission) {
      logger.warn('Permission denied for initiating export', {
        userId: userRecord['id'],
        permissions: userPermissions,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have permission to initiate data exports',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Parse request body
    const requestData = await request.json().catch(() => ({}))

    // Validate the request data
    const validationResult = initiateExportSchema.safeParse(requestData)

    if (!validationResult.success) {
      logger.warn('Invalid export request data', {
        errors: (validationResult.error as { errors?: string[] })?.errors,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request data',
          errors: (validationResult.error as { errors?: string[] })?.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const validatedData = validationResult.data

    // For this example, we'll generate a mock export ID
    const exportId = `export-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // Log the export request
    logger.info('Data export request initiated', {
      exportId,
      patientId: validatedData.patientId,
      requestedBy: user.id,
      recipientType: validatedData.recipientType,
      dataFormats: validatedData.dataFormats,
      urgencyLevel: validatedData.urgencyLevel,
    })

    // Return a success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data export request initiated successfully',
        data: {
          exportId,
          status: 'pending',
          estimatedCompletionTime: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(), // 30 minutes from now
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    logger.error('Error initiating export request', { error })

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while processing your export request',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
