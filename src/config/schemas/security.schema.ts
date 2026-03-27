import { z } from 'zod'

export const securityEnvSchema = z.object({
  // Brute force protection
  SECURITY_ENABLE_BRUTE_FORCE_PROTECTION: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),
  SECURITY_MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  SECURITY_ACCOUNT_LOCKOUT_DURATION: z.coerce.number().default(1800),
  SECURITY_API_ABUSE_THRESHOLD: z.coerce.number().default(100),
  SECURITY_ENABLE_ALERTS: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),

  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),

  // Audit logging
  ENABLE_AUDIT_LOGGING: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().default(2555),
  LOG_CONSOLE: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),
  LOG_AUDIT: z
    .string()
    .transform((val: string) => val === 'true')
    .default(true),

  // Encryption
  ENCRYPTION_ALGORITHM: z.enum(['aes-256-gcm']).default('aes-256-gcm'),
  ENCRYPTION_KEY: z.string().min(32).optional(),
})
