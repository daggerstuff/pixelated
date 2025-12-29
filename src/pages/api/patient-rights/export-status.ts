import { z } from 'zod'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'

// Create logger instance
const logger = createBuildSafeLogger('export-status')

// Schema for validating status check request
const exportStatusSchema = z.object({
  exportId: z.string().min(1, 'Export ID is required'),
})

// Add permissions to AuthUser if not defined in the type
declare module '../../../lib/auth' {
  interface AuthUser {
    permissions?: string[]
  }
}

export const GET = async ({ request, cookies }) => {
  try {
    // Extract query parameters from the URL
    const url = new URL(request.url)
    const exportId = url.searchParams.get('exportId')

    // Validate the exportId parameter
    const validationResult = exportStatusSchema.safeParse({ exportId })

    if (!validationResult.success) {
      logger.warn('Invalid export status request', {
        errors: validationResult.error.errors,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid export ID',
          errors: validationResult.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Get current user - use cookies instead of request
    const user = await getCurrentUser(cookies)

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check permissions
    const hasPermission =
      user.permissions?.includes('data:export:read') ||
      user.permissions?.includes('admin:patient-rights')

    if (!hasPermission) {
      logger.warn('Permission denied for checking export status', {
        userId: user.id,
        exportId: validationResult.data.exportId,
        permissions: user.permissions,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have permission to check export status',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // In a real implementation, you would:
    // 1. Query the database for the export request with the given ID
    // 2. Verify the user has permission to view this specific export (owner, admin, or has relevant permissions)
    // 3. Return the current status of the export request

    // For this example, we'll simulate different statuses based on the export ID
    let status, progress, estimatedCompletionTime, downloadUrl

    // Use validated exportId which we know is not null
    const validatedExportId = validationResult.data.exportId

    if (validatedExportId.includes('complete')) {
      status = 'completed'
      progress = 100
      downloadUrl = `/api/patient-rights/download-export?exportId=${validatedExportId}&token=mock-secure-token`
    } else if (validatedExportId.includes('fail')) {
      status = 'failed'
      progress = 50
    } else if (validatedExportId.includes('process')) {
      status = 'processing'
      progress = 60
      estimatedCompletionTime = new Date(
        Date.now() + 10 * 60 * 1000,
      ).toISOString() // 10 minutes from now
    } else {
      status = 'pending'
      progress = 10
      estimatedCompletionTime = new Date(
        Date.now() + 25 * 60 * 1000,
      ).toISOString() // 25 minutes from now
    }

    // Log the status check
    logger.info('Export status checked', {
      exportId: validatedExportId,
      requestedBy: user.id,
      status,
    })

    // Return the status
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          exportId: validatedExportId,
          status,
          progress,
          estimatedCompletionTime,
          downloadUrl,
          lastUpdated: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    logger.error('Error checking export status', { error })

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while checking the export status',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
