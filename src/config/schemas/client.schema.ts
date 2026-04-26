import { z } from 'zod'

export const clientEnvSchema = z.object({
  // VITE / PUBLIC variables exposed to the browser
  VITE_API_URL: z.string().url().optional(),
  VITE_MONGODB_CLUSTER: z.string().optional(),
  PUBLIC_SENTRY_DSN: z.string().url().optional(),
  PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  PUBLIC_SENTRY_PROFILES_SAMPLE_RATE: z.string().optional(),
  PUBLIC_SENTRY_DEBUG: z.string().optional(),
  PUBLIC_TRAINING_WS_URL: z
    .string()
    .refine(
      (val) => {
        if (!val) return true
        try {
          const url = new URL(val)
          return ['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol)
        } catch {
          return false
        }
      },
      {
        message:
          'PUBLIC_TRAINING_WS_URL must be a valid WebSocket URL (ws:// or wss://) or HTTP URL',
      },
    )
    .optional(),
  PUBLIC_RYBBIT_SCRIPT_URL: z.string().url().optional(),
  PUBLIC_RYBBIT_SITE_ID: z.string().optional(),
})
