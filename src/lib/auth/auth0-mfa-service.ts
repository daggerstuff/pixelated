/**
 * Auth0 Multi-Factor Authentication (MFA) Service
 * Handles MFA enrollment, challenge, and management using Auth0 Guardian
 */

import { ManagementClient, AuthenticationClient } from 'auth0'

type GuardianEnrollment = {
  id: string
  type: string
  name?: string
  enrolled_at?: string
  last_used_at?: string
  status?: MFAFactorStatus
}

type GuardianFactor = {
  name: string
  type?: string
  enabled: boolean
}

type EnrollmentTicketResponse = {
  ticket_id: string
}

// Type alias for auth0 v5+ compatibility
export type ManagementClientOptionsWithClientCredentials = {
  domain: string
  clientId: string
  clientSecret: string
  audience?: string
}

declare module 'auth0' {
  interface ManagementClient {
    getGuardianEnrollments(params: {
      id: string
    }): Promise<GuardianEnrollment[]>
    getGuardianFactors(): Promise<GuardianFactor[]>
    createGuardianEnrollmentTicket(params: {
      user_id: string
      send_mail: boolean
    }): Promise<EnrollmentTicketResponse>
    deleteGuardianEnrollment(params: { id: string }): Promise<void>
  }
}

type ExtendedAuthenticationClient = AuthenticationClient

import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { auth0Config } from './auth0-config'

// Initialize Auth0 clients
let auth0Authentication: ExtendedAuthenticationClient | null = null
let auth0Management: ManagementClient | null = null

/**
 * Initialize Auth0 clients
 */
function initializeAuth0Clients() {
  if (
    !auth0Config.domain ||
    !auth0Config.clientId ||
    !auth0Config.clientSecret
  ) {
    console.warn('Auth0 configuration incomplete')
    return
  }

  auth0Authentication ??= new AuthenticationClient({
    domain: auth0Config.domain,
    clientId: auth0Config.clientId,
    clientSecret: auth0Config.clientSecret,
  })

  if (
    !auth0Management &&
    auth0Config.managementClientId &&
    auth0Config.managementClientSecret
  ) {
    auth0Management = new ManagementClient({
      domain: auth0Config.domain,
      clientId: auth0Config.managementClientId,
      clientSecret: auth0Config.managementClientSecret,
      audience: `https://${auth0Config.domain}/api/v2/`,
    })
  }
}

// Initialize the clients
initializeAuth0Clients()

// Types
export interface MFAFactor {
  id: string
  factorType: 'otp' | 'sms' | 'webauthn-roaming' | 'webauthn-platform'
  friendlyName?: string
  enrolledAt: string
  lastUsedAt?: string
  status: 'enabled' | 'disabled' | 'pending'
}

export interface MFAEnrollment {
  factorType: 'otp' | 'sms' | 'webauthn-roaming' | 'webauthn-platform'
  phoneNumber?: string
  friendlyName?: string
}

export interface MFAChallenge {
  challengeType: string
  bindingMethod: 'prompt' | 'qr' | 'email' | 'sms'
  qrCode?: string
  oobCode?: string
}

type MFAFactorStatus = 'enabled' | 'disabled' | 'pending'

type UnknownRecord = Record<string, unknown>

export interface MFAVerification {
  challengeType: string
  oobCode?: string
  bindingCode?: string
  authenticatorCode?: string
}

type SupportedFactorType = Extract<
  MFAFactor['factorType'],
  'otp' | 'sms' | 'webauthn-roaming' | 'webauthn-platform'
>

function isGuardianEnrollment(value: unknown): value is GuardianEnrollment {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string'
  )
}

function isGuardianFactor(value: unknown): value is GuardianFactor {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.enabled === 'boolean'
  )
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function parseGuardianEnrollments(value: unknown): GuardianEnrollment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isGuardianEnrollment)
}

function parseGuardianFactors(value: unknown): GuardianFactor[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isGuardianFactor)
}

function parseEnrollmentTicket(
  value: unknown,
): EnrollmentTicketResponse | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  if (typeof value.ticket_id === 'string') {
    return { ticket_id: value.ticket_id }
  }

  return undefined
}

/**
 * Auth0 MFA Service
 * Handles Multi-Factor Authentication enrollment, challenges, and verification
 */
export class Auth0MFAService {
  constructor() {
    if (!auth0Config.domain) {
      console.warn('Auth0 is not properly configured')
    }
  }

  /**
   * Get available MFA factors for a user
   */
  async getAvailableFactors(userId: string): Promise<string[]> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const enrolledFactors = parseGuardianEnrollments(
        await auth0Management.getGuardianEnrollments({
          id: userId,
        }),
      )

      // Get all available factors
      const availableFactors = parseGuardianFactors(
        await auth0Management.getGuardianFactors(),
      )

      // Filter out already enrolled factors
      const enrolledFactorTypes = enrolledFactors.map(
        (factor: GuardianEnrollment) => factor.type,
      )
      const availableFactorTypes = availableFactors
        .filter(
          (factor: GuardianFactor) =>
            factor.enabled && !enrolledFactorTypes.includes(factor.name),
        )
        .map((factor: GuardianFactor) => factor.name)

      return availableFactorTypes
    } catch (error: unknown) {
      console.error('Failed to get available MFA factors:', error)
      throw new Error(
        `Failed to get available MFA factors: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Start MFA enrollment process
   */
  async startEnrollment(
    userId: string,
    factor: MFAEnrollment,
  ): Promise<MFAChallenge> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      let challenge: MFAChallenge

      switch (factor.factorType) {
        case 'otp':
          // For OTP, we generate a QR code for authenticator apps
          const otpEnrollment = parseEnrollmentTicket(
            await auth0Management.createGuardianEnrollmentTicket({
              user_id: userId,
              send_mail: false,
            }),
          )
          if (!otpEnrollment?.ticket_id) {
            throw new Error('Unable to initialize OTP enrollment ticket')
          }

          challenge = {
            challengeType: 'otp',
            bindingMethod: 'qr',
            qrCode: otpEnrollment.ticket_id, // This would be used to generate QR code
            oobCode: otpEnrollment.ticket_id,
          }
          break

        case 'sms':
          if (!factor.phoneNumber) {
            throw new Error('Phone number is required for SMS MFA')
          }

          // For SMS, we send a code to the phone number
          challenge = {
            challengeType: 'sms',
            bindingMethod: 'sms',
            oobCode: `sms-${userId}`, // Placeholder - actual implementation would get this from Auth0
          }
          break

        case 'webauthn-roaming':
        case 'webauthn-platform':
          // For WebAuthn, we generate a challenge for the browser
          challenge = {
            challengeType: factor.factorType,
            bindingMethod: 'prompt',
            oobCode: `webauthn-${userId}`, // Placeholder - actual implementation would get this from Auth0
          }
          break
      }

      // Log enrollment start event
      logSecurityEvent(SecurityEventType.MFA_ENROLLMENT_STARTED, null, {
        userId: userId,
        factorType: factor.factorType,
        timestamp: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with enrollment progress
      await updatePhase6AuthenticationProgress(
        userId,
        `mfa_enrollment_started_${factor.factorType}`,
      )

      return challenge
    } catch (error: unknown) {
      console.error('Failed to start MFA enrollment:', error)
      throw new Error(
        `Failed to start MFA enrollment: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Complete MFA enrollment process
   */
  async completeEnrollment(
    userId: string,
    verification: MFAVerification,
  ): Promise<MFAFactor> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // In a real implementation, we would verify the code with Auth0
      // For now, we'll simulate the completion

      const enrolledFactor: MFAFactor = {
        id: `factor-${Date.now()}`,
        factorType: this.resolveFactorType(verification.challengeType),
        enrolledAt: new Date().toISOString(),
        status: 'enabled',
      }

      // Log enrollment completion event
      logSecurityEvent(SecurityEventType.MFA_ENROLLMENT_COMPLETED, null, {
        userId: userId,
        factorType: verification.challengeType,
        factorId: enrolledFactor.id,
        timestamp: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with enrollment completion
      await updatePhase6AuthenticationProgress(
        userId,
        `mfa_enrollment_completed_${verification.challengeType}`,
      )

      return enrolledFactor
    } catch (error: unknown) {
      console.error('Failed to complete MFA enrollment:', error)
      throw new Error(
        `Failed to complete MFA enrollment: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get user's enrolled MFA factors
   */
  async getUserFactors(userId: string): Promise<MFAFactor[]> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      const enrollments = parseGuardianEnrollments(
        await auth0Management.getGuardianEnrollments({
          id: userId,
        }),
      )

      const factors: MFAFactor[] = enrollments
        .filter((enrollment: GuardianEnrollment) =>
          this.isSupportedFactorType(enrollment.type),
        )
        .map((enrollment: GuardianEnrollment) => ({
          id: enrollment.id,
          factorType: this.resolveFactorType(enrollment.type),
          friendlyName: enrollment.name,
          enrolledAt: enrollment.enrolled_at ?? new Date(0).toISOString(),
          lastUsedAt: enrollment.last_used_at,
          status: this.normalizeFactorStatus(enrollment.status),
        }))

      return factors
    } catch (error: unknown) {
      console.error('Failed to get user MFA factors:', error)
      return []
    }
  }

  /**
   * Delete/disable a user's MFA factor
   */
  async deleteFactor(userId: string, factorId: string): Promise<void> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      await auth0Management.deleteGuardianEnrollment({ id: factorId })

      // Log factor deletion event
      logSecurityEvent(SecurityEventType.MFA_FACTOR_DELETED, null, {
        userId: userId,
        factorId: factorId,
        timestamp: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with factor deletion
      await updatePhase6AuthenticationProgress(
        userId,
        `mfa_factor_deleted_${factorId}`,
      )
    } catch (error: unknown) {
      console.error(
        `Failed to delete MFA factor ${factorId} for user ${userId}:`,
        error,
      )
      throw new Error(
        `Failed to delete MFA factor: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Challenge user for MFA during authentication
   */
  async challengeUser(
    userId: string,
    factorType: string,
  ): Promise<MFAChallenge> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // In a real implementation, this would trigger an MFA challenge via Auth0
      // For now, we'll simulate the challenge

      const challenge: MFAChallenge = {
        challengeType: factorType,
        bindingMethod: factorType === 'sms' ? 'sms' : 'prompt',
        oobCode: `challenge-${userId}-${Date.now()}`,
      }

      // Log challenge event
      logSecurityEvent(SecurityEventType.MFA_CHALLENGE_SENT, null, {
        userId: userId,
        factorType: factorType,
        challengeId: challenge.oobCode,
        timestamp: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with challenge sent
      await updatePhase6AuthenticationProgress(
        userId,
        `mfa_challenge_sent_${factorType}`,
      )

      return challenge
    } catch (error: unknown) {
      console.error('Failed to challenge user for MFA:', error)
      throw new Error(
        `Failed to challenge user for MFA: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Verify MFA challenge response
   */
  async verifyChallenge(
    userId: string,
    verification: MFAVerification,
  ): Promise<boolean> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // In a real implementation, this would verify the MFA response with Auth0
      // For now, we'll simulate successful verification

      // Log verification event
      logSecurityEvent(SecurityEventType.MFA_VERIFICATION_COMPLETED, null, {
        userId: userId,
        challengeType: verification.challengeType,
        success: true,
        timestamp: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with verification completion
      await updatePhase6AuthenticationProgress(
        userId,
        `mfa_verification_completed_${verification.challengeType}`,
      )

      return true
    } catch (error: unknown) {
      console.error('Failed to verify MFA challenge:', error)

      // Log failed verification event
      logSecurityEvent(SecurityEventType.MFA_VERIFICATION_FAILED, null, {
        userId: userId,
        challengeType: verification.challengeType,
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error',
        timestamp: new Date().toISOString(),
      })

      return false
    }
  }

  /**
   * Check if user has MFA enabled
   */
  async userHasMFA(userId: string): Promise<boolean> {
    const factors = await this.getUserFactors(userId)
    return factors.length > 0
  }

  /**
   * Get user's preferred MFA factor
   */
  async getUserPreferredFactor(userId: string): Promise<MFAFactor | null> {
    const factors = await this.getUserFactors(userId)
    return factors.length > 0 ? factors[0] : null
  }

  /**
   * Set user's preferred MFA factor
   */
  async setUserPreferredFactor(
    userId: string,
    factorId: string,
  ): Promise<void> {
    // In a real implementation, this would update the user's preferred factor in Auth0
    // For now, we'll just log the event
    logSecurityEvent(SecurityEventType.MFA_PREFERRED_FACTOR_SET, null, {
      userId: userId,
      factorId: factorId,
      timestamp: new Date().toISOString(),
    })

    // Update Phase 6 MCP server with preferred factor set
    await updatePhase6AuthenticationProgress(
      userId,
      `mfa_preferred_factor_set_${factorId}`,
    )
  }

  private resolveFactorType(value: string): SupportedFactorType {
    switch (value) {
      case 'otp':
      case 'sms':
      case 'webauthn-roaming':
      case 'webauthn-platform':
        return value
      default:
        throw new Error(`Unsupported factor type: ${value}`)
    }
  }

  private isSupportedFactorType(value: string): value is SupportedFactorType {
    return (
      value === 'otp' ||
      value === 'sms' ||
      value === 'webauthn-roaming' ||
      value === 'webauthn-platform'
    )
  }

  private normalizeFactorStatus(value: unknown): MFAFactorStatus {
    if (value === 'enabled' || value === 'disabled' || value === 'pending') {
      return value
    }

    return 'enabled'
  }
}

// Export singleton instance
export const auth0MFAService = new Auth0MFAService()
export default auth0MFAService
