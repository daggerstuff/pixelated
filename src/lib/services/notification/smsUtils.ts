import twilio, { type Twilio } from 'twilio'
import { config } from '@/config/env.config'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('smsUtils')

let twilioClient: ReturnType<typeof twilio> | null = null

/**
 * Initialize Twilio client with credentials
 */
export function initializeTwilioClient(): ReturnType<typeof twilio> | null {
  const accountSid = config.twilio.accountSid()
  const authToken = config.twilio.authToken()

  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured')
    return null
  }

  try {
    twilioClient = twilio(accountSid, authToken)
    return twilioClient
  } catch (error: unknown) {
    logger.error('Failed to initialize Twilio client:', error)
    return null
  }
}

/**
 * Get the Twilio client, initializing it if necessary
 */
export function getTwilioClient(): Twilio | null {
  if (!twilioClient) {
    return initializeTwilioClient()
  }
  return twilioClient
}

/**
 * Send an SMS message using Twilio
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient()
  if (!client) {
    throw new Error('Twilio client not initialized')
  }

  const from = config.twilio.phoneNumber()
  if (!from) {
    throw new Error('Twilio phone number not configured')
  }

  try {
    const message = await client.messages.create({
      body,
      to,
      from,
    })

    logger.info('SMS sent successfully', {
      messageId: message.sid,
      to,
      status: message.status,
    })

    return true
  } catch (error: unknown) {
    logger.error('Failed to send SMS:', error)
    throw error
  }
}

/**
 * Validate a phone number format
 * This is a basic validation - you might want to use a more comprehensive solution
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Basic regex for E.164 format (+1234567890)
  const phoneRegex = /^\+[1-9]\d{1,14}$/
  return phoneRegex.test(phone)
}
