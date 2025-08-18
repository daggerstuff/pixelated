/**
 * Options for date formatting
 */
export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  /** Whether to include time in the output */
  includeTime?: boolean
  /** The locale to use for formatting */
  locale?: string
  /** Custom format string (overrides other options if provided) */
  formatString?: string
  /** Whether to use relative formatting (e.g., "2 days ago") */
  relative?: boolean
}

/**
 * Format a date string into a readable format
 * @param dateString - The date string to format
 * @param options - Formatting options
 * @returns The formatted date string
 * @throws {Error} If the date string is invalid
 */
export function formatDate(
  dateString: string,
  options: DateFormatOptions = {},
): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date string')
    }

    // Handle relative formatting
    if (options.relative) {
      return formatRelativeDate(date)
    }

    // Handle custom format string
    if (options.formatString) {
      return formatCustomDate(date, options.formatString)
    }

    // Default formatting options
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    }

    // Add time if requested
    if (options.includeTime) {
      formatOptions.hour = 'numeric'
      formatOptions.minute = 'numeric'
      formatOptions.second = options.second
    }

    return date.toLocaleDateString(options.locale || 'en-US', formatOptions)
  } catch (error: unknown) {
    throw new Error(
      `Failed to format date: ${error instanceof Error ? String(error) : 'Unknown error'}`,
    )
  }
}

/**
 * Format a date relative to now (e.g., "2 days ago")
 * @param date - The date to format
 * @returns The relative date string
 */
function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSecs < 60) {
    return 'just now'
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  } else if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
  } else {
    return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
  }
}

/**
 * Format a date using a custom format string
 * Supported tokens:
 * - YYYY: full year
 * - MM: month (01-12)
 * - DD: day (01-31)
 * - HH: hour (00-23)
 * - mm: minute (00-59)
 * - ss: second (00-59)
 * @param date - The date to format
 * @param formatString - The format string
 * @returns The formatted date string
 */
function formatCustomDate(date: Date, formatString: string): string {
  const tokens: Record<string, () => string> = {
    YYYY: () => date.getFullYear().toString(),
    MM: () => (date.getMonth() + 1).toString().padStart(2, '0'),
    DD: () => date.getDate().toString().padStart(2, '0'),
    HH: () => date.getHours().toString().padStart(2, '0'),
    mm: () => date.getMinutes().toString().padStart(2, '0'),
    ss: () => date.getSeconds().toString().padStart(2, '0'),
  }

  return formatString.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => {
    const tokenFn = tokens[match]
    return tokenFn ? tokenFn() : match
  })
}

/**
 * Check if a date string is valid
 * @param dateString - The date string to check
 * @returns Whether the date string is valid
 */
export function isValidDate(dateString: string): boolean {
  try {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  } catch {
    return false
  }
}

/**
 * Get the start of a time period
 * @param date - The date to get the start from
 * @param unit - The time unit ('day' | 'week' | 'month' | 'year')
 * @returns The start of the time period
 */
export function getStartOf(
  date: Date,
  unit: 'day' | 'week' | 'month' | 'year',
): Date {
  const result = new Date(date)

  switch (unit) {
    case 'day':
      result.setHours(0, 0, 0, 0)
      break
    case 'week':
      result.setDate(result.getDate() - result.getDay())
      result.setHours(0, 0, 0, 0)
      break
    case 'month':
      result.setDate(1)
      result.setHours(0, 0, 0, 0)
      break
    case 'year':
      result.setMonth(0, 1)
      result.setHours(0, 0, 0, 0)
      break
  }

  return result
}

/**
 * Format a duration in milliseconds
 * @param ms - The duration in milliseconds
 * @returns The formatted duration string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}
