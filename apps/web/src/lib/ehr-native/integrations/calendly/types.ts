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

const CALENDLY_OAUTH_SCOPES = ['openid', 'profile', 'email'] as const

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
  uri: z.url(),
  name: z.string(),
  slug: z.string(),
  email: z.email(),
  scheduling_url: z.url().optional(),
  timezone: z.string().optional(),
  avatar_url: z.url().optional(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
})

export type CalendlyUser = z.infer<typeof calendlyUserSchema>

/**
 * Calendly event type — a configurable meeting template.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-event-type
 */
export const calendlyEventTypeSchema = z.object({
  uri: z.url(),
  name: z.string(),
  slug: z.string(),
  active: z.boolean(),
  kind: z.enum(['solo', 'group']),
  scheduling_url: z.url().optional(),
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
  scheduling_links: z.array(z.object({ url: z.url() })).optional(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
})

export type CalendlyEventType = z.infer<typeof calendlyEventTypeSchema>

/**
 * Calendly scheduled event — a booked meeting.
 * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-event
 */
export const calendlyScheduledEventSchema = z.object({
  uri: z.url(),
  name: z.string(),
  status: z.enum(['active', 'canceled']),
  start_time: z.iso.datetime(),
  end_time: z.iso.datetime(),
  event_type: z.url(),
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
      join_url: z.url().optional(),
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
        user: z.url(),
        user_name: z.string(),
        user_email: z.email().optional(),
        status: z.enum(['active', 'canceled']).optional(),
      }),
    )
    .optional(),
  guests: z
    .array(
      z.object({
        email: z.email(),
        status: z.enum(['active', 'canceled']).optional(),
      }),
    )
    .optional(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
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
  uri: z.url(),
  email: z.email(),
  name: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  status: z.enum(['active', 'canceled']),
  timezone: z.string().optional(),
  event: z.url(),
  invitee_url: z.url().optional(),
  cancel_url: z.url().optional(),
  reschedule_url: z.url().optional(),
  text_reminder_number: z.string().optional(),
  canceled_at: z.iso.datetime().optional(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
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

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const calendlyOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.url(),
  scopes: z.array(z.string()).default([...CALENDLY_OAUTH_SCOPES]),
  authorizeUrl: z.url().default('https://auth.calendly.com/oauth/authorize'),
  tokenUrl: z.url().default('https://auth.calendly.com/oauth/token'),
})

export type CalendlyOAuthConfig = z.infer<typeof calendlyOAuthConfigSchema>

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------
