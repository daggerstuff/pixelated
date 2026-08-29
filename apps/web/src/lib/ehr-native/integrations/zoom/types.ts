/**
 * Zoom integration domain types and Zod schemas.
 *
 * Zoom API v2: https://developers.zoom.us/docs/api/rest/
 *
 * All external API response shapes are validated with Zod per ADR-002.
 *
 * @file This file defines the domain types for the Zoom integration,
 *       including OAuth types, webhook event types, API response schemas,
 *       and the adapter interface contract.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

export const ZOOM_PROVIDER_NAME = 'zoom' as const

const ZOOM_OAUTH_SCOPES = [
  'meeting:read',
  'meeting:write',
  'user:read',
] as const

// ---------------------------------------------------------------------------
// Zoom API response schemas
// ---------------------------------------------------------------------------

/**
 * Zoom user resource — the authenticated user's profile.
 * @see https://developers.zoom.us/docs/api/rest/reference/user/methods#operation/getUser
 */
export const zoomUserSchema = z.object({
  id: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.email(),
  type: z.number().int(),
  timezone: z.string().optional(),
  account_id: z.string().optional(),
  pmi: z.string().optional(),
  use_pmi: z.boolean().optional(),
  personal_meeting_url: z.url().optional(),
  verified: z.boolean().optional(),
  dept: z.string().optional(),
  created_at: z.iso.datetime().optional(),
  last_login_time: z.iso.datetime().optional(),
  pic_url: z.url().optional(),
  language: z.string().optional(),
  phone_number: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
})

export type ZoomUser = z.infer<typeof zoomUserSchema>

/**
 * Zoom meeting settings — per-meeting configuration options.
 * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/createMeeting
 */
const zoomMeetingSettingsSchema = z.object({
  host_video: z.boolean().optional(),
  participant_video: z.boolean().optional(),
  cn_meeting: z.boolean().optional(),
  in_meeting: z.boolean().optional(),
  join_before_host: z.boolean().optional(),
  mute_upon_entry: z.boolean().optional(),
  watermark: z.boolean().optional(),
  use_pmi: z.boolean().optional(),
  approval_type: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  registration_type: z.number().int().optional(),
  audio: z.enum(['both', 'telephony', 'voip']).optional(),
  auto_recording: z.enum(['local', 'cloud', 'none']).optional(),
  enforce_login: z.boolean().optional(),
  enforce_login_domains: z.string().optional(),
  alternative_hosts: z.string().optional(),
  close_registration: z.boolean().optional(),
  show_share_button: z.boolean().optional(),
  allow_multiple_devices: z.boolean().optional(),
  waiting_room: z.boolean().optional(),
  request_permission_to_unmute_participants: z.boolean().optional(),
})

/**
 * Zoom meeting — a scheduled or instant meeting.
 * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/meeting
 */
export const zoomMeetingSchema = z.object({
  id: z.number().int(),
  topic: z.string(),
  type: z.number().int(),
  start_time: z.iso.datetime().optional(),
  duration: z.number().int().nonnegative().optional(),
  timezone: z.string().optional(),
  join_url: z.url(),
  start_url: z.url().optional(),
  password: z.string().optional(),
  agenda: z.string().optional(),
  host_id: z.string(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
  settings: zoomMeetingSettingsSchema.optional(),
  recurrence: z
    .object({
      type: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      repeat_interval: z.number().int().positive(),
      weekly_days: z.array(z.number().int()).optional(),
      monthly_day: z.number().int().optional(),
      monthly_week: z.number().int().optional(),
      monthly_week_day: z.number().int().optional(),
      end_times: z.number().int().positive().optional(),
      end_date_time: z.iso.datetime().optional(),
    })
    .optional(),
  tracking_fields: z
    .array(
      z.object({
        field: z.string(),
        value: z.string().optional(),
        visible: z.boolean().optional(),
      }),
    )
    .optional(),
})

export type ZoomMeeting = z.infer<typeof zoomMeetingSchema>

/**
 * Zoom recording file — a single file within a recording.
 * @see https://developers.zoom.us/docs/api/rest/reference/cloud-recording/methods#operation/recordingGet
 */

/**
 * Zoom recording — cloud recording for a meeting.
 * @see https://developers.zoom.us/docs/api/rest/reference/cloud-recording/methods#operation/recordingsList
 */
export const zoomRecordingSchema = z.object({
  id: z.string(),
  meeting_id: z.number().int(),
  topic: z.string(),
  start_time: z.iso.datetime(),
  duration: z.number().int().nonnegative(),
  recording_files: z.array(zoomRecordingFileSchema),
  share_url: z.url().optional(),
  password: z.string().optional(),
  host_id: z.string(),
  account_id: z.string().optional(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
})

export type ZoomRecording = z.infer<typeof zoomRecordingSchema>

// ---------------------------------------------------------------------------
// Webhook event schemas
// ---------------------------------------------------------------------------

/**
 * Zoom webhook payload — the body sent to our webhook endpoint.
 * @see https://developers.zoom.us/docs/api/rest/webhooks/
 */

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const zoomOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.url(),
  scopes: z.array(z.string()).default([...ZOOM_OAUTH_SCOPES]),
  authorizeUrl: z.url().default('https://zoom.us/oauth/authorize'),
  tokenUrl: z.url().default('https://zoom.us/oauth/token'),
})

export type ZoomOAuthConfig = z.infer<typeof zoomOAuthConfigSchema>

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------
