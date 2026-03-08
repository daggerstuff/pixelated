/**
 * Date utility functions for consistent date handling across the application
 */

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'
import calendar from 'dayjs/plugin/calendar'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

// Initialize plugins
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)
dayjs.extend(calendar)
dayjs.extend(utc)
dayjs.extend(timezone)

// Default date format
export const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'

// Friendly date format
export const FRIENDLY_FORMAT = 'MMM D, YYYY h:mm A'

// ISO date format
export const ISO_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ'

// Date only format
export const DATE_ONLY_FORMAT = 'YYYY-MM-DD'

// Time only format
export const TIME_ONLY_FORMAT = 'HH:mm:ss'

/**
 * Format a date with the given format
 * @param date Date to format
 * @param format Format string (optional, defaults to DEFAULT_FORMAT)
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number | undefined,
  format: string = DEFAULT_FORMAT,
): string {
  if (!date) {
    return ''
  }
  return dayjs(date).format(format)
}

/**
 * Format a date as a friendly string
 * @param date Date to format
 * @returns Friendly formatted date string
 */
export function formatFriendlyDate(
  date: Date | string | number | undefined,
): string {
  if (!date) {
    return ''
  }
  return dayjs(date).format(FRIENDLY_FORMAT)
}

/**
 * Get relative time from now
 * @param date Date to calculate relative time from
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function fromNow(date: Date | string | number | undefined): string {
  if (!date) {
    return ''
  }
  return dayjs(date).fromNow()
}

/**
 * Format a date for calendar view
 * @param date Date to format
 * @returns Calendar formatted date string (e.g., "Today at 2:30 PM")
 */
export function formatCalendar(
  date: Date | string | number | undefined,
): string {
  if (!date) {
    return ''
  }
  return dayjs(date).calendar()
}

/**
 * Check if a date is in the past
 * @param date Date to check
 * @returns True if the date is in the past
 */
export function isPast(date: Date | string | number | undefined): boolean {
  if (!date) {
    return false
  }
  return dayjs(date).isBefore(dayjs())
}

/**
 * Check if a date is in the future
 * @param date Date to check
 * @returns True if the date is in the future
 */
export function isFuture(date: Date | string | number | undefined): boolean {
  if (!date) {
    return false
  }
  return dayjs(date).isAfter(dayjs())
}

/**
 * Convert a date to UTC
 * @param date Date to convert
 * @returns UTC date
 */
export function toUTC(date: Date | string | number | undefined): string {
  if (!date) {
    return ''
  }
  return dayjs(date).utc().format(ISO_FORMAT)
}

/**
 * Convert a UTC date to local timezone
 * @param date UTC date to convert
 * @returns Local date
 */
export function fromUTC(date: Date | string | number | undefined): Date {
  if (!date) {
    return new Date()
  }
  return dayjs.utc(date).local().toDate()
}

/**
 * Calculate time elapsed since a date
 * @param date Start date
 * @param end End date (defaults to now)
 * @returns Elapsed time in milliseconds
 */
export function timeElapsed(
  date: Date | string | number | undefined,
  end: Date | string | number = new Date(),
): number {
  if (!date) {
    return 0
  }
  return dayjs(end).diff(dayjs(date))
}

/**
 * Format time elapsed in a human-readable format
 * @param ms Time in milliseconds
 * @returns Formatted elapsed time (e.g., "2h 30m")
 */
export function formatElapsedTime(ms: number): string {
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

/**
 * Format a timestamp in a user-friendly way
 * @param timestamp Timestamp to format (Date, string, or number)
 * @returns Formatted timestamp (e.g., "Today at 2:30 PM" or "Jan 5, 2023")
 */
export function formatTimestamp(
  timestamp: Date | string | number | undefined,
): string {
  if (!timestamp) {
    return ''
  }

  // Convert to Date object
  const date = new Date(timestamp)

  // Get current date for comparison
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if the date is today or yesterday
  if (date >= today) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  } else if (date >= yesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  } else {
    // Format as month day, year
    return date.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
}

export default {
  formatDate,
  formatFriendlyDate,
  fromNow,
  formatCalendar,
  isPast,
  isFuture,
  toUTC,
  fromUTC,
  timeElapsed,
  formatElapsedTime,
  formatTimestamp,
}
