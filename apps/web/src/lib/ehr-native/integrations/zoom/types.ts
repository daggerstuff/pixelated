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

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

export const ZOOM_PROVIDER_NAME = 'zoom' as const;

export const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2' as const;

export const ZOOM_OAUTH_SCOPES = [
  'meeting:read',
  'meeting:write',
  'user:read',
] as const;

export const ZOOM_WEBHOOK_EVENTS = [
  'meeting.created',
  'meeting.updated',
  'meeting.deleted',
  'meeting.started',
  'meeting.ended',
  'recording.completed',
] as const;

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
  email: z.string().email(),
  type: z.number().int(),
  timezone: z.string().optional(),
  account_id: z.string().optional(),
  pmi: z.string().optional(),
  use_pmi: z.boolean().optional(),
  personal_meeting_url: z.string().url().optional(),
  verified: z.boolean().optional(),
  dept: z.string().optional(),
  created_at: z.string().datetime().optional(),
  last_login_time: z.string().datetime().optional(),
  pic_url: z.string().url().optional(),
  language: z.string().optional(),
  phone_number: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
});

export type ZoomUser = z.infer<typeof zoomUserSchema>;

/**
 * Zoom meeting settings — per-meeting configuration options.
 * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/createMeeting
 */
export const zoomMeetingSettingsSchema = z.object({
  host_video: z.boolean().optional(),
  participant_video: z.boolean().optional(),
  cn_meeting: z.boolean().optional(),
  in_meeting: z.boolean().optional(),
  join_before_host: z.boolean().optional(),
  mute_upon_entry: z.boolean().optional(),
  watermark: z.boolean().optional(),
  use_pmi: z.boolean().optional(),
  approval_type: z.enum([0, 1, 2]).optional(),
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
});

export type ZoomMeetingSettings = z.infer<typeof zoomMeetingSettingsSchema>;

/**
 * Zoom meeting — a scheduled or instant meeting.
 * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/meeting
 */
export const zoomMeetingSchema = z.object({
  id: z.number().int(),
  topic: z.string(),
  type: z.number().int(),
  start_time: z.string().datetime().optional(),
  duration: z.number().int().nonnegative().optional(),
  timezone: z.string().optional(),
  join_url: z.string().url(),
  start_url: z.string().url().optional(),
  password: z.string().optional(),
  agenda: z.string().optional(),
  host_id: z.string(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  settings: zoomMeetingSettingsSchema.optional(),
  recurrence: z
    .object({
      type: z.enum([1, 2, 3]),
      repeat_interval: z.number().int().positive(),
      weekly_days: z.array(z.number().int()).optional(),
      monthly_day: z.number().int().optional(),
      monthly_week: z.number().int().optional(),
      monthly_week_day: z.number().int().optional(),
      end_times: z.number().int().positive().optional(),
      end_date_time: z.string().datetime().optional(),
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
});

export type ZoomMeeting = z.infer<typeof zoomMeetingSchema>;

/**
 * Zoom recording file — a single file within a recording.
 * @see https://developers.zoom.us/docs/api/rest/reference/cloud-recording/methods#operation/recordingGet
 */
export const zoomRecordingFileSchema = z.object({
  id: z.string().optional(),
  meeting_id: z.number().int().optional(),
  recording_start: z.string().datetime().optional(),
  recording_end: z.string().datetime().optional(),
  file_type: z.enum(['MP4', 'M4A', 'CHAT', 'TRANSCRIPT', 'CC']),
  file_size: z.number().int().nonnegative().optional(),
  play_url: z.string().url().optional(),
  download_url: z.string().url().optional(),
  status: z.enum(['completed', 'processing', 'failed']).optional(),
  recording_type: z
    .enum([
      'shared_screen_with_speaker_view',
      'shared_screen_with_gallery_view',
      'speaker_view',
      'gallery_view',
      'shared_screen',
      'audio_only',
      'audio_transcript',
      'chat_file',
      'closed_caption',
      'timeline',
    ])
    .optional(),
});

export type ZoomRecordingFile = z.infer<typeof zoomRecordingFileSchema>;

/**
 * Zoom recording — cloud recording for a meeting.
 * @see https://developers.zoom.us/docs/api/rest/reference/cloud-recording/methods#operation/recordingsList
 */
export const zoomRecordingSchema = z.object({
  id: z.string(),
  meeting_id: z.number().int(),
  topic: z.string(),
  start_time: z.string().datetime(),
  duration: z.number().int().nonnegative(),
  recording_files: z.array(zoomRecordingFileSchema),
  share_url: z.string().url().optional(),
  password: z.string().optional(),
  host_id: z.string(),
  account_id: z.string().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type ZoomRecording = z.infer<typeof zoomRecordingSchema>;

// ---------------------------------------------------------------------------
// Webhook event schemas
// ---------------------------------------------------------------------------

/**
 * Zoom webhook payload — the body sent to our webhook endpoint.
 * @see https://developers.zoom.us/docs/api/rest/webhooks/
 */
export const zoomWebhookPayloadSchema = z.object({
  event: z.string(),
  event_ts: z.number().int().optional(),
  payload: z.object({
    account_id: z.string().optional(),
    object: z
      .object({
        id: z.number().int().optional(),
        uuid: z.string().optional(),
        topic: z.string().optional(),
        type: z.number().int().optional(),
        start_time: z.string().datetime().optional(),
        duration: z.number().int().optional(),
        timezone: z.string().optional(),
        host_id: z.string().optional(),
        join_url: z.string().url().optional(),
        password: z.string().optional(),
        recording_files: z.array(zoomRecordingFileSchema).optional(),
      })
      .optional(),
  }),
});

export type ZoomWebhookPayload = z.infer<typeof zoomWebhookPayloadSchema>;

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const zoomOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([...ZOOM_OAUTH_SCOPES]),
  authorizeUrl: z.string().url().default('https://zoom.us/oauth/authorize'),
  tokenUrl: z.string().url().default('https://zoom.us/oauth/token'),
});

export type ZoomOAuthConfig = z.infer<typeof zoomOAuthConfigSchema>;

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

export const zoomWebhookSignatureConfigSchema = z.object({
  provider: z.literal(ZOOM_PROVIDER_NAME),
  headerName: z.string().default('x-zm-signature'),
  secret: z.string().min(1),
  format: z.literal('hmac').default('hmac'),
  algorithm: z.literal('sha256').default('sha256'),
});

export type ZoomWebhookSignatureConfig = z.infer<
  typeof zoomWebhookSignatureConfigSchema
>;

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------

export const zoomWebhookEventTypeSchema = z.enum([
  'meeting.created',
  'meeting.updated',
  'meeting.deleted',
  'meeting.started',
  'meeting.ended',
  'recording.completed',
]);

export type ZoomWebhookEventType = z.infer<typeof zoomWebhookEventTypeSchema>;
