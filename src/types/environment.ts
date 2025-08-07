/**
 * Enhanced Environment Variable Types with Strict Runtime Validation
 *
 * This file provides comprehensive typing and validation for environment variables
 * to ensure type safety throughout the application.
 */

import type { Brand } from './utility'

// ============================================================================
// ENVIRONMENT BRANDED TYPES
// ============================================================================

/** Branded types for environment-specific values */
export type DatabaseUrl = Brand<string, 'DatabaseUrl'>
export type ApiKey = Brand<string, 'ApiKey'>
export type Url = Brand<string, 'Url'>
export type Port = Brand<number, 'Port'>

// ============================================================================
// NODE ENVIRONMENT TYPES
// ============================================================================

/** Strict Node.js environment types */
export type NodeEnvironment = 'development' | 'production' | 'test' | 'staging'

/** Environment validation function */
export const isNodeEnvironment = (value: string): value is NodeEnvironment => {
  return ['development', 'production', 'test', 'staging'].includes(value)
}

// ============================================================================
// ENVIRONMENT VARIABLE INTERFACES
// ============================================================================

/** Core environment variables that must be present */
export interface CoreEnvironmentVariables {
  readonly NODE_ENV: NodeEnvironment
  readonly PUBLIC_SITE_URL: Url
  readonly PORT?: Port | undefined
}

/** Database-related environment variables */
export interface DatabaseEnvironmentVariables {
  readonly DATABASE_URL?: DatabaseUrl | undefined
  readonly SUPABASE_URL?: Url | undefined
  readonly SUPABASE_ANON_KEY?: ApiKey | undefined
  readonly SUPABASE_SERVICE_ROLE_KEY?: ApiKey | undefined
}

/** Authentication environment variables */
export interface AuthEnvironmentVariables {
  readonly AUTH_SECRET?: ApiKey | undefined
  readonly GITHUB_CLIENT_ID?: string | undefined
  readonly GITHUB_CLIENT_SECRET?: ApiKey | undefined
  readonly GOOGLE_CLIENT_ID?: string | undefined
  readonly GOOGLE_CLIENT_SECRET?: ApiKey | undefined
}

/** AI/ML service environment variables */
export interface AIEnvironmentVariables {
  readonly OPENAI_API_KEY?: ApiKey | undefined
  readonly ANTHROPIC_API_KEY?: ApiKey | undefined
  readonly GOOGLE_AI_API_KEY?: ApiKey | undefined
  readonly HUGGING_FACE_API_KEY?: ApiKey | undefined
}

/** Analytics and monitoring environment variables */
export interface AnalyticsEnvironmentVariables {
  readonly GOOGLE_ANALYTICS_ID?: string | undefined
  readonly SENTRY_DSN?: Url | undefined
  readonly POSTHOG_API_KEY?: ApiKey | undefined
}

/** Development and build environment variables */
export interface BuildEnvironmentVariables {
  readonly CI?: string | undefined
  readonly GITHUB_ACTIONS?: string | undefined
}

/** Combined environment variables interface */
export interface EnvironmentVariables
  extends CoreEnvironmentVariables,
    DatabaseEnvironmentVariables,
    AuthEnvironmentVariables,
    AIEnvironmentVariables,
    AnalyticsEnvironmentVariables,
    BuildEnvironmentVariables {}

// ============================================================================
// RUNTIME VALIDATION
// ============================================================================

/** Environment variable validation errors */
export class EnvironmentValidationError extends Error {
  constructor(
    public readonly missingVariables: string[],
    public readonly invalidVariables: Array<{
      name: string
      value: unknown
      expected: string
    }>,
  ) {
    const missingMsg =
      missingVariables.length > 0
        ? `Missing required environment variables: ${missingVariables.join(', ')}`
        : ''

    const invalidMsg =
      invalidVariables.length > 0
        ? `Invalid environment variables: ${invalidVariables.map((v) => `${v.name} (expected ${v.expected}, got ${typeof v.value})`).join(', ')}`
        : ''

    const message = [missingMsg, invalidMsg].filter(Boolean).join('. ')

    super(`Environment validation failed: ${message}`)
    this.name = 'EnvironmentValidationError'
  }
}

/** Validation result type */
export type ValidationResult<T> = {
  success: boolean
  data?: T
  errors: string[]
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export const validatePort = (value: string): value is `${Port}` => {
  const port = parseInt(value, 10)
  return !isNaN(port) && port > 0 && port <= 65535
}
/** Validates database URL */
export const validateDatabaseUrl = (value: string): value is DatabaseUrl => {
  return (
    value.startsWith('mongodb://') ||
    value.startsWith('mongodb+srv://') ||
    value.startsWith('mysql://')
  )
}

// ============================================================================
// ENVIRONMENT LOADING AND VALIDATION
// ============================================================================
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Get a required environment variable with runtime validation */
export function requireEnvironmentVariable<
  K extends keyof EnvironmentVariables,
>(
  name: K,
  validator?: (value: string) => boolean,
): NonNullable<EnvironmentVariables[K]> {
  const value = process.env[name as string]

  if (!value) {
    throw new EnvironmentValidationError([name as string], [])
  }

  if (validator && !validator(value)) {
    throw new EnvironmentValidationError(
      [],
      [
        {
          name: name as string,
          value,
          expected: 'valid format',
        },
      ],
    )
  }

  return value as NonNullable<EnvironmentVariables[K]>
}

/** Get an optional environment variable with type safety */
export function getEnvironmentVariable<K extends keyof EnvironmentVariables>(
  name: K,
  defaultValue?: EnvironmentVariables[K],
): EnvironmentVariables[K] {
  const value = process.env[name as string]
  return (value ?? defaultValue) as EnvironmentVariables[K]
}

/** Check if we're in a specific environment */
export const isDevelopment = (): boolean =>
  process.env['NODE_ENV'] === 'development'
export const isProduction = (): boolean =>
  process.env['NODE_ENV'] === 'production'
export const isTest = (): boolean => process.env['NODE_ENV'] === 'test'
export const isStaging = (): boolean => process.env['NODE_ENV'] === 'staging'

/** Check if we're running in CI */
export const isCI = (): boolean =>
  Boolean(process.env['CI'] || process.env['GITHUB_ACTIONS'])
/**
 * Validates that a string is a well-formed URL (http, https, ws, wss, etc).
 * Returns true if valid, false otherwise.
 */
function validateUrl(value: string): value is Url {
  try {
    // Only allow http(s) and ws(s) protocols for safety
    const url = new URL(value)
    return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)
  } catch {
    return false
  }
}
