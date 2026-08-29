/**
 * Calendly integration domain types and Zod schemas.
 *
 * Calendly API v2: https://developer.calendly.com/api-docs/v2-0-reference
 *
 * All external API response shapes are validated with Zod per ADR-002.
 *
 * @file This file defines the domain types for the Calendly integration,
 *       including OAuth types, webhook event types, API response schemas,
 *       and the adapter interface contract.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

const CALENDLY_PROVIDER_NAME = 'calendly' as const

const CALENDLY_API_BASE_URL = 'https://api.calendly.com' as const

const CALENDLY_OAUTH_SCOPES = ['openid', 'profile', 'email'] as const

const CALENDLY_WEBHOOK_EVENTS = [
  'invitee.created',
  'invitee.canceled',
  'routing_form_submission.created',
] as const

// ---------------------------------------------------------------------------
// OAuth types (re-export from shared types for convenience)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Calendly API response schemas
// ---------------------------------------------------------------------------

/**
 * Calendly user resource — the authenticated user's profile.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-user
 */
export const calendlyUserSchema = z.object({
  uri: z.string().url(),
  name: z.string(),
  slug: z.string(),
  email: z.string().email(),
  scheduling_url: z.string().url().optional(),
  timezone: z.string().optional(),
  avatar_url: z.string().url().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export type CalendlyUser = z.infer<typeof calendlyUserSchema>

/**
 * Calendly event type — a configurable meeting template.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-event-type
 */
export const calendlyEventTypeSchema = z.object({
  uri: z.string().url(),
  name: z.string(),
  slug: z.string(),
  active: z.boolean(),
  kind: z.enum(['solo', 'group']),
  scheduling_url: z.string().url().optional(),
  duration: z.number().int().positive().optional(),
  description_plain: z.string().optional(),
  description_html: z.string().optional(),
  color: z.string().optional(),
  custom_questions: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum([
          'text',
          'textarea',
          'phone_number',
          'checkboxes',
          'radio_buttons',
        ]),
        required: z.boolean(),
        answer_choices: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  profile_name: z.string().optional(),
  profile_type: z.string().optional(),
  scheduling_links: z.array(z.object({ url: z.string().url() })).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
})

export type CalendlyEventType = z.infer<typeof calendlyEventTypeSchema>

/**
 * Calendly scheduled event — a booked meeting.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-event
 */
export const calendlyScheduledEventSchema = z.object({
  uri: z.string().url(),
  name: z.string(),
  status: z.enum(['active', 'canceled']),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  event_type: z.string().url(),
  location: z
    .object({
      type: z.enum([
        'physical',
        'google_conference',
        'zoom',
        'microsoft_teams_conference',
        'custom',
      ]),
      location: z.string().optional(),
      status: z.enum(['active', 'trying', 'failed']).optional(),
      join_url: z.string().url().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  invitees_counter: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative().optional(),
  }),
  event_memberships: z
    .array(
      z.object({
        user: z.string().url(),
        user_name: z.string(),
        user_email: z.string().email().optional(),
        status: z.enum(['active', 'canceled']).optional(),
      }),
    )
    .optional(),
  guests: z
    .array(
      z.object({
        email: z.string().email(),
        status: z.enum(['active', 'canceled']).optional(),
      }),
    )
    .optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  cancellation_reason: z.string().optional(),
  canceler_name: z.string().optional(),
})

export type CalendlyScheduledEvent = z.infer<
  typeof calendlyScheduledEventSchema
>

/**
 * Calendly invitee — a person invited to a scheduled event.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-invitee
 */
export const calendlyInviteeSchema = z.object({
  uri: z.string().url(),
  email: z.string().email(),
  name: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  status: z.enum(['active', 'canceled']),
  timezone: z.string().optional(),
  event: z.string().url(),
  invitee_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  reschedule_url: z.string().url().optional(),
  text_reminder_number: z.string().optional(),
  canceled_at: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  tracking: z
    .object({
      utm_campaign: z.string().optional(),
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
      salesforce_uuid: z.string().optional(),
    })
    .optional(),
  tracking_fields: z
    .array(
      z.object({
        name: z.string(),
        value: z.string().optional(),
      }),
    )
    .optional(),
  payment_method: z.string().optional(),
  text_notifications: z.boolean().optional(),
})

export type CalendlyInvitee = z.infer<typeof calendlyInviteeSchema>

// ---------------------------------------------------------------------------
// Webhook event schemas
// ---------------------------------------------------------------------------

/**
 * Calendly webhook payload — the body sent to our webhook endpoint.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/webhooks
 */
const calendlyWebhookPayloadSchema = z.object({
  event: z.string(),
  time: z.string().datetime(),
  payload: z.object({
    cancel_url: z.string().url().optional(),
    created_at: z.string().datetime().optional(),
    email: z.string().email().optional(),
    event: z.string().url().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    name: z.string().optional(),
    new_invitee: z.string().url().optional(),
    old_invitee: z.string().url().optional(),
    profile: z
      .object({
        type: z.string(),
        name: z.string(),
        owner: z.string().email().optional(),
      })
      .optional(),
    reschedule_url: z.string().url().optional(),
    rescheduled: z.boolean().optional(),
    status: z.enum(['active', 'canceled']).optional(),
    text_reminder_number: z.string().optional(),
    timezone: z.string().optional(),
    tracking: z
      .object({
        utm_campaign: z.string().optional(),
        utm_source: z.string().optional(),
        utm_medium: z.string().optional(),
        utm_content: z.string().optional(),
        utm_term: z.string().optional(),
      })
      .partial()
      .optional(),
    updated_at: z.string().datetime().optional(),
    uri: z.string().url().optional(),
    cancellation_reason: z.string().optional(),
    canceler_name: z.string().optional(),
  }),
})

type CalendlyWebhookPayload = z.infer<
  typeof calendlyWebhookPayloadSchema
>

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const calendlyOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([...CALENDLY_OAUTH_SCOPES]),
  authorizeUrl: z
    .string()
    .url()
    .default('https://auth.calendly.com/oauth/authorize'),
  tokenUrl: z.string().url().default('https://auth.calendly.com/oauth/token'),
})

export type CalendlyOAuthConfig = z.infer<typeof calendlyOAuthConfigSchema>

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

const calendlyWebhookSignatureConfigSchema = z.object({
  provider: z.literal(CALENDLY_PROVIDER_NAME),
  headerName: z.string().default('calendly-webhook-signature'),
  secret: z.string().min(1),
  format: z.literal('stripe-composite').default('stripe-composite'),
  algorithm: z.literal('sha256').default('sha256'),
})

type CalendlyWebhookSignatureConfig = z.infer<
  typeof calendlyWebhookSignatureConfigSchema
>

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------

const calendlyWebhookEventTypeSchema = z.enum([
  'invitee.created',
  'invitee.canceled',
  'routing_form_submission.created',
])

type CalendlyWebhookEventType = z.infer<
  typeof calendlyWebhookEventTypeSchema
>
