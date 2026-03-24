import { z } from 'zod'

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default(3000),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'verbose', 'debug'])
    .default('info'),
  ENABLE_RATE_LIMITING: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),
  ANALYTICS_WS_PORT: z.string().transform(Number).default(8083),
  NOTIFICATION_WS_PORT: z.string().transform(Number).default(8082),
  SITE_URL: z.string().url().optional(),
})
