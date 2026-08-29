/**
 * Twilio integration domain types and Zod schemas.
 *
 * Twilio API: https://www.twilio.com/docs/usage/api
 *
 * All external API response shapes are validated with Zod per ADR-002.
 *
 * @file This file defines the domain types for the Twilio integration,
 *       including OAuth types, webhook event types, API response schemas,
 *       and the adapter interface contract.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

const TWILIO_PROVIDER_NAME = 'twilio' as const

const TWILIO_API_BASE_URL = 'https://api.twilio.com/2010-04-01' as const

const TWILIO_OAUTH_SCOPES = ['scope:read_only', 'scope:write'] as const

const TWILIO_WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'message.delivered',
  'call.initiated',
  'call.ringing',
  'call.answered',
  'call.completed',
] as const

// ---------------------------------------------------------------------------
// Twilio API response schemas
// ---------------------------------------------------------------------------

/**
 * Twilio account resource — the authenticated account.
 * @see https://www.twilio.com/docs/usage/api/account
 */
export const twilioAccountSchema = z.object({
  sid: z.string(),
  friendlyName: z.string(),
  status: z.enum(['active', 'suspended', 'closed']),
  type: z.string().optional(),
  dateCreated: z.string().datetime().optional(),
  dateUpdated: z.string().datetime().optional(),
})

export type TwilioAccount = z.infer<typeof twilioAccountSchema>

/**
 * Twilio message resource — an SMS or MMS message.
 * @see https://www.twilio.com/docs/sms/api/message-resource
 */
export const twilioMessageSchema = z.object({
  sid: z.string(),
  body: z.string(),
  from: z.string(),
  to: z.string(),
  status: z.enum([
    'queued',
    'accepted',
    'sending',
    'sent',
    'received',
    'delivered',
    'undelivered',
    'failed',
    'canceled',
  ]),
  dateSent: z.string().datetime().optional(),
  dateCreated: z.string().datetime().optional(),
  dateUpdated: z.string().datetime().optional(),
  direction: z.string().optional(),
  price: z.string().optional(),
  errorCode: z.number().int().optional(),
  errorMessage: z.string().optional(),
})

export type TwilioMessage = z.infer<typeof twilioMessageSchema>

/**
 * Twilio call resource — a voice call.
 * @see https://www.twilio.com/docs/voice/api/call-resource
 */
export const twilioCallSchema = z.object({
  sid: z.string(),
  from: z.string(),
  to: z.string(),
  status: z.enum([
    'queued',
    'ringing',
    'in-progress',
    'completed',
    'busy',
    'failed',
    'no-answer',
    'canceled',
  ]),
  duration: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  dateCreated: z.string().datetime().optional(),
  dateUpdated: z.string().datetime().optional(),
  direction: z.string().optional(),
  price: z.string().optional(),
  errorCode: z.number().int().optional(),
})

export type TwilioCall = z.infer<typeof twilioCallSchema>

/**
 * Twilio phone number resource — an incoming phone number.
 * @see https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
 */
export const twilioPhoneNumberSchema = z.object({
  sid: z.string(),
  phoneNumber: z.string(),
  friendlyName: z.string().optional(),
  capabilities: z
    .object({
      voice: z.boolean().optional(),
      sms: z.boolean().optional(),
      mms: z.boolean().optional(),
      fax: z.boolean().optional(),
    })
    .optional(),
  dateCreated: z.string().datetime().optional(),
  dateUpdated: z.string().datetime().optional(),
})

export type TwilioPhoneNumber = z.infer<typeof twilioPhoneNumberSchema>

// ---------------------------------------------------------------------------
// Webhook event schemas
// ---------------------------------------------------------------------------

/**
 * Twilio webhook payload — the body sent to our webhook endpoint.
 * @see https://www.twilio.com/docs/usage/webhooks
 */
const twilioWebhookPayloadSchema = z.object({
  MessageSid: z.string().optional(),
  CallSid: z.string().optional(),
  AccountSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
  Body: z.string().optional(),
  MessageStatus: z.string().optional(),
  CallStatus: z.string().optional(),
  Direction: z.string().optional(),
})

type TwilioWebhookPayload = z.infer<typeof twilioWebhookPayloadSchema>

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const twilioOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([...TWILIO_OAUTH_SCOPES]),
  authorizeUrl: z.string().url().default('https://www.twilio.com/authorize'),
  tokenUrl: z.string().url().default('https://www.twilio.com/oauth/token'),
})

export type TwilioOAuthConfig = z.infer<typeof twilioOAuthConfigSchema>

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

const twilioWebhookSignatureConfigSchema = z.object({
  provider: z.literal(TWILIO_PROVIDER_NAME),
  headerName: z.string().default('X-Twilio-Signature'),
  secret: z.string().min(1),
  format: z.literal('twilio').default('twilio'),
  algorithm: z.literal('sha256').default('sha256'),
})

type TwilioWebhookSignatureConfig = z.infer<
  typeof twilioWebhookSignatureConfigSchema
>

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------

const twilioWebhookEventTypeSchema = z.enum([
  'message.received',
  'message.sent',
  'message.delivered',
  'call.initiated',
  'call.ringing',
  'call.answered',
  'call.completed',
])

type TwilioWebhookEventType = z.infer<
  typeof twilioWebhookEventTypeSchema
>
