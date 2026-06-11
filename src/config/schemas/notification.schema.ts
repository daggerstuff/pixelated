import { z } from 'zod'

export const notificationEnvSchema = z.object({
  // Email
  EMAIL_FROM: z.email().optional(),
  RESEND_API_KEY: z.string().optional(),

  // VAPID
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.url().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Slack
  SLACK_WEBHOOK_URL: z.url().optional(),
})
