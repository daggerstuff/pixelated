/**
 * Auth0 service utilities — client initialization and shared types.
 * Extracted from auth0.service.ts.
 */

import { ManagementClient, AuthenticationClient, UserInfoClient } from 'auth0'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

export type ManagementClientOptionsWithClientCredentials = {
  domain: string
  clientId: string
  clientSecret: string
  audience?: string
}

// Extend AuthenticationClient to include methods that may not be in the TypeScript definitions
type ExtendedAuthenticationClient = AuthenticationClient & {
  oauth: AuthenticationClient['oauth'] & {
    passwordGrant: (params: {
      username: string
      password: string
      realm: string
      scope: string
      audience: string
    }) => Promise<{
      data: {
        access_token: string
        refresh_token?: string
        expires_in: number
      }
    }>
    refreshTokenGrant: (params: { refresh_token: string }) => Promise<{
      data: {
        access_token: string
        refresh_token?: string
        expires_in: number
      }
    }>
    revokeRefreshToken: (params: { token: string }) => Promise<void>
  }
}

function isExtendedAuthenticationClient(
  client: AuthenticationClient,
): client is ExtendedAuthenticationClient {
  if (typeof client.oauth !== 'object') {
    return false
  }

  const oauthMethods: Array<keyof ExtendedAuthenticationClient['oauth']> = [
    'passwordGrant',
    'refreshTokenGrant',
    'revokeRefreshToken',
  ]

  return oauthMethods.every(
    (method) => typeof Reflect.get(client.oauth, method) === 'function',
  )
}

// Extend UserInfoClient
type ExtendedUserInfoClient = Omit<UserInfoClient, 'getUserInfo'> & {
  getUserInfo: (token: string) => Promise<{ data: unknown }>
}
const shouldWarnAuth0Configuration = process.env['NODE_ENV'] !== 'test'

function toStringEnvValue(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

interface Auth0ServiceConfig {
  domain?: string
  clientId?: string
  clientSecret?: string
  audience?: string
  managementClientId?: string
  managementClientSecret?: string
}

export type Auth0UserRecord = {
  'sub'?: unknown
  'user_id'?: unknown
  'email'?: unknown
  'email_verified'?: unknown
  'name'?: unknown
  'picture'?: unknown
  'created_at'?: unknown
  'last_login'?: unknown
  'app_metadata'?: unknown
  'user_metadata'?: unknown
  'https://pixelated-empathy.com/app_metadata'?: unknown
  'https://pixelated-empathy.com/user_metadata'?: unknown
}

export type AuthenticatedUser = {
  id: string
  email: string
  emailVerified?: boolean
  role: string
  name?: string
  fullName?: string
  firstName?: string
  lastName?: string
  isActive?: boolean
  medicalRecordNumber?: string
  avatarUrl?: string
  createdAt?: string
  updatedAt?: string
  lastLogin?: string
  appMetadata?: Record<string, unknown>
  userMetadata?: Record<string, unknown>
  [key: string]: unknown
}

export type Auth0PasswordGrantResponse = {
  access_token: string
  refresh_token?: string
  expires_in: unknown
  id_token?: string
}

// Initialize Auth0 clients
let auth0Management: ManagementClient | null = null
let auth0Authentication: ExtendedAuthenticationClient | null = null
let auth0UserInfo: ExtendedUserInfoClient | null = null

/**
 * Initialize Auth0 clients
 */
export function initializeAuth0Clients() {
  const config: Auth0ServiceConfig = {
    domain:
      toStringEnvValue(process.env['AUTH0_DOMAIN']) ??
      toStringEnvValue(import.meta.env['AUTH0_DOMAIN']),
    clientId:
      toStringEnvValue(process.env['AUTH0_CLIENT_ID']) ??
      toStringEnvValue(import.meta.env['AUTH0_CLIENT_ID']),
    clientSecret:
      toStringEnvValue(process.env['AUTH0_CLIENT_SECRET']) ??
      toStringEnvValue(import.meta.env['AUTH0_CLIENT_SECRET']),
    audience:
      toStringEnvValue(process.env['AUTH0_AUDIENCE']) ??
      toStringEnvValue(import.meta.env['AUTH0_AUDIENCE']),
    managementClientId:
      toStringEnvValue(process.env['AUTH0_MANAGEMENT_CLIENT_ID']) ??
      toStringEnvValue(import.meta.env['AUTH0_MANAGEMENT_CLIENT_ID']),
    managementClientSecret:
      toStringEnvValue(process.env['AUTH0_MANAGEMENT_CLIENT_SECRET']) ??
      toStringEnvValue(import.meta.env['AUTH0_MANAGEMENT_CLIENT_SECRET']),
  }

  // Initialize Management Client if config is available
  if (
    config.domain &&
    config.managementClientId &&
    config.managementClientSecret
  ) {
    auth0Management ??= new ManagementClient({
      domain: config.domain,
      clientId: config.managementClientId,
      clientSecret: config.managementClientSecret,
    })
  } else {
    if (shouldWarnAuth0Configuration) {
      authLogger.warn(
        'Auth0 Management configuration is incomplete. User management features may not work.',
      )
    }
  }

  // Initialize Authentication Client if config is available
  if (config.domain && config.clientId && config.clientSecret) {
    const authenticationClient = new AuthenticationClient({
      domain: config.domain,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    })
    if (!isExtendedAuthenticationClient(authenticationClient)) {
      throw new Error(
        'Auth0 authentication client is missing required OAuth methods',
      )
    }
    auth0Authentication = authenticationClient
    auth0UserInfo ??= new UserInfoClient({
      domain: config.domain,
    }) as ExtendedUserInfoClient
  } else {
    if (shouldWarnAuth0Configuration) {
      authLogger.warn(
        'Auth0 Authentication configuration is incomplete. Login features will not work.',
      )
    }
  }

  return config
}

export const authLogger = createBuildSafeLogger('auth0-service')
