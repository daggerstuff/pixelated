/**
 * HIE Orchestration Service (F3.4)
 *
 * Wraps the existing HIEService with:
 * 1. Patient consent verification (consentService.hasActiveConsent)
 * 2. Comprehensive audit logging (EHRAuditService.logIntegration)
 * 3. Delegation to HIEService for input sanitization + adapter calls
 *
 * @see docs/adr/ADR-005-hie-implementation.md
 */

import { consentService } from '../../security/consent/ConsentService'
import { EHRAuditService } from '../audit/ehr-audit-service'
import type { IntegrationAuditInput } from '../audit/ehr-audit-service'
import { EHRAuditAction } from '../audit/events'
import type { HIEAdapter } from '../integrations/hie/adapter'
import {
  HIEService,
  clampLimit,
  clampOffset,
  requireHieId,
  sanitizeBoundedText,
  sanitizeIsoDate,
} from '../integrations/hie/hie-service'
import type {
  PatientDiscoveryRequest,
  PatientDiscoveryResult,
  DocumentQueryRequest,
  DocumentQueryResult,
  DocumentRetrievalRequest,
  DocumentRetrievalResult,
  DocumentSubmissionRequest,
  DocumentSubmissionResult,
  OrganizationDirectoryRequest,
  OrganizationDirectoryResult,
} from '../integrations/hie/types'

/** Consent type IDs for HIE data access */
export const HIE_CONSENT_TYPE_ID = 'hie_data_access'

/**
 * Configuration for the HIE orchestration service.
 */
export interface HIEOrchestrationConfig {
  readonly adapter: HIEAdapter
}

/**
 * Result when consent is denied — caller should handle gracefully.
 */
export class ConsentDeniedError extends Error {
  constructor(
    readonly userId: string,
    readonly consentTypeId: string,
  ) {
    super(`Consent denied for user ${userId} (consent type: ${consentTypeId})`)
    this.name = 'ConsentDeniedError'
  }
}

/**
 * HIE orchestration service — consent gate + audit + delegation.
 *
 * Each method:
 * 1. Verifies patient consent via `consentService.hasActiveConsent`
 * 2. Delegates to `HIEService` (which sanitizes inputs and calls the adapter)
 * 3. Logs the outcome to `EHRAuditService`
 */
export class HIEOrchestrationService {
  private readonly hieService: HIEService
  private readonly auditService: EHRAuditService

  constructor(config: HIEOrchestrationConfig) {
    this.hieService = new HIEService(config.adapter)
    this.auditService = EHRAuditService.getInstance()
  }

  /**
   * Discover a patient across the HIE network.
   * Requires active HIE data access consent.
   */
  async discoverPatient(
    userId: string,
    request: PatientDiscoveryRequest,
  ): Promise<PatientDiscoveryResult> {
    await this.requireConsent(userId)

    const action = EHRAuditAction.HIE_PATIENT_DISCOVERY
    let result: PatientDiscoveryResult

    try {
      result = await this.hieService.discoverPatient(request)
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
      })
      throw error
    }

    await this.auditSuccess(action, userId, {
      integrationSource: 'hie',
      metadata: { found: result.found, patientId: result.patientId },
    })

    return result
  }

  /**
   * Query clinical documents for a patient from the HIE.
   * Requires active HIE data access consent.
   */
  async queryDocuments(
    userId: string,
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult> {
    await this.requireConsent(userId)

    const action = EHRAuditAction.HIE_DOCUMENT_QUERY
    let result: DocumentQueryResult

    // Validate FHIR query inputs at the orchestration trust boundary before
    // they reach the HIE service / adapter layer.
    const validated: DocumentQueryRequest = {
      ...request,
      patientId: requireHieId(request.patientId, 'patientId'),
      authorOrganizationId:
        request.authorOrganizationId === undefined
          ? undefined
          : requireHieId(request.authorOrganizationId, 'authorOrganizationId'),
      fromDate: sanitizeIsoDate(request.fromDate, 'fromDate'),
      toDate: sanitizeIsoDate(request.toDate, 'toDate'),
      limit: clampLimit(request.limit),
      offset: clampOffset(request.offset),
    }

    try {
      result = await this.hieService.queryDocuments(validated)
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
        patientId: request.patientId,
      })
      throw error
    }

    await this.auditSuccess(action, userId, {
      integrationSource: 'hie',
      patientId: request.patientId,
      metadata: { total: result.total, hasMore: result.hasMore },
    })

    return result
  }

  /**
   * Retrieve a specific document from the HIE.
   * Requires active HIE data access consent.
   */
  async retrieveDocument(
    userId: string,
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    await this.requireConsent(userId)

    const action = EHRAuditAction.HIE_DOCUMENT_RETRIEVE
    let result: DocumentRetrievalResult

    try {
      result = await this.hieService.retrieveDocument(request)
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
        patientId: request.patientId,
      })
      throw error
    }

    await this.auditSuccess(action, userId, {
      integrationSource: 'hie',
      patientId: request.patientId,
      metadata: {
        retrieved: result.retrieved,
        contentType: result.contentType,
      },
    })

    return result
  }

  /**
   * Submit a clinical document to the HIE.
   * Requires active HIE data access consent.
   */
  async submitDocument(
    userId: string,
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult> {
    await this.requireConsent(userId)

    const action = EHRAuditAction.HIE_DOCUMENT_SUBMIT
    let result: DocumentSubmissionResult

    try {
      result = await this.hieService.submitDocument(request)
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
        patientId: request.patientId,
      })
      throw error
    }

    await this.auditSuccess(action, userId, {
      integrationSource: 'hie',
      patientId: request.patientId,
      metadata: {
        submitted: result.submitted,
        documentId: result.documentId ?? null,
      },
    })

    return result
  }

  /**
   * Query the HIE organization directory.
   * No patient data involved — consent not required.
   */
  async queryOrganizationDirectory(
    userId: string,
    request: OrganizationDirectoryRequest,
  ): Promise<OrganizationDirectoryResult> {
    const action = EHRAuditAction.HIE_DOCUMENT_QUERY // reuse for directory lookup
    let result: OrganizationDirectoryResult

    const validated: OrganizationDirectoryRequest = {
      ...request,
      type: sanitizeBoundedText(request.type),
      state: sanitizeBoundedText(request.state),
      name: sanitizeBoundedText(request.name),
      limit: clampLimit(request.limit),
    }

    try {
      result = await this.hieService.queryOrganizationDirectory(validated)
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
      })
      throw error
    }

    await this.auditSuccess(action, userId, {
      integrationSource: 'hie',
      metadata: { total: result.total },
    })

    return result
  }

  // ─── Private helpers ───────────────────────────────────────────

  /**
   * Verify the user has active HIE data access consent.
   * @throws {ConsentDeniedError} if consent is not active
   */
  private async requireConsent(userId: string): Promise<void> {
    const hasConsent = await consentService.hasActiveConsent(
      userId,
      HIE_CONSENT_TYPE_ID,
    )
    if (!hasConsent) {
      throw new ConsentDeniedError(userId, HIE_CONSENT_TYPE_ID)
    }
  }

  private async auditSuccess(
    action: Parameters<EHRAuditService['logIntegration']>[0],
    userId: string,
    input: Omit<IntegrationAuditInput, 'userId' | 'status'>,
  ): Promise<void> {
    await this.auditService.logIntegration(action, {
      ...input,
      userId,
      status: 'success',
    })
  }

  private async auditError(
    action: Parameters<EHRAuditService['logIntegration']>[0],
    userId: string,
    error: unknown,
    input: Omit<IntegrationAuditInput, 'userId' | 'status'>,
  ): Promise<void> {
    await this.auditService.logIntegration(action, {
      ...input,
      userId,
      status: 'failure',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }
}
