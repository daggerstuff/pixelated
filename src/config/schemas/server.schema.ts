import { z } from 'zod'

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.toLowerCase() : value),
      z.enum(['error', 'warn', 'info', 'verbose', 'debug']),
    )
    .default('info'),
  ENABLE_RATE_LIMITING: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),
  ANALYTICS_WS_PORT: z.coerce.number().default(8083),
  NOTIFICATION_WS_PORT: z.coerce.number().default(8082),
  SITE_URL: z.string().url().optional(),
})
