/**
 * Two-Factor Authentication (2FA) System - Phase 7 Multi-Role Authentication
 * Implements secure TOTP-based 2FA with backup codes and device management
 */

import { authenticator } from 'otplib'

import QRCode from 'qrcode'
import { setInCache, getFromCache, removeFromCache } from '../redis'
import { logSecurityEvent, SecurityEventType } from '../security'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { AuthenticationError } from './jwt-service'
import type { UserRole } from './roles'

// Configuration
const TOTP_CONFIG = {
  issuer: process.env.TOTP_ISSUER || 'Pixelated Empathy Platform',
  algorithm: 'sha1',
  digits: 6,
  period: 30, // 30 seconds
  window: 1, // Allow 1 time step of drift
}

const BACKUP_CODES_CONFIG = {
  count: 10,
  length: 8,
  charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
}

const DEVICE_TRUST_CONFIG = {
  maxTrustedDevices: 5,
  trustDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  verificationRequired: true,
}

// Types
export interface TwoFactorSetup {
  secret: string
  qrCode: string
  backupCodes: string[]
  setupComplete: boolean
}

export interface TrustedDevice {
  deviceId: string
  deviceName: string
  deviceType: string
  lastUsed: number
  trustedAt: number
  expiresAt: number
  ipAddress: string
  userAgent: string
}

export interface TwoFactorStatus {
  enabled: boolean
  setupComplete: boolean
  backupCodesRemaining: number
  trustedDevices: TrustedDevice[]
  lastUsed?: number
}

export interface TwoFactorVerification {
  userId: string
  token: string
  deviceId?: string
  deviceName?: string
  trustDevice?: boolean
  backupCode?: string
}

export interface TwoFactorConfig {
  requiredRoles: UserRole[]
  optionalRoles: UserRole[]
  enforceAfter: number // Days after account creation
  allowBackupCodes: boolean
  maxAttempts: number
  lockoutDuration: number // Minutes
}

/**
 * Generate secure TOTP secret
 */
function generateTOTPSecret(): string {
  return authenticator.generateSecret()
}

/**
 * Generate backup codes
 */
function generateBackupCodes(): string[] {
  const codes: string[] = []
  const charset = BACKUP_CODES_CONFIG.charset

  for (let i = 0; i < BACKUP_CODES_CONFIG.count; i++) {
    let code = ''
    for (let j = 0; j < BACKUP_CODES_CONFIG.length; j++) {
      const randomIndex = Math.floor(Math.random() * charset.length)
      code += charset[randomIndex]
    }
    codes.push(code)
  }

  return codes
}

/**
 * Hash backup code for secure storage
 */
async function hashBackupCode(code: string): Promise<string> {
  const crypto = await import('crypto')
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Setup 2FA for user
 */
export async function setupTwoFactorAuth(
  userId: string,
  userEmail: string,
  deviceInfo: {
    deviceId: string
    deviceName: string
    deviceType: string
    ipAddress: string
    userAgent: string
  },
): Promise<TwoFactorSetup> {
  try {
    // Check if 2FA is already enabled
    const existingStatus = await getTwoFactorStatus(userId)
    if (existingStatus.enabled) {
      throw new AuthenticationError('2FA is already enabled for this user')
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret()

    // Generate backup codes
    const backupCodes = generateBackupCodes()

    // Store hashed backup codes
    const hashedCodes: string[] = []
    for (const code of backupCodes) {
      const hashedCode = await hashBackupCode(code)
      hashedCodes.push(hashedCode)
    }

    // Generate QR code for authenticator apps
    const otpauth = authenticator.keyuri(userEmail, TOTP_CONFIG.issuer, secret)

    const qrCode = await QRCode.toDataURL(otpauth)

    // Store setup data temporarily (expires in 15 minutes)
    const setupData = {
      secret,
      backupCodes: hashedCodes,
      setupComplete: false,
      createdAt: Date.now(),
    }

    await setInCache(
      `2fa:setup:${userId}`,
      setupData,
      15 * 60, // 15 minutes
    )

    // Log setup initiation
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_SETUP_INITIATED, {
      userId: userId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, '2fa_setup_initiated')

    return {
      secret,
      qrCode,
      backupCodes,
      setupComplete: false,
    }
  } catch (error) {
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_SETUP_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId: deviceInfo.deviceId,
    })

    throw new AuthenticationError('Failed to setup 2FA')
  }
}

/**
 * Complete 2FA setup by verifying first token
 */
export async function completeTwoFactorSetup(
  userId: string,
  token: string,
  deviceInfo: {
    deviceId: string
    deviceName: string
    deviceType: string
    ipAddress: string
    userAgent: string
  },
): Promise<void> {
  try {
    // Get setup data
    const setupData = await getFromCache(`2fa:setup:${userId}`)
    if (!setupData || setupData.setupComplete) {
      throw new AuthenticationError('Invalid or expired setup session')
    }

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: setupData.secret,
      algorithm: TOTP_CONFIG.algorithm,
      digits: TOTP_CONFIG.digits,
      period: TOTP_CONFIG.period,
      window: TOTP_CONFIG.window,
    })

    if (!isValid) {
      throw new AuthenticationError('Invalid verification code')
    }

    // Store 2FA configuration
    const twoFactorConfig = {
      secret: setupData.secret,
      backupCodes: setupData.backupCodes,
      enabled: true,
      setupComplete: true,
      createdAt: Date.now(),
      lastUsed: null,
    }

    await setInCache(
      `2fa:config:${userId}`,
      twoFactorConfig,
      365 * 24 * 60 * 60, // 1 year
    )

    // Add device as trusted if requested
    await addTrustedDevice(userId, deviceInfo)

    // Clean up setup data
    await removeFromCache(`2fa:setup:${userId}`)

    // Log successful setup
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_SETUP_COMPLETED, {
      userId: userId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, '2fa_setup_completed')
  } catch (error) {
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_SETUP_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId: deviceInfo.deviceId,
    })

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to complete 2FA setup')
  }
}

/**
 * Verify 2FA token
 */
export async function verifyTwoFactorToken(
  verification: TwoFactorVerification,
): Promise<boolean> {
  const { userId, token, deviceId, deviceName, trustDevice, backupCode } =
    verification

  try {
    // Get 2FA configuration
    const config = await getFromCache(`2fa:config:${userId}`)
    if (!config || !config.enabled) {
      throw new AuthenticationError('2FA is not enabled for this user')
    }

    // Check for lockout
    const lockoutKey = `2fa:lockout:${userId}`
    const lockoutData = await getFromCache(lockoutKey)
    if (lockoutData && lockoutData.lockedUntil > Date.now()) {
      throw new AuthenticationError(
        'Account is locked due to too many failed attempts',
      )
    }

    let isValid = false
    let verificationMethod = ''

    // Try backup code first if provided
    if (backupCode) {
      isValid = await verifyBackupCode(userId, backupCode)
      verificationMethod = 'backup_code'
    } else {
      // Verify TOTP token
      isValid = authenticator.verify({
        token,
        secret: config.secret,
        algorithm: TOTP_CONFIG.algorithm,
        digits: TOTP_CONFIG.digits,
        period: TOTP_CONFIG.period,
        window: TOTP_CONFIG.window,
      })
      verificationMethod = 'totp'
    }

    if (!isValid) {
      // Increment failed attempts
      const attemptsKey = `2fa:attempts:${userId}`
      const attempts = (await getFromCache(attemptsKey)) || {
        count: 0,
        lastAttempt: 0,
      }

      attempts.count += 1
      attempts.lastAttempt = Date.now()

      await setInCache(attemptsKey, attempts, 60 * 60) // 1 hour

      // Lock account after 5 failed attempts
      if (attempts.count >= 5) {
        const lockoutDuration = 15 * 60 * 1000 // 15 minutes
        await setInCache(
          lockoutKey,
          {
            lockedUntil: Date.now() + lockoutDuration,
            attempts: attempts.count,
          },
          60 * 60,
        ) // 1 hour

        await logSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, {
          userId: userId,
          reason: '2fa_failed_attempts',
          attempts: attempts.count,
        })
      }

      await logSecurityEvent(SecurityEventType.TWO_FACTOR_VERIFICATION_FAILED, {
        userId: userId,
        method: verificationMethod,
          deviceId,
          attempts: attempts.count,
        },
      )

      throw new AuthenticationError('Invalid verification code')
    }

    // Reset failed attempts on successful verification
    await removeFromCache(`2fa:attempts:${userId}`)
    await removeFromCache(lockoutKey)

    // Update last used timestamp
    config.lastUsed = Date.now()
    await setInCache(`2fa:config:${userId}`, config, 365 * 24 * 60 * 60)

    // Trust device if requested
    if (trustDevice && deviceId && deviceName) {
      await addTrustedDevice(userId, {
        deviceId,
        deviceName,
        deviceType: 'unknown',
        ipAddress: 'unknown',
        userAgent: 'unknown',
      })
    }

    // Log successful verification
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_VERIFICATION_SUCCESS, {
      userId: userId,
      method: verificationMethod,
      deviceId,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, '2fa_verification_success')

    return true
  } catch (error) {
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_VERIFICATION_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId,
    })

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('2FA verification failed')
  }
}

/**
 * Verify backup code
 */
async function verifyBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const config = await getFromCache(`2fa:config:${userId}`)
  if (!config || !config.backupCodes || config.backupCodes.length === 0) {
    return false
  }

  const hashedInput = await hashBackupCode(code)

  // Find matching backup code
  const codeIndex = config.backupCodes.indexOf(hashedInput)
  if (codeIndex === -1) {
    return false
  }

  // Remove used backup code
  config.backupCodes.splice(codeIndex, 1)
  await setInCache(`2fa:config:${userId}`, config, 365 * 24 * 60 * 60)

  // Log backup code usage
  await logSecurityEvent(SecurityEventType.BACKUP_CODE_USED, {
    userId: userId,
    codesRemaining: config.backupCodes.length,
  })

  return true
}

/**
 * Add trusted device
 */
export async function addTrustedDevice(
  userId: string,
  deviceInfo: {
    deviceId: string
    deviceName: string
    deviceType: string
    ipAddress: string
    userAgent: string
  },
): Promise<void> {
  try {
    const trustedKey = `2fa:trusted:${userId}`
    let trustedDevices = (await getFromCache(trustedKey)) || []

    // Check if device already exists
    const existingDevice = trustedDevices.find(
      (d: TrustedDevice) => d.deviceId === deviceInfo.deviceId,
    )
    if (existingDevice) {
      // Update existing device
      existingDevice.lastUsed = Date.now()
      existingDevice.ipAddress = deviceInfo.ipAddress
      existingDevice.userAgent = deviceInfo.userAgent
    } else {
      // Add new device
      if (trustedDevices.length >= DEVICE_TRUST_CONFIG.maxTrustedDevices) {
        // Remove oldest device
        trustedDevices.sort(
          (a: TrustedDevice, b: TrustedDevice) => a.lastUsed - b.lastUsed,
        )
        trustedDevices = trustedDevices.slice(
          0,
          DEVICE_TRUST_CONFIG.maxTrustedDevices - 1,
        )
      }

      const newDevice: TrustedDevice = {
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        lastUsed: Date.now(),
        trustedAt: Date.now(),
        expiresAt: Date.now() + DEVICE_TRUST_CONFIG.trustDuration,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
      }

      trustedDevices.push(newDevice)
    }

    await setInCache(trustedKey, trustedDevices, 365 * 24 * 60 * 60) // 1 year

    // Log device trust
    await logSecurityEvent(SecurityEventType.DEVICE_TRUSTED, {
      userId: userId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
    })
  } catch (error) {
    await logSecurityEvent(SecurityEventType.DEVICE_TRUST_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId: deviceInfo.deviceId,
    })

    throw new AuthenticationError('Failed to trust device')
  }
}

/**
 * Check if device is trusted
 */
export async function isTrustedDevice(
  userId: string,
  deviceId: string,
): Promise<boolean> {
  try {
    const trustedKey = `2fa:trusted:${userId}`
    const trustedDevices = (await getFromCache(trustedKey)) || []

    const device = trustedDevices.find(
      (d: TrustedDevice) => d.deviceId === deviceId && d.expiresAt > Date.now(),
    )

    if (device) {
      // Update last used timestamp
      device.lastUsed = Date.now()
      await setInCache(trustedKey, trustedDevices, 365 * 24 * 60 * 60)
      return true
    }

    return false
  } catch (error) {
    console.error('Error checking trusted device:', error)
    return false
  }
}

/**
 * Get 2FA status for user
 */
export async function getTwoFactorStatus(
  userId: string,
): Promise<TwoFactorStatus> {
  try {
    const config = await getFromCache(`2fa:config:${userId}`)
    const trustedDevices = (await getFromCache(`2fa:trusted:${userId}`)) || []

    if (!config) {
      return {
        enabled: false,
        setupComplete: false,
        backupCodesRemaining: 0,
        trustedDevices: [],
      }
    }

    return {
      enabled: config.enabled,
      setupComplete: config.setupComplete,
      backupCodesRemaining: config.backupCodes ? config.backupCodes.length : 0,
      trustedDevices: trustedDevices.filter(
        (d: TrustedDevice) => d.expiresAt > Date.now(),
      ),
      lastUsed: config.lastUsed,
    }
  } catch (error) {
    console.error('Error getting 2FA status:', error)
    return {
      enabled: false,
      setupComplete: false,
      backupCodesRemaining: 0,
      trustedDevices: [],
    }
  }
}

/**
 * Disable 2FA for user
 */
export async function disableTwoFactorAuth(
  userId: string,
  verificationToken: string,
  deviceInfo: {
    deviceId: string
    deviceName: string
    ipAddress: string
    userAgent: string
  },
): Promise<void> {
  try {
    // Verify token first
    const isValid = await verifyTwoFactorToken({
      userId,
      token: verificationToken,
      deviceId: deviceInfo.deviceId,
    })

    if (!isValid) {
      throw new AuthenticationError('Invalid verification code')
    }

    // Remove 2FA configuration
    await removeFromCache(`2fa:config:${userId}`)
    await removeFromCache(`2fa:trusted:${userId}`)
    await removeFromCache(`2fa:attempts:${userId}`)
    await removeFromCache(`2fa:lockout:${userId}`)

    // Log 2FA disable
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_DISABLED, {
      userId: userId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
    })

    // Update Phase 6 MCP server
    await updatePhase6AuthenticationProgress(userId, '2fa_disabled')
  } catch (error) {
    await logSecurityEvent(SecurityEventType.TWO_FACTOR_DISABLE_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId: deviceInfo.deviceId,
    })

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to disable 2FA')
  }
}

/**
 * Generate new backup codes
 */
export async function generateNewBackupCodes(
  userId: string,
  verificationToken: string,
): Promise<string[]> {
  try {
    // Verify token first
    const isValid = await verifyTwoFactorToken({
      userId,
      token: verificationToken,
    })

    if (!isValid) {
      throw new AuthenticationError('Invalid verification code')
    }

    // Generate new backup codes
    const newCodes = generateBackupCodes()
    const hashedCodes: string[] = []

    for (const code of newCodes) {
      const hashedCode = await hashBackupCode(code)
      hashedCodes.push(hashedCode)
    }

    // Update 2FA configuration
    const config = await getFromCache(`2fa:config:${userId}`)
    if (!config || !config.enabled) {
      throw new AuthenticationError('2FA is not enabled for this user')
    }

    config.backupCodes = hashedCodes
    await setInCache(`2fa:config:${userId}`, config, 365 * 24 * 60 * 60)

    // Log backup code generation
    await logSecurityEvent(SecurityEventType.BACKUP_CODES_GENERATED, {
      userId: userId,
      codesGenerated: newCodes.length,
    })

    return newCodes
  } catch (error) {
    await logSecurityEvent(SecurityEventType.BACKUP_CODES_GENERATION_FAILED, {
      userId: userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      },
    )

    throw error instanceof AuthenticationError
      ? error
      : new AuthenticationError('Failed to generate backup codes')
  }
}

/**
 * Check if 2FA is required for user
 */
export async function isTwoFactorRequired(
  userId: string,
  role: UserRole,
  deviceId?: string,
): Promise<boolean> {
  try {
    // Check user-specific 2FA status
    const status = await getTwoFactorStatus(userId)
    if (status.enabled) {
      return true
    }

    // Check if device is trusted
    if (deviceId && (await isTrustedDevice(userId, deviceId))) {
      return false
    }

    // Check role-based requirements
    const config = await getTwoFactorConfig()

    if (config.requiredRoles.includes(role)) {
      return true
    }

    if (config.optionalRoles.includes(role)) {
      // Check if user has opted in
      const userPreference = await getFromCache(`2fa:preference:${userId}`)
      return userPreference === 'enabled'
    }

    return false
  } catch (error) {
    console.error('Error checking 2FA requirement:', error)
    return false
  }
}

/**
 * Get 2FA configuration
 */
export async function getTwoFactorConfig(): Promise<TwoFactorConfig> {
  // In production, this would come from database or configuration service
  return {
    requiredRoles: ['admin', 'therapist', 'researcher'],
    optionalRoles: ['patient', 'support'],
    enforceAfter: 7, // Days after account creation
    allowBackupCodes: true,
    maxAttempts: 5,
    lockoutDuration: 15, // Minutes
  }
}

/**
 * Security event types for 2FA
 */
export const TwoFactorSecurityEventType = {
  TWO_FACTOR_SETUP_INITIATED: 'TWO_FACTOR_SETUP_INITIATED',
  TWO_FACTOR_SETUP_COMPLETED: 'TWO_FACTOR_SETUP_COMPLETED',
  TWO_FACTOR_SETUP_FAILED: 'TWO_FACTOR_SETUP_FAILED',
  TWO_FACTOR_VERIFICATION_SUCCESS: 'TWO_FACTOR_VERIFICATION_SUCCESS',
  TWO_FACTOR_VERIFICATION_FAILED: 'TWO_FACTOR_VERIFICATION_FAILED',
  TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_DISABLE_FAILED: 'TWO_FACTOR_DISABLE_FAILED',
  BACKUP_CODE_USED: 'BACKUP_CODE_USED',
  BACKUP_CODES_GENERATED: 'BACKUP_CODES_GENERATED',
  BACKUP_CODES_GENERATION_FAILED: 'BACKUP_CODES_GENERATION_FAILED',
  DEVICE_TRUSTED: 'DEVICE_TRUSTED',
  DEVICE_TRUST_FAILED: 'DEVICE_TRUST_FAILED',
} as const
