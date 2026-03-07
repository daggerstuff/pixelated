/**
 * Logging utility for the application
 * Provides consistent logging across the application with
 * support for different environments and log levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  level: LogLevel
  prefix?: string
  enabled: boolean
  environment?: 'development' | 'test' | 'production'
  redact?: string[]
}

class Logger {
  private options: LoggerOptions

  constructor(options?: Partial<LoggerOptions>) {
    this.options = {
      level: 'info',
      enabled: true,
      environment:
        (process.env['NODE_ENV'] as 'development' | 'test' | 'production') ||
        'development',
      ...options,
    }
  }

  /**
   * Redact sensitive keys from an object
   */
  private redact(obj: unknown, keys: string[]): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    const newObj = { ...(obj as Record<string, unknown>) }
    for (const key of keys) {
      if (key in newObj) {
        newObj[key] = '[REDACTED]'
      }
    }
    return newObj
  }

  /**
   * Set logger options
   */
  configure(options: Partial<LoggerOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args)
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args)
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args)
  }

  /**
   * Log an error message
   */
  error(message: string | Error, ...args: unknown[]): void {
    if (message instanceof Error) {
      this.log(
        'error',
        message.message,
        { error: message, stack: message.stack },
        ...args,
      )
    } else {
      this.log('error', message, ...args)
    }
  }

  /**
   * Create a child logger with the specified prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.options,
      prefix: this.options.prefix ? `${this.options.prefix}:${prefix}` : prefix,
    })
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.isLevelEnabled(level) || !this.options.enabled) {
      return
    }

    // Skip debug logs in production
    if (level === 'debug' && this.options.environment === 'production') {
      return
    }

    const timestamp = new Date().toISOString()
    const prefix = this.options.prefix ? `[${this.options.prefix}]` : ''
    const formattedMessage = `${timestamp} ${level.toUpperCase()} ${prefix} ${message}`

    // Redact sensitive data if needed
    const redactedArgs = this.options.redact
      ? args.map((arg) => this.redact(arg, this.options.redact!))
      : args

    // Browser or server logging
    if (typeof window !== 'undefined') {
      this.browserLog(level, formattedMessage, ...redactedArgs)
    } else {
      this.serverLog(level, formattedMessage, ...redactedArgs)
    }
  }

  /**
   * Browser-specific logging
   */
  private browserLog(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): void {
    switch (level) {
      case 'debug':
        console.debug(message, ...args)
        break
      case 'info':
        console.info(message, ...args)
        break
      case 'warn':
        console.warn(message, ...args)
        break
      case 'error':
        console.error(message, ...args)
        break
      default:
        console.log(message, ...args)
    }
  }

  /**
   * Server-specific logging
   */
  private serverLog(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): void {
    // On the server side, we could integrate with more advanced
    // logging systems like Winston or Pino, but for now we use console
    this.browserLog(level, message, ...args)
  }

  /**
   * Check if a log level is enabled
   */
  private isLevelEnabled(level: LogLevel): boolean {
    const logLevels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }

    return logLevels[level] >= logLevels[this.options.level]
  }
}

/**
 * Get a logger with the specified prefix
 * This function is the primary way to obtain a logger in the application
 * Refactored to avoid TDZ/circular import issues.
 */
export function getLogger(prefix?: string): Logger {
  // Use a function-scoped static variable to avoid TDZ/circular import issues
  // @ts-expect-error - Using function property for singleton pattern
  if (!getLogger._instance) {
    // @ts-expect-error - Using function property for singleton pattern
    getLogger._instance = new Logger()
  }
  // @ts-expect-error - Using function property for singleton pattern
  const baseLogger: Logger = getLogger._instance
  return prefix ? baseLogger.child(prefix) : baseLogger
}

// Export the Logger class
export { Logger }

// DO NOT export a top-level logger instance to avoid circular import issues
// If you need a default logger, use createBuildSafeLogger("default") directly in your code.
