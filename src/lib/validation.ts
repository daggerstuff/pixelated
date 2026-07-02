/**
 * Validation utilities including type guards, number helpers, object utilities, and error handling
 */

const isNonNullObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if a value is not null or undefined
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null
}

/**
 * Checks if a string is not empty (not null, undefined, or whitespace-only)
 * @param str - String to check
 * @returns True if string is not empty
 */
export function isNotEmpty(str: string | null | undefined): str is string {
  return isDefined(str) && str.trim().length > 0
}

/**
 * Type guard for checking if value is an object (not array, not null)
 * @param value - Value to check
 * @returns True if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return isNonNullObject(value) && !Array.isArray(value)
}

/**
 * Type guard for checking if value is an array
 * @param value - Value to check
 * @returns True if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Type guard for checking if value is a string
 * @param value - Value to check
 * @returns True if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Type guard for checking if value is a number
 * @param value - Value to check
 * @returns True if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

/**
 * Type guard for checking if value is a boolean
 * @param value - Value to check
 * @returns True if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

// ============================================================================
// String Validation
// ============================================================================

/**
 * Checks if a string is a valid email address
 * @param email - Email string to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Checks if a string is a valid URL
 * @param url - URL string to validate
 * @returns True if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Number Utilities
// ============================================================================

/**
 * Clamps a number between min and max values
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Checks if a value is within a range (inclusive)
 * @param value - Value to check
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if value is in range
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Formats a number with commas as thousands separators
 * @param num - Number to format
 * @returns Formatted string
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Rounds a number to a specified number of decimal places
 * @param num - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(num * factor) / factor
}

// ============================================================================
// Object Utilities
// ============================================================================

/**
 * Deep clones an object with performance optimizations
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => deepClone(item)) as unknown as T
  }

  if (isObject(obj)) {
    const clonedObj = {} as Record<string, unknown>
    const keys = Object.keys(obj)
    for (const key of keys) {
      clonedObj[key] = deepClone((obj as Record<string, unknown>)[key])
    }
    return clonedObj as T
  }

  return obj
}

/**
 * Checks if an object is empty (no enumerable properties)
 * @param obj - Object to check
 * @returns True if object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0
}

/**
 * Safely accesses nested object properties with optional chaining alternative
 * @param obj - Object to access
 * @param path - Path to property (e.g., 'a.b.c')
 * @param defaultValue - Default value if path doesn't exist
 * @returns Value at path or defaultValue
 */
export function getNestedProperty<T>(
  obj: unknown,
  path: string,
  defaultValue: T,
): T {
  if (!isNonNullObject(obj)) {
    return defaultValue
  }

  const keys = path.split('.')
  let result: unknown = obj

  for (const key of keys) {
    if (!isNonNullObject(result) || !(key in result)) {
      return defaultValue
    }
    result = result[key]
  }

  return result as T
}

/**
 * Picks specified properties from an object
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns Object with picked properties
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Omits specified properties from an object
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns Object without omitted properties
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj }
  for (const key of keys) {
    delete result[key]
  }
  return result
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Creates a standardized error object
 * @param message - Error message
 * @param code - Error code
 * @param details - Additional error details
 * @returns Error object
 */
export function createError(
  message: string,
  code?: string,
  details?: Record<string, unknown>,
): Error & { code?: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & {
    code?: string
    details?: Record<string, unknown>
  }
  if (code !== undefined) {
    error.code = code
  }
  if (details !== undefined) {
    error.details = details
  }
  return error
}

/**
 * Safely executes a function and returns a result or error
 * @param fn - Function to execute
 * @returns Result object with success/error state
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error: unknown) {
    return { success: false, error: error as Error }
  }
}
