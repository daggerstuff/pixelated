// Type declarations for packages without TypeScript definitions

// k6 testing framework
declare module 'k6' {
  export function check(
    data: unknown,
    checks: Record<string, (data: unknown) => boolean>,
  ): boolean
  export function sleep(seconds: number): void
  export { check, sleep }
}

declare module 'k6/http' {
  export class http {
    static get(url: string, headers?: Record<string, string>): Response
    static post(
      url: string,
      body?: string,
      headers?: Record<string, string>,
    ): Response
    static put(
      url: string,
      body?: string,
      headers?: Record<string, string>,
    ): Response
    static del(url: string, headers?: Record<string, string>): Response
  }
  export interface Response {
    status: number
    body: string
    json<T>(): T
  }
  export default http
}

declare module 'k6/data' {
  export function randomString(length: number): string
}

declare module 'k6/metrics' {
  export class Counter {
    constructor(name: string)
    add(value: number): void
  }
  export class Rate {
    constructor(name: string)
    add(value: number): void
  }
  export class Trend {
    constructor(name: string)
    add(value: number): void
  }
  export class Gauge {
    constructor(name: string)
    set(value: number): void
  }
}

// PDF generation
declare module 'pdfkit' {
  class PDFDocument {
    constructor(options?: unknown)
    font(name: string): this
    fontSize(size: number): this
    text(content: string, options?: unknown): this
    moveDown(lines?: number): this
    image(
      source: string | Buffer,
      x: number,
      y: number,
      options?: unknown,
    ): this
    rect(x: number, y: number, width: number, height: number): this
    fill(color: string): this
    stroke(): this
    fillAndFill(color: string): this
    end(): void
    pipe(dest: unknown): void
  }
  export default PDFDocument
}

// AWS SDK v2
declare module 'aws-sdk' {
  export class S3 {
    constructor(config?: unknown)
    getSignedUrlPromise(operation: string, params: unknown): Promise<string>
    upload(params: unknown): Promise<unknown>
    getObject(params: unknown): Promise<unknown>
    putObject(params: unknown): Promise<unknown>
    deleteObject(params: unknown): Promise<unknown>
    listObjectsV2(params: unknown): Promise<unknown>
  }
  export class DynamoDB {
    constructor(config?: unknown)
    getItem(params: unknown): Promise<unknown>
    putItem(params: unknown): Promise<unknown>
    deleteItem(params: unknown): Promise<unknown>
    query(params: unknown): Promise<unknown>
    scan(params: unknown): Promise<unknown>
  }
  export class SNS {
    constructor(config?: unknown)
    publish(params: unknown): Promise<unknown>
  }
  export class SQS {
    constructor(config?: unknown)
    sendMessage(params: unknown): Promise<unknown>
    receiveMessage(params: unknown): Promise<unknown>
  }
  export class Lambda {
    constructor(config?: unknown)
    invoke(params: unknown): Promise<unknown>
  }
  export class CloudWatchLogs {
    constructor(config?: unknown)
    putLogEvents(params: unknown): Promise<unknown>
  }
  export class SecretsManager {
    constructor(config?: unknown)
    getSecretValue(params: unknown): Promise<unknown>
  }
  export namespace config {
    export function update(config: unknown): void
  }
}

// @supabase/supabase-js
declare module '@supabase/supabase-js' {
  export function createClient(
    url: string,
    key: string,
    options?: unknown,
  ): {
    from(table: string): {
      select(): {
        eq(
          key: string,
          value: unknown,
        ): Promise<{ data: unknown[]; error: unknown }>
      }
      insert(data: unknown): Promise<{ data: unknown; error: unknown }>
      update(data: unknown): {
        eq(
          key: string,
          value: unknown,
        ): Promise<{ data: unknown; error: unknown }>
      }
      delete(): {
        eq(
          key: string,
          value: unknown,
        ): Promise<{ data: unknown; error: unknown }>
      }
    }
  }
}

// OpenAI
declare module 'openai' {
  export interface OpenAI {
    chat: {
      completions: {
        create(params: unknown): Promise<unknown>
      }
    }
  }
  export class OpenAIClass {
    constructor(config: unknown)
  }
  export default OpenAIClass
}

// Consul
declare module 'consul' {
  export interface Consul {
    agent: {
      service: {
        register: (params: unknown) => Promise<void>
        deregister: (params: unknown) => Promise<void>
      }
      check: {
        register: (params: unknown) => Promise<void>
        deregister: (params: unknown) => Promise<void>
      }
    }
    health: {
      service: (params: unknown) => Promise<unknown>
    }
  }
  export default function (opts?: unknown): Consul
}

// etcd3
declare module 'etcd3' {
  export class Etcd3 {
    get(key: string): Promise<string | null>
    put(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
    getAll(keys: string[]): Promise<Map<string, string>>
    close(): void
  }
  export default Etcd3
}

// zookeeper
declare module 'zookeeper' {
  export class ZooKeeper {
    constructor()
    connect(url: string): void
    create(path: string, data?: string): Promise<string>
    remove(path: string, version?: number): Promise<void>
    exists(path: string): Promise<boolean>
    getData(path: string): Promise<string>
    setData(path: string, data: string): Promise<void>
    getChildren(path: string): Promise<string[]>
    close(): void
  }
  export default ZooKeeper
}

// CockroachDB
declare module 'cockroach' {
  export interface CockroachConfig {
    host: string
    port: number
    database: string
    user: string
    password: string
  }
  export class Client {
    constructor(config: CockroachConfig)
    query(sql: string, params?: unknown[]): Promise<unknown>
    connect(): Promise<void>
    close(): Promise<void>
  }
}

// TensorFlow.js
declare module '@tensorflow/tfjs-node' {
  import * as tf from '@tensorflow/tfjs'
  export = tf
}

// CSV parsing
declare module 'csv-parse' {
  export function parse(
    data: string,
    options?: unknown,
    callback?: (err: Error | null, data: unknown[]) => void,
  ): void
  export class Parser {
    constructor(options?: unknown)
    write(data: string): void
    end(): void
    on(event: 'readable', callback: () => void): void
    on(event: 'error', callback: (err: Error) => void): void
  }
}

// CSV writing
declare module 'csv-writer' {
  export function createObjectCsvWriter(params: {
    header: Array<{ id: string; title: string }>
    path: string
  }): {
    writeRecords(records: unknown[]): Promise<void>
  }
}

// ClickHouse
declare module '@clickhouse/client' {
  export interface ClickHouseClient {
    query(params: unknown): Promise<unknown>
    insert(params: unknown): Promise<void>
    command(params: unknown): Promise<void>
  }
  export function createClient(config?: unknown): ClickHouseClient
}

// AWS SDK v3
declare module '@aws-sdk/client-cloudwatch' {
  export class CloudWatchClient {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
  export class PutMetricDataCommand {
    constructor(params: unknown)
  }
}

declare module '@aws-sdk/client-lambda' {
  export class LambdaClient {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
  export class InvokeCommand {
    constructor(params: unknown)
  }
}

declare module '@aws-sdk/client-route-53' {
  export class Route53Client {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
  export class ChangeResourceRecordSetsCommand {
    constructor(params: unknown)
  }
}

declare module '@aws-sdk/client-sns' {
  export class SNSClient {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
  export class PublishCommand {
    constructor(params: unknown)
  }
}

declare module '@aws-sdk/client-sqs' {
  export class SQSClient {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
  export class SendMessageCommand {
    constructor(params: unknown)
  }
}

declare module '@aws-sdk/client-ec2' {
  export class EC2Client {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
}

declare module '@aws-sdk/client-elastic-load-balancing-v2' {
  export class ELBv2Client {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
}

declare module '@aws-sdk/client-ssm' {
  export class SSMClient {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
}

declare module '@aws-sdk/client-secrets-manager' {
  export class SecretsManagerClient {
    constructor(config: unknown)
    send(command: unknown): Promise<unknown>
  }
}

// Next.js
declare module 'next/server' {
  export class NextResponse<T = unknown> {
    static json(data: T, init?: ResponseInit): NextResponse<T>
    static redirect(url: string, status?: number): NextResponse
    static staticImageData: unknown
    status: number
    json(): Promise<T>
    text(): Promise<string>
    headers: Headers
  }
  export class NextRequest extends Request {
    nextUrl: URL
    cookies: Cookies
    geo?: GeoInfo
    ip?: string
  }
  interface ResponseInit {
    status?: number
    statusText?: string
    headers?: HeadersInit
  }
  interface Cookies {
    get(name: string): Cookie | undefined
    set(name: string, value: string, options?: CookieOptions): void
    delete(name: string): void
    getAll(): Cookie[]
  }
  interface Cookie {
    name: string
    value: string
    path?: string
    domain?: string
    expires?: Date
    secure?: boolean
    httpOnly?: boolean
  }
  interface CookieOptions {
    path?: string
    domain?: string
    expires?: Date
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
  }
  interface GeoInfo {
    city?: string
    country?: string
    region?: string
    latitude?: string
    longitude?: string
  }
}

// jsonwebtoken
declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: unknown
    iat?: number
    exp?: number
  }
  export function sign(
    payload: string | Buffer | object | Buffer[],
    secretOrPrivateKey: string | Buffer | object,
    options?: object,
  ): string
  export function verify(
    token: string | Buffer,
    secretOrPublicKey: string | Buffer,
    options?: object,
  ): string | JwtPayload
}

// uuid
declare module 'uuid' {
  export function v4(): string
  export function v1(): string
  export function v3(namespace: string, name: string): string
  export function v5(namespace: string, name: string): string
  export const NIL: string
  export const VERSIONS: {
    v1: number
    v3: number
    v4: number
    v5: number
  }
}
