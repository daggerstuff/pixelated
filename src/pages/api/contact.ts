import type { APIContext } from 'astro'

import { createBuildSafeLogger } from '../../lib/logging/build-safe-logger'

// Mock ContactService
interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
}

interface SubmissionContext {
  ipAddress: string
  userAgent: string
  timestamp: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

const toContactFormData = (
  value: Record<string, unknown>,
): ContactFormData | null => {
  const { name, email, subject, message } = value
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof subject !== 'string' ||
    typeof message !== 'string'
  ) {
    return null
  }

  return { name, email, subject, message }
}

const getHeaderValue = (request: Request, headerName: string): string =>
  request.headers.get(headerName) ?? ''

class MockContactService {
  async submitContactForm(
    _contactFormData: ContactFormData,
    _submissionContext: SubmissionContext,
  ): Promise<{ success: boolean; submissionId: string }> {
    return { success: true, submissionId: 'mock-submission-id' }
  }
}
// Create a scoped logger for this endpoint
const logger = createBuildSafeLogger('api/contact')

// Initialize contact service
const contactService = new MockContactService()

// Helper function to get client IP address
function getClientIP(request: Request): string {
  // Check for forwarded headers (common in production with load balancers)
  const forwardedFor = getHeaderValue(request, 'x-forwarded-for')
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim() ?? ''
    logger.debug('Extracted IP from x-forwarded-for', { forwardedFor, ip })
    return ip
  } else {
    logger.debug('No x-forwarded-for header present', { forwardedFor })
  }

  const realIP = getHeaderValue(request, 'x-real-ip')
  if (realIP) {
    logger.debug('Extracted IP from x-real-ip', { realIP })
    return realIP
  }

  const remoteAddr = getHeaderValue(request, 'x-remote-addr')
  if (remoteAddr) {
    logger.debug('Extracted IP from x-remote-addr', { remoteAddr })
    return remoteAddr
  }

  // Fallback to localhost for development
  logger.debug('Falling back to localhost IP', { fallback: '127.0.0.1' })
  return '127.0.0.1'
}

export const POST = async ({ request }: APIContext) => {
  const startTime = Date.now()

  try {
    const requestBodyText = await request.text()
    const requestBody = parseJsonBody(requestBodyText)
    if (!isRecord(requestBody)) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            'Invalid request format. Please check your data and try again.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate required fields exist
    const formData = requestBody
    const requiredFields = ['name', 'email', 'subject', 'message']
    for (const field of requiredFields) {
      const value = formData[field]
      if (typeof value !== 'string' || !value.trim()) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Missing or invalid field: ${field}`,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
    }

    const contactFormData = toContactFormData(formData)
    if (!contactFormData) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request payload format.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Prepare submission context
    const submissionContext = {
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') ?? 'Unknown',
      timestamp: new Date().toISOString(),
    }

    // Submit contact form through service
    const result = await contactService.submitContactForm(
      contactFormData,
      submissionContext,
    )

    // Log the submission attempt
    const duration = Date.now() - startTime
    logger.info('Contact form submission processed', {
      success: result.success,
      submissionId: result.submissionId,
      email: contactFormData.email,
      ipAddress: submissionContext.ipAddress,
      duration: `${duration}ms`,
    })

    // Return response
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const duration = Date.now() - startTime

    logger.error('Contact form submission failed with unexpected error', {
      error: error instanceof Error ? String(error) : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userAgent: getHeaderValue(request, 'user-agent'),
      ip: getClientIP(request),
      duration: `${duration}ms`,
    })

    return new Response(
      JSON.stringify({
        success: false,
        message:
          'An unexpected error occurred. Please try again later or contact support if the problem persists.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// OPTIONS endpoint for CORS preflight
export const OPTIONS = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  })
}
