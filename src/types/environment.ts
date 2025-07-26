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

/** Validates API key format (basic check) */
export const validateApiKey = (value: string): value is ApiKey => {
  return value.length > 10 && /^[a-zA-Z0-9_-]+$/.test(value)
}

/** Validates database URL */
export const validateDatabaseUrl = (value: string): value is DatabaseUrl => {
  return (
    value.startsWith('postgresql://') ||
    value.startsWith('postgres://') ||
    value.startsWith('mysql://')
  )
}

// ============================================================================
// ENVIRONMENT LOADING AND VALIDATION
// ============================================================================

/** Load and validate environment variables */
export function loadEnvironmentVariables(): ValidationResult<EnvironmentVariables> {
  const { env } = process
  const missingRequired: string[] = []
  const invalidValues: Array<{
    name: string
    value: unknown
    expected: string
  }> = []

  // Validate NODE_ENV (required)
  if (!env['NODE_ENV']) {
    missingRequired.push('NODE_ENV')
  } else if (!isNodeEnvironment(env['NODE_ENV'])) {
    invalidValues.push({
      name: 'NODE_ENV',
      value: env['NODE_ENV'],
      expected: 'development | production | test | staging',
    })
  }

  // Validate PUBLIC_SITE_URL (required)
  if (!env['PUBLIC_SITE_URL']) {
    missingRequired.push('PUBLIC_SITE_URL')
  } else if (!validateUrl(env['PUBLIC_SITE_URL'])) {
    invalidValues.push({
      name: 'PUBLIC_SITE_URL',
      value: env['PUBLIC_SITE_URL'],
      expected: 'valid URL',
    })
  }

  // Validate optional URLs
  const urlFields = ['SUPABASE_URL', 'SENTRY_DSN'] as const
  for (const field of urlFields) {
    const value = env[field]
    if (value && !validateUrl(value)) {
      invalidValues.push({
        name: field,
        value,
        expected: 'valid URL',
      })
    }
  }

  // Validate PORT if provided
  if (env['PORT'] && !validatePort(env['PORT'])) {
    invalidValues.push({
      name: 'PORT',
      value: env['PORT'],
      expected: 'valid port number (1-65535)',
    })
  }

  // Validate database URLs if provided
  const dbUrlFields = ['DATABASE_URL'] as const
  for (const field of dbUrlFields) {
    const value = env[field]
    if (value && !validateDatabaseUrl(value)) {
      invalidValues.push({
        name: field,
        value,
        expected: 'valid database URL',
      })
    }
  }

  // If there are validation errors, return them
  if (missingRequired.length > 0 || invalidValues.length > 0) {
    return {
      success: false,
      errors: [
        ...missingRequired.map(
          (name) => `Missing required environment variable: ${name}`,
        ),
        ...invalidValues.map(
          ({ name, value, expected }) =>
            `Invalid environment variable ${name}: expected ${expected}, got ${typeof value === 'string' ? `"${value}"` : value}`,
        ),
      ],
    }
  }

  // Build the validated environment object
  const validatedEnv: EnvironmentVariables = {
    // Required fields (already validated)
    NODE_ENV: env['NODE_ENV'] as NodeEnvironment,
    PUBLIC_SITE_URL: env['PUBLIC_SITE_URL'] as Url,

    // Optional fields with type casting
    PORT: env['PORT'] ? (parseInt(env['PORT'], 10) as Port) : undefined,
    DATABASE_URL: env['DATABASE_URL'] as DatabaseUrl | undefined,
    SUPABASE_URL: env['SUPABASE_URL'] as Url | undefined,
    SUPABASE_ANON_KEY: env['SUPABASE_ANON_KEY'] as ApiKey | undefined,
    SUPABASE_SERVICE_ROLE_KEY: env['SUPABASE_SERVICE_ROLE_KEY'] as
      | ApiKey
      | undefined,

    // Auth variables
    AUTH_SECRET: env['AUTH_SECRET'] as ApiKey | undefined,
    GITHUB_CLIENT_ID: env['GITHUB_CLIENT_ID'],
    GITHUB_CLIENT_SECRET: env['GITHUB_CLIENT_SECRET'] as ApiKey | undefined,
    GOOGLE_CLIENT_ID: env['GOOGLE_CLIENT_ID'],
    GOOGLE_CLIENT_SECRET: env['GOOGLE_CLIENT_SECRET'] as ApiKey | undefined,

    // AI service variables
    OPENAI_API_KEY: env['OPENAI_API_KEY'] as ApiKey | undefined,
    ANTHROPIC_API_KEY: env['ANTHROPIC_API_KEY'] as ApiKey | undefined,
    GOOGLE_AI_API_KEY: env['GOOGLE_AI_API_KEY'] as ApiKey | undefined,
    HUGGING_FACE_API_KEY: env['HUGGING_FACE_API_KEY'] as ApiKey | undefined,

    // Analytics variables
    GOOGLE_ANALYTICS_ID: env['GOOGLE_ANALYTICS_ID'],
    SENTRY_DSN: env['SENTRY_DSN'] as Url | undefined,
    POSTHOG_API_KEY: env['POSTHOG_API_KEY'] as ApiKey | undefined,

    // Build variables
    CI: env['CI'],
    GITHUB_ACTIONS: env['GITHUB_ACTIONS'],
  }

  return {
    success: true,
    data: validatedEnv,
    errors: [],
  }
}

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
