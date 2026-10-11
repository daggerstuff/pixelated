/**
 * Auth0 WebAuthn/FIDO2 Service
 * Implements passwordless authentication using WebAuthn/FIDO2 standards
 */

import { ManagementClient } from 'auth0'
import { AuthenticationClient } from 'auth0-legacy'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { logSecurityEvent, SecurityEventType } from '../security/index'
// Auth0 Configuration
import { auth0Config } from './auth0-config'
const logger = createBuildSafeLogger('auth0-webauthn-service')

const shouldWarnAuth0Configuration = process.env['NODE_ENV'] !== 'test'

// Initialize Auth0 clients
let auth0Authentication: AuthenticationClient | null = null
let auth0Management: ManagementClient | null = null
type WebAuthnCredentialInput = Partial<
  Pick<
    WebAuthnCredential,
    'id' | 'name' | 'type' | 'publicKey' | 'counter' | 'deviceType' | 'backedUp'
  >
>

function toWebAuthnCredentialInput(
  value: Record<string, unknown>,
): WebAuthnCredentialInput {
  return {
    id: typeof value['id'] === 'string' ? value['id'] : undefined,
    name: typeof value['name'] === 'string' ? value['name'] : undefined,
    type:
      value['type'] === 'webauthn-roaming' ||
      value['type'] === 'webauthn-platform'
        ? value['type']
        : undefined,
    publicKey:
      typeof value['publicKey'] === 'string' ? value['publicKey'] : undefined,
    counter:
      typeof value['counter'] === 'number' ? value['counter'] : undefined,
    deviceType:
      typeof value['deviceType'] === 'string' ? value['deviceType'] : undefined,
    backedUp:
      typeof value['backedUp'] === 'boolean' ? value['backedUp'] : undefined,
  }
}

/**
 * Initialize Auth0 clients
 */
function initializeAuth0Clients() {
  if (
    !auth0Config.domain ||
    !auth0Config.clientId ||
    !auth0Config.clientSecret
  ) {
    if (shouldWarnAuth0Configuration) {
      logger.warn('Auth0 configuration incomplete')
    }
    return
  }

  auth0Authentication ??= new AuthenticationClient({
    domain: auth0Config.domain,
    clientId: auth0Config.clientId,
    clientSecret: auth0Config.clientSecret,
  })

  if (!auth0Config.managementClientId || !auth0Config.managementClientSecret) {
    return
  }

  auth0Management ??= new ManagementClient({
    domain: auth0Config.domain,
    clientId: auth0Config.managementClientId,
    clientSecret: auth0Config.managementClientSecret,
    audience: `https://${auth0Config.domain}/api/v2/`,
  })
  return
}

// Initialize the clients
initializeAuth0Clients()

// Types
export interface WebAuthnCredential {
  id: string
  name: string
  type: 'webauthn-roaming' | 'webauthn-platform'
  registeredAt: string
  lastUsedAt?: string
  publicKey: string
  counter: number
  deviceType: string
  backedUp: boolean
}

export interface WebAuthnRegistrationOptions {
  userId: string
  userName: string
  userDisplayName: string
  authenticatorAttachment?: 'platform' | 'cross-platform'
  residentKey?: 'discouraged' | 'preferred' | 'required'
  userVerification?: 'discouraged' | 'preferred' | 'required'
}

export interface WebAuthnAuthenticationOptions {
  userId: string
  userVerification?: 'discouraged' | 'preferred' | 'required'
}

export interface WebAuthnCredentialCreationOptions {
  challenge: string
  rp: {
    name: string
    id?: string
  }
  user: {
    id: string
    name: string
    displayName: string
  }
  pubKeyCredParams: Array<{
    type: 'public-key'
    alg: number
  }>
  timeout?: number
  attestation?: 'none' | 'indirect' | 'direct'
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    residentKey?: 'discouraged' | 'preferred' | 'required'
    userVerification?: 'discouraged' | 'preferred' | 'required'
  }
  extensions?: any
}

export interface WebAuthnCredentialRequestOptions {
  challenge: string
  timeout?: number
  rpId?: string
  userVerification?: 'discouraged' | 'preferred' | 'required'
  allowCredentials?: Array<{
    type: 'public-key'
    id: string
    transports?: Array<'usb' | 'nfc' | 'ble' | 'internal'>
  }>
  extensions?: any
}

/**
 * Auth0 WebAuthn/FIDO2 Service
 * Implements passwordless authentication using WebAuthn/FIDO2 standards
 */
class Auth0WebAuthnService {
  private readonly rpName = 'Pixelated Empathy'
  private readonly rpId: string

  constructor() {
    if (!auth0Config.domain) {
      if (shouldWarnAuth0Configuration) {
        logger.warn('Auth0 is not properly configured')
      }
    }

    // Use the domain as RP ID for WebAuthn
    this.rpId = auth0Config.domain
  }

  /**
   * Get WebAuthn registration options for a new credential
   */
  async getRegistrationOptions(
    registrationOptions: WebAuthnRegistrationOptions,
  ): Promise<WebAuthnCredentialCreationOptions> {
    try {
      // In a real implementation, we would generate these options using a WebAuthn library
      // For now, we'll return a simulated structure that matches the WebAuthn spec

      const options: WebAuthnCredentialCreationOptions = {
        challenge: this.generateChallenge(),
        rp: {
          name: this.rpName,
          id: this.rpId,
        },
        user: {
          id: registrationOptions.userId,
          name: registrationOptions.userName,
          displayName: registrationOptions.userDisplayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000, // 60 seconds
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment:
            registrationOptions.authenticatorAttachment ?? 'cross-platform',
          residentKey: registrationOptions.residentKey ?? 'preferred',
          userVerification: registrationOptions.userVerification ?? 'preferred',
        },
      }

      // Log registration options generation
      logSecurityEvent(SecurityEventType.WEBAUTHN_REGISTRATION_STARTED, null, {
        userId: registrationOptions.userId,
        optionsGenerated: true,
        timestamp: new Date().toISOString(),
      })

      // Update Phase 6 MCP server with registration progress
      await updatePhase6AuthenticationProgress(
        registrationOptions.userId,
        'webauthn_registration_options_generated',
        { method: 'webauthn' },
      )

      return options
    } catch (error: unknown) {
      logger.error('Failed to generate WebAuthn registration options:', error)
      throw new Error(
        `Failed to generate WebAuthn registration options: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Verify and register a new WebAuthn credential
   */
  async verifyRegistration(
    userId: string,
    credential: Record<string, unknown> = {},
  ): Promise<WebAuthnCredential> {
    try {
      // Verifying a WebAuthn registration requires validating the
      // attestation (signature of the public key) produced by the
      // authenticator. That verification is not implemented here,
      // so we cannot register a credential honestly. Fail closed
      // rather than store a fabricated credential record.
      throw new Error(
        'WebAuthn registration verification is not supported; attestation validation is not wired up',
      )
    } catch (error: unknown) {
      logger.error('Failed to verify WebAuthn registration:', error)

      // Log failed registration
      logSecurityEvent(SecurityEventType.WEBAUTHN_REGISTRATION_FAILED, null, {
        userId: userId,
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error',
        timestamp: new Date().toISOString(),
      })

      throw new Error(
        `Failed to verify WebAuthn registration: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get WebAuthn authentication options for an existing user
   */
  async getAuthenticationOptions(
    authenticationOptions: WebAuthnAuthenticationOptions,
  ): Promise<WebAuthnCredentialRequestOptions> {
    try {
      // Get user's existing WebAuthn credentials
      const credentials = await this.getUserWebAuthnCredentials(
        authenticationOptions.userId,
      )

      const options: WebAuthnCredentialRequestOptions = {
        challenge: this.generateChallenge(),
        timeout: 60000, // 60 seconds
        rpId: this.rpId,
        userVerification: authenticationOptions.userVerification ?? 'preferred',
        allowCredentials: credentials.map((cred) => ({
          type: 'public-key',
          id: cred.id,
          // In a real implementation, we would include transports information
        })),
      }

      // Log authentication options generation
      logSecurityEvent(
        SecurityEventType.WEBAUTHN_AUTHENTICATION_STARTED,
        authenticationOptions.userId,
        {
          userId: authenticationOptions.userId,
          credentialsCount: credentials.length,
          optionsGenerated: true,
          timestamp: new Date().toISOString(),
        },
      )

      // Update Phase 6 MCP server with authentication progress
      await updatePhase6AuthenticationProgress(
        authenticationOptions.userId,
        'webauthn_authentication_options_generated',
        { credentialsCount: credentials.length },
      )

      return options
    } catch (error: unknown) {
      logger.error('Failed to generate WebAuthn authentication options:', error)
      throw new Error(
        `Failed to generate WebAuthn authentication options: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Verify WebAuthn authentication response
   */
  async verifyAuthentication(
    userId: string,
    credential: Record<string, unknown> = {},
  ): Promise<boolean> {
    const credentialInput = toWebAuthnCredentialInput(credential)
    const credentialId =
      credentialInput.id ?? `webauthn-credential-${Date.now()}`
    try {
      // Verifying a WebAuthn assertion requires checking the
      // authenticator's signature against the registered public key.
      // That verification is not implemented here. Returning true
      // would accept any response, including a forged one, as a
      // successful passwordless login. Fail closed.
      throw new Error(
        'WebAuthn authentication verification is not supported; assertion signature checking is not wired up',
      )
    } catch (error: unknown) {
      logger.error('Failed to verify WebAuthn authentication:', error)

      // Log failed authentication
      logSecurityEvent(SecurityEventType.WEBAUTHN_AUTHENTICATION_FAILED, null, {
        userId: userId,
        credentialId,
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
   * Get user's WebAuthn credentials
   */
  async getUserWebAuthnCredentials(
    userId: string,
  ): Promise<WebAuthnCredential[]> {
    // WebAuthn credentials are managed by Auth0's Guardian; the
    // Management API exposes no endpoint that lists a user's
    // WebAuthn (FIDO2) credentials. Returning fabricated credentials
    // would let callers believe a passwordless factor exists when
    // it does not. Return the honest answer: none are known.
    return []
  }

  /**
   * Delete a WebAuthn credential
   */
  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    if (!auth0Management) {
      throw new Error('Auth0 management client not initialized')
    }

    try {
      // The Management API has no endpoint to delete a user's
      // WebAuthn credential. Silently logging a deletion that never
      // happened would mislead callers. Fail closed.
      throw new Error(
        'WebAuthn credential deletion is not supported; no Management API endpoint exists for it',
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to delete WebAuthn credential ${credentialId} for user ${userId}:`,
        error,
      )
      throw new Error(
        `Failed to delete WebAuthn credential: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Rename a WebAuthn credential
   */
  async renameCredential(
    userId: string,
    credentialId: string,
    newName: string,
  ): Promise<void> {
    try {
      // The Management API has no endpoint to rename a user's
      // WebAuthn credential. Silently logging a rename that never
      // happened would mislead callers. Fail closed.
      throw new Error(
        'WebAuthn credential rename is not supported; no Management API endpoint exists for it',
      )
    } catch (error: unknown) {
      logger.error(
        `Failed to rename WebAuthn credential ${credentialId} for user ${userId}:`,
        error,
      )
      throw new Error(
        `Failed to rename WebAuthn credential: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
      )
    }
  }

  /**
   * Check if user has any WebAuthn credentials
   */
  async userHasWebAuthnCredentials(userId: string): Promise<boolean> {
    const credentials = await this.getUserWebAuthnCredentials(userId)
    return credentials.length > 0
  }

  /**
   * Get user's preferred WebAuthn credential
   */
  async getUserPreferredCredential(
    userId: string,
  ): Promise<WebAuthnCredential | null> {
    const credentials = await this.getUserWebAuthnCredentials(userId)
    return credentials.length > 0 ? credentials[0] : null
  }

  /**
   * Generate a random challenge for WebAuthn operations
   */
  private generateChallenge(): string {
    // Generate a random 32-byte challenge
    const array = new Uint8Array(32)
    if (typeof window !== 'undefined') {
      window.crypto.getRandomValues(array)
    } else {
      // Fallback for Node.js environment
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }

    // Convert to base64url encoding
    return Buffer.from(array).toString('base64url')
  }

  /**
   * Validate WebAuthn credential response
   */
  async validateCredentialResponse(
    userId: string,
    _response: any,
  ): Promise<boolean> {
    try {
      // WebAuthn authentication-response validation requires verifying
      // the authenticator's signature against the stored public key
      // (typically via @simplewebauthn/server or Auth0's own flow).
      // That is not wired up here. Returning true would accept any
      // response as a valid assertion. Fail closed.
      throw new Error(
        'WebAuthn credential response validation is not supported; signature verification is not wired up',
      )
    } catch (error: unknown) {
      logger.error('Failed to validate WebAuthn credential response:', error)

      // Log validation failure
      logSecurityEvent(
        SecurityEventType.WEBAUTHN_RESPONSE_VALIDATION_FAILED,
        userId,
        {
          userId: userId,
          error:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      )

      return false
    }
  }
}

// Export singleton instance
export const auth0WebAuthnService = new Auth0WebAuthnService()
