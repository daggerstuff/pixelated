/**
 * Database configuration and type definitions
 */

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  poolSize?: number
  connectionTimeout?: number
  queryTimeout?: number
}

export interface ConnectionPool {
  host: string
  port: number
  database: string
  user: string
  password: string
  max?: number
  min?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

export interface QueryResult<T = any> {
  rows: T[]
  rowCount: number
  command: string
}
