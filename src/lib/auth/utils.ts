/**
 * Authentication Utility Functions
 * Helper functions for authentication operations
 */

import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import { BETTER_AUTH_CONFIG } from './config'

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return nanoid(length)
}

/**
 * Generate secure random ID
 */
export function generateSecureId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${nanoid(8)}`
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const rounds = BETTER_AUTH_CONFIG.security.bcryptRounds
  return await bcrypt.hash(password, rounds)
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const minLength = BETTER_AUTH_CONFIG.emailAndPassword.minPasswordLength
  const maxLength = BETTER_AUTH_CONFIG.emailAndPassword.maxPasswordLength

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`)
  }

  if (password.length > maxLength) {
    errors.push(`Password must be no more than ${maxLength} characters long`)
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes that could break SQL
    .substring(0, 255) // Limit length
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return generateSecureToken(32)
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(
  token: string,
  sessionToken: string,
): boolean {
  return token === sessionToken && token.length === 32
}

/**
 * Extract domain from email
 */
export function getEmailDomain(email: string): string {
  const parts = email.split('@')
  return parts.length === 2 ? parts[1] : ''
}

/**
 * Check if email is from disposable domain
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'tempmail.org',
    '10minutemail.com',
    'mailinator.com',
    'guerrillamail.com',
    'throwaway.email',
    'yopmail.com',
    'temp-mail.org',
    'fakeinbox.com',
  ]

  const domain = getEmailDomain(email).toLowerCase()
  return disposableDomains.some((disposable) => domain.includes(disposable))
}

/**
 * Generate secure session ID
 */
export function generateSessionId(): string {
  return `session_${generateSecureToken(24)}`
}

/**
 * Generate secure API key
 */
export function generateAPIKey(): string {
  return `pk_${generateSecureToken(32)}`
}

/**
 * Generate secure API secret
 */
export function generateAPISecret(): string {
  return `sk_${generateSecureToken(32)}`
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(
  data: string,
  visibleChars: number = 4,
): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length)
  }

  const start = data.substring(0, visibleChars)
  const end = data.substring(data.length - visibleChars)
  const middle = '*'.repeat(data.length - visibleChars * 2)

  return `${start}${middle}${end}`
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/

  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Parse user agent string
 */
export function parseUserAgent(userAgent: string): {
  browser: string
  os: string
  device: string
  isMobile: boolean
} {
  const ua = userAgent.toLowerCase()

  // Browser detection
  let browser = 'Unknown'
  if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari')) browser = 'Safari'
  else if (ua.includes('edge')) browser = 'Edge'
  else if (ua.includes('opera')) browser = 'Opera'

  // OS detection
  let os = 'Unknown'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('macintosh')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone')) os = 'iOS'

  // Device detection
  let device = 'Desktop'
  let isMobile = false

  if (ua.includes('mobile')) {
    device = 'Mobile'
    isMobile = true
  } else if (ua.includes('tablet')) {
    device = 'Tablet'
    isMobile = true
  }

  return { browser, os, device, isMobile }
}

/**
 * Calculate password entropy
 */
export function calculatePasswordEntropy(password: string): number {
  const charset = new Set(password)
  const possibleChars = charset.size

  return password.length * Math.log2(possibleChars)
}

/**
 * Check if password is strong enough
 */
export function isStrongPassword(password: string): boolean {
  const entropy = calculatePasswordEntropy(password)
  return entropy >= 50 // Minimum 50 bits of entropy
}

/**
 * Generate secure random string
 */
export function generateSecureRandomString(length: number = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

/**
 * Validate role name
 */
export function isValidRole(role: string): boolean {
  const validRoles = ['admin', 'therapist', 'researcher', 'patient', 'guest']
  return validRoles.includes(role)
}

/**
 * Convert role to display name
 */
export function roleToDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    admin: 'Administrator',
    therapist: 'Therapist',
    researcher: 'Researcher',
    patient: 'Patient',
    guest: 'Guest',
  }

  return roleMap[role] || role
}

/**
 * Check if user agent is a bot
 */
export function isBot(userAgent: string): boolean {
  const botPatterns = [
    'bot',
    'crawler',
    'spider',
    'scraper',
    'curl',
    'wget',
    'python',
    'java',
    'http',
    'client',
    'monitor',
    'check',
    'scan',
    'test',
  ]

  const ua = userAgent.toLowerCase()
  return botPatterns.some((pattern) => ua.includes(pattern))
}

/**
 * Generate device fingerprint
 */
export function generateDeviceFingerprint(
  userAgent: string,
  acceptLanguage: string,
  ip?: string,
): string {
  // Simple hash function for device fingerprinting
  const data = `${userAgent}|${acceptLanguage}|${ip || ''}`

  // Simple DJB2 hash algorithm
  let hash = 5381
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) + hash + data.charCodeAt(i)
    hash &= hash // Convert to 32-bit integer
  }

  // Convert to hex string
  return Math.abs(hash).toString(16)
}

/**
 * Sleep function for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i))
      }
    }
  }

  throw lastError!
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
