// Additional type declarations for npm packages

// Mongoose - using actual mongoose types
// Type augmentation for mongoose models
import 'mongoose'

declare module 'mongoose' {
  interface SchemaOptions {
    timestamps?: boolean
    strict?: boolean
    collection?: string
  }

  interface SchemaDefinition {
    [key: string]: SchemaDefinitionProperty | SchemaDefinition
  }

  interface SchemaDefinitionProperty {
    type?: any
    required?: boolean
    unique?: boolean
    index?: boolean
    enum?: string[]
    default?: any
    ref?: string
    lowercase?: boolean
  }
}

// @nestjs/common
declare module '@nestjs/common' {
  export function Injectable(): ClassDecorator
  export function Controller(options?: unknown): ClassDecorator
  export function Get(path?: string): MethodDecorator
  export function Post(path?: string): MethodDecorator
  export function Put(path?: string): MethodDecorator
  export function Delete(path?: string): MethodDecorator
  export class HttpException extends Error {
    constructor(message: string, status: number)
    getResponse(): unknown
    getStatus(): number
  }
  export class UnauthorizedException extends HttpException {
    constructor(message?: string)
  }
  export class BadRequestException extends HttpException {
    constructor(message?: string)
  }
  export class InternalServerErrorException extends HttpException {
    constructor(message?: string)
  }
  export class NotFoundException extends HttpException {
    constructor(message?: string)
  }
  export interface ExecutionContext {
    getClass(): unknown
    getHandler(): unknown
  }
  export interface CanActivate {
    canActivate(context: ExecutionContext): boolean | Promise<boolean>
  }
  export interface NestInterceptor {
    intercept(context: ExecutionContext, next: unknown): unknown
  }
}

// bcrypt
declare module 'bcrypt' {
  export function hash(
    data: string,
    saltRounds: number
  ): Promise<string>
  export function compare(data: string, hash: string): Promise<boolean>
  export function genSalt(rounds: number): Promise<string>
  export function hashSync(data: string, saltRounds: number): string
  export function compareSync(data: string, hash: string): boolean
  export function getRounds(hash: string): number
  export function saltSync(rounds: number): string
}

// mongoose
declare module 'mongoose' {
  export function connect(uri: string, options?: unknown): Promise<void>
  export function disconnect(): Promise<void>
  export function model<T>(
    name: string,
    schema?: unknown
  ): unknown
  export class Schema<T = unknown> {
    constructor(definition?: T)
  }
  export class Document<T = unknown> {
    _id: string
    save(): Promise<this>
    toJSON(): T
  }
}

// typeorm
declare module 'typeorm' {
  export interface EntitySchemaOptions<T> {
    name: string
    target?: new (...args: unknown[]) => T
    tableName?: string
    columns: Record<string, {
      type: string
      primary?: boolean
      generated?: boolean | 'increment' | 'uuid' | 'rowid'
      nullable?: boolean
      unique?: boolean
      length?: number
    }>
    relations?: Record<string, {
      type: string
      joinColumn?: { name: string }
      onDelete?: string
    }>
    indices?: Array<{ columns: string[] }>
  }
  export class EntitySchema<T = unknown> {
    constructor(options: EntitySchemaOptions<T>)
  }
  export function Entity(
    tableName?: string | { name?: string; schema?: string }
  ): ClassDecorator
  export function Column(
    options?: { type?: string; nullable?: boolean; length?: number }
  ): PropertyDecorator
  export function PrimaryGeneratedColumn(
    type?: 'increment' | 'uuid' | 'rowid' | string
  ): PropertyDecorator
  export function PrimaryColumn(
    options?: { type?: string; length?: number }
  ): PropertyDecorator
  export function OneToMany(
    type: string | (() => unknown),
    inverseSide?: string | ((object: unknown) => unknown)
  ): PropertyDecorator
  export function ManyToOne(
    type: string | (() => unknown),
    inverseSide?: string | ((object: unknown) => unknown),
    options?: { nullable?: boolean; onDelete?: string }
  ): PropertyDecorator
  export function JoinColumn(
    options?: { name?: string; referencedColumnName?: string }
  ): PropertyDecorator
  export function CreateDateColumn(): PropertyDecorator
  export function UpdateDateColumn(): PropertyDecorator
  export interface DataSourceOptions {
    type: string
    host?: string
    port?: number
    username?: string
    password?: string
    database?: string
    entities?: unknown[]
    synchronize?: boolean
    logging?: boolean
  }
  export class DataSource {
    constructor(options: DataSourceOptions)
    initialize(): Promise<this>
    destroy(): Promise<void>
    getRepository<T>(target: new (...args: unknown[]) => T | EntitySchema<T>): Repository<T>
  }
  export class Repository<T> {
    create(): T
    create(partial: Partial<T>): T
    save(entity: T): Promise<T>
    remove(entity: T): Promise<void>
    find(options?: unknown): Promise<T[]>
    findOne(options?: unknown): Promise<T | null>
    findByIds(ids: unknown[]): Promise<T[]>
    count(options?: unknown): Promise<number>
    delete(conditions: unknown): Promise<void>
    update(conditions: unknown, partial: Partial<T>): Promise<void>
    query(sql: string, parameters?: unknown[]): Promise<unknown>
  }
}
