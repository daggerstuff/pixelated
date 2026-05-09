declare module 'astro-icon/components'
declare module 'auth0' {
  export interface Auth0ClientOptions {
    domain: string
    clientId?: string
    clientSecret?: string
    client_id?: string
    client_secret?: string
    audience?: string
  }

  export interface AuthenticationClientOptions extends Auth0ClientOptions {
    clientSecret: string
  }

  export interface Auth0TokenData {
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in: number
    token_type: string
  }

  export interface ManagementUserClient {
    create: (params: Record<string, unknown>) => Promise<{ data: unknown }>
    get: (
      params: string | { id: string },
    ) => Promise<{ data: Record<string, unknown> & { identities?: unknown[] } }>
    list: (params: { [key: string]: unknown }) => Promise<{ data: unknown[] }>
    listUsersByEmail: (params: {
      email: string
    }) => Promise<{ data: unknown[] }>
    update: (
      userId: string,
      data: Record<string, unknown>,
    ) => Promise<{ data: unknown }>
    delete: (params: { id: string }) => Promise<void>
    getLogs: (params: { per_page: number; q: string }) => Promise<unknown[]>
    link: (
      params: { id: string },
      identity: {
        provider: string
        connection_id?: string
        user_id: string
      },
    ) => Promise<unknown>
    unlink: (
      userId: string,
      identity: {
        provider: string
        user_id: string
      },
    ) => Promise<unknown>
    getGuardianEnrollments: (params: { id: string }) => Promise<unknown>
  }

  export interface ManagementTicketsClient {
    changePassword: (params: {
      user_id: string
      result_url?: string
      ttl_sec?: number
      mark_email_as_verified?: boolean
      includeEmailInRedirect?: boolean
    }) => Promise<{ data: unknown }>
  }

  export interface ManagementRolesClient {
    list: (params: {
      per_page?: number
      page?: number
      name_filter?: string
    }) => Promise<{ data: unknown[] }>
    create: (params: { name: string; description?: string }) => Promise<unknown>
    assignRolestoUser: (params: {
      id: string
      roles: string[]
    }) => Promise<unknown>
    removeRolesFromUser: (params: {
      id: string
      roles: string[]
    }) => Promise<unknown>
    getUserRoles: (params: { id: string }) => Promise<unknown[]>
  }

  export class ManagementClient {
    constructor(options: Auth0ClientOptions)

    users: ManagementUserClient
    roles: ManagementRolesClient
    tickets: ManagementTicketsClient

    getRoles: (params: {
      per_page?: number
      page?: number
      name_filter?: string
    }) => Promise<unknown[]>
    createRole: (params: {
      name: string
      description?: string
    }) => Promise<unknown>
    updateRole: (params: {
      id: string
      name?: string
      description?: string
    }) => Promise<unknown>
    deleteRole: (params: { id: string }) => Promise<void>
    getRoleUsers: (params: { id: string }) => Promise<unknown>
    assignRolestoUser: (params: {
      id: string
      roles: string[]
    }) => Promise<void>
    removeRolesFromUser: (params: {
      id: string
      roles: string[]
    }) => Promise<void>
    getUserRoles: (params: { id: string }) => Promise<unknown[]>
    getGuardianFactors: () => Promise<unknown>
    createGuardianEnrollmentTicket: (params: {
      user_id: string
      send_mail: boolean
    }) => Promise<unknown>
    deleteGuardianEnrollment: (params: { id: string }) => Promise<void>
    getLogs: (params: { per_page: number; q: string }) => Promise<unknown[]>
  }

  export interface OAuthClient {
    authorizationCodeGrant: (params: {
      code: string
      redirect_uri: string
    }) => Promise<{ data: Auth0TokenData }>
    refreshTokenGrant: (params: {
      refresh_token: string
    }) => Promise<{ data: Auth0TokenData }>
    passwordGrant: (params: {
      username: string
      password: string
      realm: string
      scope: string
      audience: string
    }) => Promise<{ data: Auth0TokenData }>
    revokeRefreshToken: (params: { token: string }) => Promise<void>
    refreshToken: (params: {
      [key: string]: unknown
    }) => Promise<{ data: Auth0TokenData }>
  }

  export class AuthenticationClient {
    constructor(options: AuthenticationClientOptions)

    oauth: OAuthClient
    getProfile?: (
      accessToken: string,
    ) => Promise<{ data: Record<string, unknown> }>
    refreshToken?: (params: {
      [key: string]: unknown
    }) => Promise<{ data: Auth0TokenData }>
    passwordGrant?: (params: {
      username: string
      password: string
      realm: string
      scope: string
      audience: string
    }) => Promise<{ data: Auth0TokenData }>
    refreshTokenGrant?: (params: {
      refresh_token: string
    }) => Promise<{ data: Auth0TokenData }>
    revokeRefreshToken?: (params: { token: string }) => Promise<void>
  }

  export interface UserInfoResponse {
    data: {
      sub?: string
      email?: string
      name?: string
      given_name?: string
      family_name?: string
      picture?: string
      email_verified?: boolean
    }
  }

  export class UserInfoClient {
    constructor(options: { domain: string })

    getProfile: (accessToken: string) => Promise<UserInfoResponse>
    getUserInfo: (accessToken: string) => Promise<UserInfoResponse>
  }
}

declare module 'supertest'
declare module 'typeorm'
declare module 'better-sqlite3'
declare module '@tailus/themer-button'
declare module '@tailus/themer-card'
declare module '@tailus/themer-progress'
declare module '@supermemory/tools/ai-sdk'
declare module 'twilio'
declare module 'launchdarkly-js-client-sdk'
declare module 'ioredis-mock'
declare module 'eslint-plugin-node'
declare module 'eslint-plugin-jsx-a11y'
declare module 'crypto-js/hmac-sha256'
declare module 'crypto-js/enc-base64'
declare module 'archiver'
declare module '@opentelemetry/auto-instrumentations-node'
declare module '@google-cloud/storage'
declare module '@google-cloud/compute'
declare module '@/*'

declare module '../audit-logging'
declare module '../encryption'
declare module '../index'
declare module '../health'
declare module '../developer-api-keys'
declare module '../components/ui/progress-bar'
declare module '../components/demo/ScenarioGenerationDemo'
declare module '../app'
declare module '../analytics/engagement/types'
declare module '../skills'
declare module '../progress'
declare module '../integration/ExternalThreatFeedIntegration'

declare module './types'
declare module './Todo'
declare module './operations'
declare module './objectives'
declare module './key-manager'
declare module './indexedDBRequestQueue'
declare module './encryption'
declare module './OllamaCheckInService'
declare module './NotificationProvider'
declare module './AnalyticsProvider'

declare module '@/lib/database/redis'
declare module '@/lib/database/postgres'
declare module '@/lib/database/mongodb'

declare module '../../node_modules/react/index.js'
declare module '../../simulator/types'
declare module '../../lib/ai/mental-llama/MentalLLaMAAdapter'
declare module '../../config/mongodb.config'
declare module '../../config/azure.config'
