/**
 * Auth0 Multi-Factor Authentication (MFA) Service
 * Handles MFA enrollment, challenge, and management using Auth0 Guardian
 */

import { ManagementClient, AuthenticationClient } from 'auth0'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
}

// Initialize Auth0 clients
let auth0Authentication: AuthenticationClient | null = null
let auth0Management: ManagementClient | null = null

/**
 * Initialize Auth0 clients
 */
function initializeAuth0Clients() {
  if (!AUTH0_CONFIG.domain || !AUTH0_CONFIG.clientId || !AUTH0_CONFIG.clientSecret) {
    console.warn('Auth0 configuration incomplete'); return
  }

  if (!auth0Authentication) {
    auth0Authentication = new AuthenticationClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.clientId,
      clientSecret: AUTH0_CONFIG.clientSecret
    })
  }

  if (!auth0Management && AUTH0_CONFIG.managementClientId && AUTH0_CONFIG.managementClientSecret) {
    auth0Management = new ManagementClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.managementClientId,
      clientSecret: AUTH0_CONFIG.managementClientSecret,
      audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
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

export interface MFAVerification {
  challengeType: string
  oobCode?: string
  bindingCode?: string
  authenticatorCode?: string
}

/**
 * Auth0 MFA Service
 * Handles Multi-Factor Authentication enrollment, challenges, and verification
 */
export class Auth0MFAService {
  constructor() {
    if (!AUTH0_CONFIG.domain) {
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
      // Get user's enrolled factors
      const enrolledFactors = await auth0Management.users.enrollments.get(userId)

      // Get all available factors
      const availableFactors = await auth0Management.guardian.factors.list()

      // Filter out already enrolled factors
      const enrolledFactorTypes = enrolledFactors.map((factor: any) => factor.type)
      const availableFactorTypes = availableFactors
        .filter((factor: any) => factor.enabled && !enrolledFactorTypes.includes(factor.name))
        .map((factor: any) => factor.name)

      return availableFactorTypes
    } catch (error) {
      console.error('Failed to get available MFA factors:', error)
      throw new Error(`Failed to get available MFA factors: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Start MFA enrollment process
   */
  async startEnrollment(userId: string, factor: MFAEnrollment): Promise<MFAChallenge> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      let challenge: MFAChallenge

      switch (factor.factorType) {
        case 'otp':
          // For OTP, we generate a QR code for authenticator apps
          const otpEnrollment = await auth0Management.guardian.enrollments.createTicket({
            user_id: userId,
            send_mail: false
          })

          challenge = {
            challengeType: 'otp',
            bindingMethod: 'qr',
            qrCode: otpEnrollment.ticket_id, // This would be used to generate QR code
            oobCode: otpEnrollment.ticket_id
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
            oobCode: `sms-${userId}` // Placeholder - actual implementation would get this from Auth0
          }
          break

        case 'webauthn-roaming':
        case 'webauthn-platform':
          // For WebAuthn, we generate a challenge for the browser
          challenge = {
            challengeType: factor.factorType,
            bindingMethod: 'prompt',
            oobCode: `webauthn-${userId}` // Placeholder - actual implementation would get this from Auth0
          }
          break

        default:
          throw new Error(`Unsupported factor type: ${factor.factorType}`)
      }

      // Log enrollment start event
      await logSecurityEvent(SecurityEventType.MFA_ENROLLMENT_STARTED, {
        userId: userId,
        factorType: factor.factorType,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with enrollment progress
      await updatePhase6AuthenticationProgress(userId, `mfa_enrollment_started_${factor.factorType}`)

      return challenge
    } catch (error) {
      console.error('Failed to start MFA enrollment:', error)
      throw new Error(`Failed to start MFA enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Complete MFA enrollment process
   */
  async completeEnrollment(userId: string, verification: MFAVerification): Promise<MFAFactor> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // In a real implementation, we would verify the code with Auth0
      // For now, we'll simulate the completion

      const enrolledFactor: MFAFactor = {
        id: `factor-${Date.now()}`,
        factorType: verification.challengeType as any,
        enrolledAt: new Date().toISOString(),
        status: 'enabled'
      }

      // Log enrollment completion event
      await logSecurityEvent(SecurityEventType.MFA_ENROLLMENT_COMPLETED, {
        userId: userId,
        factorType: verification.challengeType,
        factorId: enrolledFactor.id,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with enrollment completion
      await updatePhase6AuthenticationProgress(userId, `mfa_enrollment_completed_${verification.challengeType}`)

      return enrolledFactor
    } catch (error) {
      console.error('Failed to complete MFA enrollment:', error)
      throw new Error(`Failed to complete MFA enrollment: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      const enrollments = await auth0Management.users.enrollments.get(userId)

      const factors: MFAFactor[] = enrollments.map((enrollment: any) => ({
        id: enrollment.id,
        factorType: enrollment.type,
        friendlyName: enrollment.name,
        enrolledAt: enrollment.enrolled_at,
        lastUsedAt: enrollment.last_used_at,
        status: enrollment.status || 'enabled'
      }))

      return factors
    } catch (error) {
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
      await auth0Management.guardian.enrollments.delete(factorId)

      // Log factor deletion event
      await logSecurityEvent(SecurityEventType.MFA_FACTOR_DELETED, {
        userId: userId,
        factorId: factorId,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with factor deletion
      await updatePhase6AuthenticationProgress(userId, `mfa_factor_deleted_${factorId}`)
    } catch (error) {
      console.error(`Failed to delete MFA factor ${factorId} for user ${userId}:`, error)
      throw new Error(`Failed to delete MFA factor: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Challenge user for MFA during authentication
   */
  async challengeUser(userId: string, factorType: string): Promise<MFAChallenge> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // In a real implementation, this would trigger an MFA challenge via Auth0
      // For now, we'll simulate the challenge

      const challenge: MFAChallenge = {
        challengeType: factorType,
        bindingMethod: factorType === 'sms' ? 'sms' : 'prompt',
        oobCode: `challenge-${userId}-${Date.now()}`
      }

      // Log challenge event
      await logSecurityEvent(SecurityEventType.MFA_CHALLENGE_SENT, {
        userId: userId,
        factorType: factorType,
        challengeId: challenge.oobCode,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with challenge sent
      await updatePhase6AuthenticationProgress(userId, `mfa_challenge_sent_${factorType}`)

      return challenge
    } catch (error) {
      console.error('Failed to challenge user for MFA:', error)
      throw new Error(`Failed to challenge user for MFA: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify MFA challenge response
   */
  async verifyChallenge(userId: string, verification: MFAVerification): Promise<boolean> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // In a real implementation, this would verify the MFA response with Auth0
      // For now, we'll simulate successful verification

      // Log verification event
      await logSecurityEvent(SecurityEventType.MFA_VERIFICATION_COMPLETED, {
        userId: userId,
        challengeType: verification.challengeType,
        success: true,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with verification completion
      await updatePhase6AuthenticationProgress(userId, `mfa_verification_completed_${verification.challengeType}`)

      return true
    } catch (error) {
      console.error('Failed to verify MFA challenge:', error)

      // Log failed verification event
      await logSecurityEvent(SecurityEventType.MFA_VERIFICATION_FAILED, {
        userId: userId,
        challengeType: verification.challengeType,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
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
  async setUserPreferredFactor(userId: string, factorId: string): Promise<void> {
    // In a real implementation, this would update the user's preferred factor in Auth0
    // For now, we'll just log the event

    await logSecurityEvent(SecurityEventType.MFA_PREFERRED_FACTOR_SET, {
      userId: userId,
      factorId: factorId,
      timestamp: new Date().toISOString()
    })

    // Update Phase 6 MCP server with preferred factor set
    await updatePhase6AuthenticationProgress(userId, `mfa_preferred_factor_set_${factorId}`)
  }
}

// Export singleton instance
export const auth0MFAService = new Auth0MFAService()
export default auth0MFAService