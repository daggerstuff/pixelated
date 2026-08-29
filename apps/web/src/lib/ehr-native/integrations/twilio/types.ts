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

const TWILIO_OAUTH_SCOPES = ['scope:read_only', 'scope:write'] as const

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
  dateCreated: z.iso.datetime().optional(),
  dateUpdated: z.iso.datetime().optional(),
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
  dateSent: z.iso.datetime().optional(),
  dateCreated: z.iso.datetime().optional(),
  dateUpdated: z.iso.datetime().optional(),
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
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
  dateCreated: z.iso.datetime().optional(),
  dateUpdated: z.iso.datetime().optional(),
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
  dateCreated: z.iso.datetime().optional(),
  dateUpdated: z.iso.datetime().optional(),
})

export type TwilioPhoneNumber = z.infer<typeof twilioPhoneNumberSchema>

// ---------------------------------------------------------------------------
// Webhook event schemas
// ---------------------------------------------------------------------------

/**
 * Twilio webhook payload — the body sent to our webhook endpoint.
 * @see https://www.twilio.com/docs/usage/webhooks
 */

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const twilioOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.url(),
  scopes: z.array(z.string()).default([...TWILIO_OAUTH_SCOPES]),
  authorizeUrl: z.url().default('https://www.twilio.com/authorize'),
  tokenUrl: z.url().default('https://www.twilio.com/oauth/token'),
})

export type TwilioOAuthConfig = z.infer<typeof twilioOAuthConfigSchema>

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------
