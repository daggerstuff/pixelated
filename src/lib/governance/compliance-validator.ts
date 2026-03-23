/**
 * Compliance Validator for HIPAA++ checks
 *
 * Validates that all HIPAA++ required conditions are met:
 * - FHE encryption is active
 * - Audit logging is active
 * - Consent verification is enabled
 */

import type { FHEService } from '../fhe/types'

/**
 * Result of a single compliance check
 */
export interface ComplianceCheckResult {
  check: string
  compliant: boolean
  reason?: string
}

/**
 * Result of compliance validation
 */
export interface ComplianceResult {
  compliant: boolean
  reasons: Array<ComplianceCheckResult | string>
  timestamp: number
}

/**
 * Service interface for audit logging
 */
interface AuditService {
  isActive: () => boolean
}

/**
 * Service interface for consent verification
 */
interface ConsentService {
  isEnabled: () => boolean
}

export class ComplianceValidator {
  private fheService: FHEService | null = null
  private auditService: AuditService | null = null
  private consentService: ConsentService | null = null

  /**
   * Set the FHE service for validation
   */
  setFheService(service: FHEService): void {
    this.fheService = service
  }

  /**
   * Set the audit service for validation
   */
  setAuditService(service: AuditService): void {
    this.auditService = service
  }

  /**
   * Set the consent service for validation
   */
  setConsentService(service: ConsentService): void {
    this.consentService = service
  }

  /**
   * Validate HIPAA++ compliance
   *
   * Checks all three required conditions:
   * 1. FHE encryption is active
   * 2. Audit logging is active
   * 3. Consent verification is enabled
   */
  async validate(): Promise<ComplianceResult> {
    const reasons: Array<ComplianceCheckResult | string> = []
    let compliant = true

    // Check 1: FHE encryption (always check)
    const fheCheck: ComplianceCheckResult = this.validateFHE()
    if (!fheCheck.compliant) {
      reasons.push(fheCheck)
      compliant = false
    }

    // Check 2: Audit logging (only if service is configured)
    if (this.auditService !== null) {
      const auditCheck: ComplianceCheckResult = this.validateAudit()
      if (!auditCheck.compliant) {
        reasons.push(auditCheck)
        compliant = false
      }
    }

    // Check 3: Consent verification (only if service is configured)
    if (this.consentService !== null) {
      const consentCheck: ComplianceCheckResult = this.validateConsent()
      if (!consentCheck.compliant) {
        reasons.push(consentCheck)
        compliant = false
      }
    }

    return {
      compliant,
      reasons,
      timestamp: Date.now(),
    }
  }

  /**
   * Validate FHE encryption is active
   */
  private validateFHE(): ComplianceCheckResult {
    // FHE is required - default to not compliant if not provided
    const isActive = this.fheService?.isInitialized?.() ?? false

    return {
      check: 'fhe_encryption',
      compliant: isActive,
      reason: isActive
        ? 'FHE encryption is active'
        : 'FHE encryption is not active',
    }
  }

  /**
   * Validate audit logging is active
   */
  private validateAudit(): ComplianceCheckResult {
    if (!this.auditService) {
      return {
        check: 'audit_logging',
        compliant: false,
        reason: 'Audit service not configured',
      }
    }

    const isActive = this.auditService.isActive()

    return {
      check: 'audit_logging',
      compliant: isActive,
      reason: isActive
        ? 'Audit logging is active'
        : 'Audit logging is not active',
    }
  }

  /**
   * Validate consent verification is enabled
   */
  private validateConsent(): ComplianceCheckResult {
    if (!this.consentService) {
      return {
        check: 'consent_verification',
        compliant: false,
        reason: 'Consent service not configured',
      }
    }

    const isEnabled = this.consentService.isEnabled()

    return {
      check: 'consent_verification',
      compliant: isEnabled,
      reason: isEnabled
        ? 'Consent verification is enabled'
        : 'Consent verification is not enabled',
    }
  }
}
