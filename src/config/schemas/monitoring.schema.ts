import { z } from 'zod'

export const monitoringEnvSchema = z.object({
  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  
  // Axiom
  AXIOM_DATASET: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),
  
  // Litlyx
  VITE_LITLYX_PROJECT_ID: z.string().optional(),
  VITE_LITLYX_API_KEY: z.string().optional(),
})
