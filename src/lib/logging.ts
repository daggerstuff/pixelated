/**
 * Logging utility for the application
 */

/**
 * Log levels in order of increasing severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Type definition for structured log data
 */
export interface LogData {
  message: string
  level: LogLevel
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * Logger interface defining the core logging operations
 */
export interface Logger {
  debug: (message: string, metadata?: Record<string, unknown>) => void
  info: (message: string, metadata?: Record<string, unknown>) => void
  warn: (message: string, metadata?: Record<string, unknown>) => void
  error: (message: string, metadata?: Record<string, unknown>) => void
}

/**
 * Options for creating a logger
 */
export interface LoggerOptions {
  prefix?: string
}

// Helper function to check environment
const isServer = typeof window === 'undefined'
const isDevelopment = isServer
  ? process.env['NODE_ENV'] === 'development'
  : window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

// Helper function to get log level from environment
const getEnvLogLevel = (): LogLevel => {
  if (isServer) {
    return (process.env['LOG_LEVEL'] as LogLevel) || LogLevel.INFO
  }
  return LogLevel.INFO
}

/**
 * Console-based logger implementation that respects log levels
 * and provides structured logging capabilities
 */
class ConsoleLogger implements Logger {
  private logLevel: LogLevel
  private isDevelopment: boolean
  private prefix?: string

  constructor(level: LogLevel = LogLevel.INFO, prefix?: string) {
    this.logLevel = level
    this.isDevelopment = isDevelopment
    this.prefix = prefix
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): LogData {
    return {
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
      level,
      timestamp: Date.now(),
      metadata,
    }
  }

  private formatLogEntry({
    message,
    level,
    timestamp,
    metadata,
  }: LogData): string {
    const time = new Date(timestamp).toISOString()
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : ''
    return `[${time}] [${level.toUpperCase()}] ${message}${metadataStr}`
  }

  private writeLog(entry: LogData): void {
    const formattedMessage = this.formatLogEntry(entry)

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formattedMessage)
        break
      case LogLevel.WARN:
        console.warn(formattedMessage)
        break
      case LogLevel.INFO:
        console.info(formattedMessage)
        break
      case LogLevel.DEBUG:
        console.debug(formattedMessage)
        break
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel)
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const targetLevelIndex = levels.indexOf(level)
    return targetLevelIndex >= currentLevelIndex
  }

  debug: (message: string, metadata?: Record<string, unknown>) => void = (
    message,
    metadata,
  ) => {
    if (this.isDevelopment && this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.createLogEntry(LogLevel.DEBUG, message, metadata))
    }
  }

  info: (message: string, metadata?: Record<string, unknown>) => void = (
    message,
    metadata,
  ) => {
    if (this.isDevelopment && this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.createLogEntry(LogLevel.INFO, message, metadata))
    }
  }

  warn: (message: string, metadata?: Record<string, unknown>) => void = (
    message,
    metadata,
  ) => {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.createLogEntry(LogLevel.WARN, message, metadata))
    }
  }

  error: (message: string, metadata?: Record<string, unknown>) => void = (
    message,
    metadata,
  ) => {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.createLogEntry(LogLevel.ERROR, message, metadata))
    }
  }
}

// Singleton logger instance
let loggerInstance: Logger

/**
 * Get the logger instance, creating it if necessary
 * @param options Optional configuration options for the logger
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!loggerInstance) {
    const envLogLevel = getEnvLogLevel()
    loggerInstance = new ConsoleLogger(envLogLevel)
  }

  // If a prefix is provided, create a new logger with that prefix
  if (options?.prefix) {
    return new ConsoleLogger(getEnvLogLevel(), options.prefix)
  }

  return loggerInstance
}

/**
 * Set a custom logger implementation
 */
export function setLogger(customLogger: Logger): void {
  loggerInstance = customLogger
}

// createBuildSafeLogger function removed to avoid initialization issues during build
// Use createBuildSafeLogger directly instead
