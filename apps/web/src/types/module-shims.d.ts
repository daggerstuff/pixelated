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
    get: (params: string | { id: string }) => Promise<{
      data: Record<string, unknown> & { identities?: unknown[] }
    }>
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

declare module 'typeorm'
declare module 'better-sqlite3'
declare module '@tailus/themer-button'
declare module '@tailus/themer-card'
declare module '@tailus/themer-progress'
declare module 'twilio'
declare module 'launchdarkly-js-client-sdk'
declare module 'ioredis' {
  type RedisListener = (error: unknown) => void

  interface RedisOptions {
    maxRetriesPerRequest?: number | null
    enableReadyCheck?: boolean
    retryStrategy?: (times: number) => number
    lazyConnect?: boolean
    tls?: {
      [key: string]: unknown
      rejectUnauthorized?: boolean
    }
    [key: string]: unknown
  }

  interface Pipeline {
    incr(key: string): this
    expire(key: string, seconds: number): this
    del(...keys: string[]): this
    exec(): Promise<Array<[unknown, unknown] | null>>
  }

  export default class Redis {
    [key: string]: unknown
    call(
      command: string,
      ...args: Array<string | number | Buffer>
    ): Promise<unknown>
    callBuffer(
      command: string,
      ..._args: Array<string | number | Buffer>
    ): Promise<unknown>
    set(key: string, value: string, ...options: unknown[]): Promise<unknown>
    setex(key: string, seconds: number, value: string): Promise<unknown>
    exists(key: string): Promise<number>
    pttl(key: string): Promise<number>
    ttl(key: string): Promise<number>
    keys(pattern: string): Promise<string[]>
    scan(cursor: string, ...args: unknown[]): Promise<[string, string[]]>
    info(section?: string): Promise<string>
    subscribe(channel: string): Promise<number>
    publish(channel: string, message: string): Promise<number>
    unsubscribe(channel: string): Promise<number>
    lpush(key: string, ...values: string[]): Promise<number>
    rpoplpush(source: string, destination: string): Promise<string | null>
    lrem(key: string, count: number, value: string): Promise<number>
    llen(key: string): Promise<number>
    hset(key: string, field: string, value: string): Promise<number>
    hget(key: string, field: string): Promise<string | null>
    hgetall(key: string): Promise<Record<string, string>>
    hdel(key: string, field: string): Promise<number>
    hlen(key: string): Promise<number>
    zadd(key: string, ...args: Array<string | number>): Promise<number>
    zrem(key: string, member: string): Promise<number>
    zrange(key: string, start: number, stop: number): Promise<string[]>
    zrange(
      key: string,
      start: number,
      stop: number,
      withScores: 'WITHSCORES',
    ): Promise<string[]>
    zpopmin(key: string): Promise<Array<[string, string]>>
    zcard(key: string): Promise<number>
    zrangebyscore(
      key: string,
      min: string | number,
      max: string | number,
      withscores?: string,
      offset?: number,
      count?: number,
    ): Promise<string[]>
    zremrangebyscore(
      key: string,
      min: string | number,
      max: string | number,
    ): Promise<number>
    deletePattern(pattern: string): Promise<number>
    multi(..._commands: unknown[]): this
    pipeline(): {
      del(...keys: string[]): Pipeline
      exec(): Promise<[Error | null, unknown][]>
    }
    constructor(url: string, options?: RedisOptions)
    on(event: string, listener: RedisListener): this
    connect(): Promise<unknown>
    disconnect(): void
    ping(): Promise<string>
    multi(): Pipeline
    setex(key: string, seconds: number, value: string): Promise<unknown>
    get(key: string): Promise<string | null>
    sadd(key: string, ...members: string[]): Promise<number>
    smembers(key: string): Promise<string[]>
    srem(key: string, member: string): Promise<number>
    del(...keys: string[]): Promise<number>
    quit(): Promise<unknown>
  }
}
declare module 'mongoose' {
  export class Connection {
    on(
      event: 'connected' | 'error' | 'disconnected',
      listener: (error: unknown) => void,
    ): this
    model<T>(name: string, _schema?: unknown, _modelType?: T): Model<T>
    startSession(): Promise<Session>
  }

  export class Session {
    startTransaction(): Promise<void>
    commitTransaction(): Promise<void>
    abortTransaction(): Promise<void>
    endSession(): Promise<void>
  }

  export class QueryBuilder<T> {
    limit(limit: number): this
    skip(count: number): this
    sort(sort: { createdAt: -1 | 1 }): Promise<T[]>
  }

  export interface Model<T extends { _id?: string }> {
    new (data: Omit<T, 'save'>): T & { save: () => Promise<T> }
    findById(id: string): Promise<T | null>
    find(query: Record<string, unknown>): QueryBuilder<T>
    countDocuments(query: Record<string, unknown>): Promise<number>
  }

  const mongoose: {
    Connection: typeof Connection
    connect(uri: string, options?: Record<string, unknown>): Promise<void>
    disconnect(): Promise<void>
    connection: Connection
  }

  export default mongoose
}
declare module 'pg' {
  interface QueryResult<T = unknown> {
    rows: T[]
    rowCount: number | null
  }

  class PoolClient {
    query<T = unknown>(
      query: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>
    release(err?: Error | boolean): void
  }

  interface PoolConfig extends Record<string, any> {
    host?: string
    port?: number
    database?: string
    user?: string
    password?: string
    max?: number
    min?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
    ssl?: any
  }

  class Pool {
    constructor(config?: PoolConfig)
    connect(): Promise<PoolClient>
    query<T = unknown>(
      query: string,
      values?: unknown[],
    ): Promise<QueryResult<T>>
    end(): Promise<void>
    on(event: 'error', listener: (error: any, client?: any) => void): this
    on(event: 'connect', listener: (client: PoolClient) => void): this
    on(event: 'remove', listener: (client: PoolClient) => void): this
  }

  export { Pool, PoolClient, PoolConfig }
}
declare module 'ioredis-mock'
declare module 'eslint-plugin-node'
declare module 'supertest' {
  export interface SuperTestResponse<Body = Record<string, unknown>> {
    status: number
    statusCode: number
    body: Body
    headers: Record<string, string | string[] | undefined>
    header: Record<string, string | string[] | undefined>
  }

  export interface SuperTestChain<
    Body = Record<string, unknown>,
  > extends PromiseLike<SuperTestResponse<Body>> {
    set(field: string, value: string): this
    send(data: unknown): this
    query(params: Record<string, unknown>): this
    expect(status: number): this
    expect(field: string, value: unknown, fn?: unknown): this
    then<TResult1 = SuperTestResponse<Body>, TResult2 = never>(
      onfulfilled?: (
        value: SuperTestResponse<Body>,
      ) => TResult1 | PromiseLike<TResult1>,
      onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
    ): PromiseLike<TResult1 | TResult2>
  }

  export interface SuperTestAgent {
    get<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
    post<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
    put<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
    patch<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
    delete<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
    head<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
    options<Body = Record<string, unknown>>(url: string): SuperTestChain<Body>
  }

  const request: {
    (app: unknown): SuperTestAgent
    agent(app: unknown): SuperTestAgent
  }

  export default request
}
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

declare module '@/lib/db/redis'
declare module '@/lib/db/postgres'
declare module '@/lib/db/mongodb'

declare module '../../node_modules/react/index.js'
declare module '../../simulator/types'
declare module '../../lib/ai/mental-llama/MentalLLaMAAdapter'
declare module '../../config/mongodb.config'
declare module '../../config/azure.config'
declare module '../config/azure.config'
declare module '@/config/azure.config'
