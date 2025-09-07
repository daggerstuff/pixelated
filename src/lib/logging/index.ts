/**
 * Logging utility for the therapy chat system
 * Provides consistent logging across the application
 */

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

// Define a type for log metadata that is more specific than 'any'
export type LogMetadataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogMetadataObject
  | LogMetadataArray

export interface LogMetadataObject {
  [key: string]: LogMetadataValue
}

export type LogMetadataArray = LogMetadataValue[]
export type LogMetadata = Record<string, LogMetadataValue>

// Default PHI/PII patterns -  example, to be expanded
// Simple Social Security Number
const DEFAULT_PHI_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // Add more patterns for common PHI/PII like DOB, specific ID formats, etc.
  // Example: Credit Card Numbers (very basic, needs refinement for real use)
  // /\b(?:\d[ -]*?){13,16}\b/g,
  // Example: Email Addresses (might be too broad for some logs, consider context)
  // /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
]

// Logger options
export interface LoggerOptions {
  level?: LogLevel
  prefix?: string
  includeTimestamp?: boolean
  console?: Console
  enableLogCollection?: boolean
  phiPatterns?: RegExp[] // Allow custom PHI patterns
  sanitizeFields?: string[] // Specify fields to always sanitize if found nested
}

// Log message format
export interface LogMessage {
  level: LogLevel
  message: string
  timestamp: Date
  prefix?: string
  metadata?: LogMetadata
}

// Default options
const DEFAULT_OPTIONS: LoggerOptions = {
  level: LogLevel.INFO,
  prefix: '',
  includeTimestamp: true,
  console,
  enableLogCollection: false,
  phiPatterns: DEFAULT_PHI_PATTERNS, // Initialize with default patterns
  sanitizeFields: ['patientId', 'ssn', 'address', 'email', 'phone', 'dob'], // Example sensitive fields
}

// Collected logs for debugging/telemetry
const collectedLogs: LogMessage[] = []
const MAX_COLLECTED_LOGS = 1000

/**
 * Logger class for consistent logging
 */
export class Logger {
  private options: LoggerOptions

  constructor(options?: Partial<LoggerOptions>) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      // Ensure phiPatterns is an array even if options.phiPatterns is undefined
      phiPatterns: [
        ...(DEFAULT_OPTIONS.phiPatterns || []),
        ...(options?.phiPatterns || []),
      ],
      sanitizeFields: [
        ...(DEFAULT_OPTIONS.sanitizeFields || []),
        ...(options?.sanitizeFields || []),
      ],
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param metadata Optional metadata to include
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param metadata Optional metadata to include
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata)
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param metadata Optional metadata to include
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata)
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error Optional error object
   * @param metadata Optional metadata to include
   */
  error(message: string, error?: unknown, metadata?: LogMetadata): void {
    const errorObject = error instanceof Error ? error : undefined
    let sanitizedErrorMessage = message

    // Sanitize the main error message
    sanitizedErrorMessage = this.sanitizeString(message)

    // Sanitize error object properties if it exists
    const processedError = errorObject
      ? {
          name: errorObject.name, // Typically safe
          message: this.sanitizeString(errorObject.message),
          stack: errorObject.stack
            ? this.sanitizeString(errorObject.stack)
            : undefined,
        }
      : undefined

    const errorMetadata = {
      ...metadata, // Original metadata will be sanitized in this.log()
      error: processedError, // Use the sanitized error object
    }

    this.log(LogLevel.ERROR, sanitizedErrorMessage, errorMetadata)
  }

  /**
   * Recursively sanitizes an object or array.
   * @param data The data to sanitize (string, object, array, etc.)
   * @param patterns Custom regex patterns for PII/PHI.
   * @param sensitiveKeys Keys that should always be sanitized if they are strings.
   * @returns Sanitized data.
   */
  private sanitizeData(
    data: LogMetadataValue,
    patterns?: RegExp[],
    sensitiveKeys?: string[],
  ): LogMetadataValue {
    const currentPatterns = patterns || this.options.phiPatterns || []
    const currentSensitiveKeys =
      sensitiveKeys || this.options.sanitizeFields || []

    if (typeof data === 'string') {
      return this.sanitizeString(data, currentPatterns)
    }

    if (Array.isArray(data)) {
      return data.map((item) =>
        this.sanitizeData(item, currentPatterns, currentSensitiveKeys),
      ) as LogMetadataArray
    }

    if (typeof data === 'object' && data !== null) {
      const sanitizedObject: LogMetadataObject = {}
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          if (
            currentSensitiveKeys.includes(key) &&
            typeof data[key] === 'string'
          ) {
            sanitizedObject[key] = this.sanitizeString(
              data[key] as string,
              currentPatterns,
              `[SANITIZED_${key.toUpperCase()}]`,
            )
          } else {
            sanitizedObject[key] = this.sanitizeData(
              data[key],
              currentPatterns,
              currentSensitiveKeys,
            )
          }
        }
      }
      return sanitizedObject
    }
    return data // Return numbers, booleans, null, undefined as is
  }

  /**
   * Sanitizes a string by replacing matches of PII/PHI patterns.
   * @param str The string to sanitize.
   * @param patterns Regex patterns to match.
   * @param replacement The string to replace matches with. Defaults to '[SANITIZED]'.
   * @returns Sanitized string.
   */
  private sanitizeString(
    str: string | undefined,
    patterns?: RegExp[],
    replacement: string = '[SANITIZED]',
  ): string {
    if (typeof str !== 'string') {
      return str === undefined ? '' : String(str) // Handle undefined or non-string types gracefully
    }
    let sanitizedStr = str
    const currentPatterns = patterns || this.options.phiPatterns || []
    for (const pattern of currentPatterns) {
      // Ensure the pattern has the global flag for multiple replacements
      const globalPattern = new RegExp(
        pattern.source,
        pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
      )
      sanitizedStr = sanitizedStr.replace(globalPattern, replacement)
    }
    return sanitizedStr
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    // Skip if log level is too low
    if (!this.shouldLog(level)) {
      return
    }

    // Sanitize message and metadata
    const sanitizedMessage = this.sanitizeString(message)
    const sanitizedMetadata = metadata
      ? (this.sanitizeData(metadata) as LogMetadata)
      : undefined

    // Only include prefix if it is defined, to satisfy exactOptionalPropertyTypes
    // Only include prefix and metadata if they are defined, to satisfy exactOptionalPropertyTypes
    const logMessage: LogMessage = {
      level,
      message: sanitizedMessage, // Use sanitized message
      timestamp: new Date(),
      ...(this.options.prefix !== undefined
        ? { prefix: this.options.prefix }
        : {}),
      ...(sanitizedMetadata !== undefined
        ? { metadata: sanitizedMetadata }
        : {}),
    }

    // Format the log message (using sanitized components)
    const formattedMessage = this.formatLogMessage(logMessage)

    // Output to console
    // Important: Ensure the console methods themselves don't cause issues or bypass sanitization
    // if a custom console object is used that does its own formatting with raw objects.
    // Here, we pass the already formatted string and the sanitized metadata separately.
    const consoleOutputMetadata = sanitizedMetadata || {}

    switch (level) {
      case LogLevel.DEBUG:
        this.options.console?.debug(formattedMessage, consoleOutputMetadata)
        break
      case LogLevel.INFO:
        this.options.console?.info(formattedMessage, consoleOutputMetadata)
        break
      case LogLevel.WARN:
        this.options.console?.warn(formattedMessage, consoleOutputMetadata)
        break
      case LogLevel.ERROR:
        // The 'error' field within metadata was already sanitized by the error() method.
        this.options.console?.error(formattedMessage, consoleOutputMetadata)
        break
    }

    // Add to collected logs if enabled
    if (this.options.enableLogCollection) {
      this.collectLog(logMessage)
    }
  }

  /**
   * Check if the log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ]
    const configuredLevelIndex = levels.indexOf(
      this.options.level || LogLevel.INFO,
    )
    const logLevelIndex = levels.indexOf(level)

    return logLevelIndex >= configuredLevelIndex
  }

  /**
   * Format a log message
   */
  private formatLogMessage(logMessage: LogMessage): string {
    const parts: string[] = []

    // Add timestamp if configured
    if (this.options.includeTimestamp) {
      parts.push(`[${logMessage.timestamp.toISOString()}]`)
    }

    // Add log level
    parts.push(`[${logMessage.level.toUpperCase()}]`)

    // Add prefix if configured
    if (logMessage.prefix) {
      parts.push(`[${logMessage.prefix}]`)
    }

    // Add message
    parts.push(logMessage.message)

    return parts.join(' ')
  }

  /**
   * Collect a log message for debugging/telemetry
   */
  private collectLog(logMessage: LogMessage): void {
    collectedLogs.push(logMessage)

    // Keep log collection under the maximum size
    if (collectedLogs.length > MAX_COLLECTED_LOGS) {
      collectedLogs.shift()
    }
  }

  /**
   * Create a child logger with a new prefix
   * @param prefix The prefix for the child logger
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.options,
      prefix: this.options.prefix ? `${this.options.prefix}:${prefix}` : prefix,
    })
  }
}

/**
 * Get the global logger instance
 * Creates one if it doesn't exist
 * Refactored to avoid TDZ/circular import issues.
 */
export function getLogger(options?: Partial<LoggerOptions>): Logger {
  // Use a function-scoped static variable to avoid TDZ/circular import issues
  // @ts-expect-error - Using static property on function for singleton pattern
  if (!getLogger._instance || options) {
    // @ts-expect-error - Using static property on function for singleton pattern
    getLogger._instance = new Logger(options || {})
  }
  // @ts-expect-error - Using static property on function for singleton pattern
  return getLogger._instance
}

/**
 * Get collected logs (for debugging/telemetry)
 */
export function getCollectedLogs(): LogMessage[] {
  return [...collectedLogs]
}

/**
 * Clear collected logs
 */
export function clearCollectedLogs() {
  collectedLogs.length = 0
}

/**
 * Configure global logging
 */
export function configureLogging(options: Partial<LoggerOptions>): void {
  // Use the function-scoped singleton pattern
  // @ts-expect-error - Using static property on function for singleton pattern
  getLogger._instance = new Logger(options)
}

/**
 * Do NOT export a top-level logger instance to avoid circular import issues.
 * If you need a default logger, use createBuildSafeLogger("default") directly in your code.
 */
// export default createBuildSafeLogger("default")
