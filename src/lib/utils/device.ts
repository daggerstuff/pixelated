/**
 * Utilities for browser and device detection
 */

/**
 * Determines the browser type from user agent string
 */
export function getBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) {
    return 'Chrome'
  }
  if (userAgent.includes('Firefox')) {
    return 'Firefox'
  }
  if (userAgent.includes('Safari')) {
    return 'Safari'
  }
  if (userAgent.includes('Edge')) {
    return 'Edge'
  }
  return 'Other'
}

/**
 * Determines the operating system from user agent string
 */
export function getOS(userAgent: string): string {
  if (userAgent.includes('Windows')) {
    return 'Windows'
  }
  if (userAgent.includes('Mac')) {
    return 'macOS'
  }
  if (userAgent.includes('Linux')) {
    return 'Linux'
  }
  if (userAgent.includes('Android')) {
    return 'Android'
  }
  if (userAgent.includes('iOS')) {
    return 'iOS'
  }
  return 'Other'
}

/**
 * Checks if the user agent indicates a mobile device
 */
export function isMobileDevice(userAgent: string): boolean {
  return /iPhone|iPad|Android|Mobile/.test(userAgent)
}
