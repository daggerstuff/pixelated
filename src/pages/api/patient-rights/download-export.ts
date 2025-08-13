import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { getUser } from '../../../lib/auth/sessionUtils'

// Initialize logger
const logger = createBuildSafeLogger('patient-rights-export')

// Schema for validating download request
const downloadRequestSchema = z.object({
  exportId: z.string().min(1, 'Export ID is required'),
  token: z.string().min(1, 'Security token is required'),
})

export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract query parameters from the URL
    const url = new URL(request.url)
    const exportId = url.searchParams.get('exportId')
    const token = url.searchParams.get('token')

    // Validate the request parameters
    const validationResult = downloadRequestSchema.safeParse({
      exportId,
      token,
    })

    if (!validationResult.success) {
      logger.warn('Invalid export download request', {
        errors: validationResult.error.errors,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request parameters',
          errors: validationResult.error.errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // At this point, validationResult.success is true, so validationResult.data exists
    const validatedData = validationResult.data

    // Get current user
    const user = await getUser(request)

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check permissions
    const hasPermission =
      user.permissions?.includes('data:export:download') ||
      user.permissions?.includes('admin:patient-rights')

    if (!hasPermission) {
      logger.warn('Permission denied for downloading export', {
        userId: user.id,
        exportId: validatedData.exportId,
        permissions: user.permissions,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'You do not have permission to download exports',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // In a real implementation, you would:
    // 1. Verify the security token is valid for this export ID
    // 2. Check if the export is complete and ready for download
    // 3. Verify the user has permission to download this specific export
    // 4. Generate or retrieve the export file
    // 5. Return the file as a download

    // For this example, we'll check if the token is valid (mock check)
    if (token !== 'mock-secure-token') {
      logger.warn('Invalid security token for export download', {
        exportId: validatedData.exportId,
        userId: user.id,
      })

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid or expired security token',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Check if the export is ready (in this mock example, we'll consider exports with 'complete' in the ID as ready)
    const safeExportId = validatedData.exportId
    if (!safeExportId.includes('complete')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Export is not ready for download yet',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Log the download event
    logger.info('Export download initiated', {
      exportId: safeExportId,
      userId: user.id,
    })

    // Generate mock data for the export
    const mockExportData = {
      metadata: {
        exportId: safeExportId,
        generatedAt: new Date().toISOString(),
        patientId: process.env.PATIENT_ID || 'example-patient-id',
        requestedBy: user.id,
        formatVersion: '1.0',
      },
      patientData: {
        demographics: {
          name: 'Jane Doe',
          dateOfBirth: '1980-01-01',
          gender: 'Female',
          address: '123 Main St, Anytown, USA',
        },
        medicalRecords: [
          {
            date: '2023-01-15',
            provider: 'Dr. Smith',
            notes: 'Annual physical examination',
            diagnoses: [
              'Z00.00 - Encounter for general adult medical examination without abnormal findings',
            ],
          },
          {
            date: '2023-03-22',
            provider: 'Dr. Johnson',
            notes: 'Follow-up visit',
            diagnoses: [
              'J06.9 - Acute upper respiratory infection, unspecified',
            ],
          },
        ],
        medications: [
          {
            name: 'Lisinopril',
            dosage: '10mg',
            frequency: 'Daily',
            startDate: '2022-11-01',
          },
        ],
      },
    }

    // Convert the mock data to JSON and prepare the download
    const fileContent = JSON.stringify(mockExportData, null, 2)
    const filename = `patient-data-export-${safeExportId}.json`

    // Return the file as a download
    return new Response(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Security-Policy': "default-src 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    logger.error('Error processing export download', { error })

    return new Response(
      JSON.stringify({
        success: false,
        message: 'An error occurred while processing your download request',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
