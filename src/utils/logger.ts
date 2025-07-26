/**
 * Logger utility for consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogOptions {
  level?: LogLevel
  timestamp?: boolean
  context?: string
  environment?: 'client' | 'server'
}

// Default options
const DEFAULT_OPTIONS: LogOptions = {
  level: LogLevel.INFO,
  timestamp: true,
  context: 'app',
  environment: typeof window !== 'undefined' ? 'client' : 'server',
}

// Current log level - can be set dynamically
let currentLogLevel =
  typeof process !== 'undefined' && process.env['NODE_ENV'] === 'production'
    ? LogLevel.ERROR
    : LogLevel.DEBUG

/**
 * Creates a logger with the given context
 */
export function createLogger(options: LogOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return {
    debug: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.DEBUG) {
        logMessage(LogLevel.DEBUG, opts, message, ...args)
      }
    },

    info: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.INFO) {
        logMessage(LogLevel.INFO, opts, message, ...args)
      }
    },

    warn: (message: string, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.WARN) {
        logMessage(LogLevel.WARN, opts, message, ...args)
      }
    },

    error: (message: string | Error, ...args: unknown[]) => {
      if (currentLogLevel <= LogLevel.ERROR) {
        if (message instanceof Error) {
          logMessage(LogLevel.ERROR, opts, message.message, ...args)
          console.error(message.stack)
        } else {
          logMessage(LogLevel.ERROR, opts, message, ...args)
        }
      }
    },

    setLevel: (level: LogLevel) => {
      currentLogLevel = level
    },

    getLevel: () => currentLogLevel,
  }
}

/**
 * Helper function to format and log messages
 */
function logMessage(
  level: LogLevel,
  options: LogOptions,
  message: string,
  ...args: unknown[]
) {
  const timestamp = options.timestamp ? `[${new Date().toISOString()}]` : ''
  const levelStr = LogLevel[level].padEnd(5)
  const context = options.context ? `[${options.context}]` : ''

  const prefix = `${timestamp} ${levelStr} ${context}:`

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(prefix, message, ...args)
      break
    case LogLevel.INFO:
      console.info(prefix, message, ...args)
      break
    case LogLevel.WARN:
      console.warn(prefix, message, ...args)
      break
    case LogLevel.ERROR:
      console.error(prefix, message, ...args)
      break
  }
}

// Default logger instance
export const logger = createLogger()

// Export a function to set the global log level
export function setLogLevel(level: LogLevel) {
  currentLogLevel = level
  logger.setLevel(level)
}

// Export log levels for easy access
export const LogLevels = LogLevel
