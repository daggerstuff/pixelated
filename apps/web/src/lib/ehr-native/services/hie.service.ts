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
  sanitizeDocumentQuery,
  sanitizeBoundedText,
  sanitizeDirectAddress,
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
    readonly patientId?: string,
  ) {
    super(
      `Consent denied for user ${userId}${
        patientId ? ` (patient ${patientId})` : ''
      } (consent type: ${consentTypeId})`,
    )
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
    // Discovery targets a not-yet-known patient, so only the user-level
    // consent gate applies here.
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

    await this.auditResultOutcome(
      action,
      userId,
      result,
      { integrationSource: 'hie' },
      { found: result.found, patientId: result.patientId },
    )

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
    await this.requireConsent(userId, request.patientId)

    const action = EHRAuditAction.HIE_DOCUMENT_QUERY
    let result: DocumentQueryResult

    try {
      result = await this.hieService.queryDocuments(
        sanitizeDocumentQuery(request),
      )
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
        patientId: request.patientId,
      })
      throw error
    }

    await this.auditResultOutcome(
      action,
      userId,
      result,
      { integrationSource: 'hie', patientId: request.patientId },
      { total: result.total, hasMore: result.hasMore },
    )

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
    await this.requireConsent(userId, request.patientId)

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

    await this.auditResultOutcome(
      action,
      userId,
      result,
      { integrationSource: 'hie', patientId: request.patientId },
      {
        retrieved: result.retrieved,
        contentType: result.contentType,
      },
    )

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
    await this.requireConsent(userId, request.patientId)

    const action = EHRAuditAction.HIE_DOCUMENT_SUBMIT
    let result: DocumentSubmissionResult

    // Validate recipient Direct address at the orchestration trust boundary
    // before it reaches the HIE service / adapter layer.
    const validated: DocumentSubmissionRequest = {
      ...request,
      patientId: requireHieId(request.patientId, 'patientId'),
      authorOrganizationId: requireHieId(
        request.authorOrganizationId,
        'authorOrganizationId',
      ),
      recipientDirectAddress: sanitizeDirectAddress(
        request.recipientDirectAddress,
        'recipientDirectAddress',
      ),
    }

    try {
      result = await this.hieService.submitDocument(validated)
    } catch (error) {
      await this.auditError(action, userId, error, {
        integrationSource: 'hie',
        patientId: request.patientId,
      })
      throw error
    }

    await this.auditResultOutcome(
      action,
      userId,
      result,
      { integrationSource: 'hie', patientId: request.patientId },
      {
        submitted: result.submitted,
        documentId: result.documentId ?? null,
      },
    )

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

    await this.auditResultOutcome(
      action,
      userId,
      result,
      { integrationSource: 'hie' },
      { total: result.total },
    )

    return result
  }

  // ─── Private helpers ───────────────────────────────────────────

  /**
   * Verify the user has active HIE data access consent before touching
   * patient data.
   *
   * Scoping note: `consentService.hasActiveConsent` is user-scoped — the
   * consenting party is the user themselves granting access to their own
   * records, so `HIE_CONSENT_TYPE_ID` is deliberately user-wide rather
   * than per-patient. The `patientId` argument is still required so every
   * patient-data call site passes the patient explicitly, keeping the
   * consent boundary visible (and ready for patient-scoped consent if the
   * store gains it).
   *
   * @throws {ConsentDeniedError} if consent is not active
   */
  private async requireConsent(
    userId: string,
    patientId?: string,
  ): Promise<void> {
    const hasConsent = await consentService.hasActiveConsent(
      userId,
      HIE_CONSENT_TYPE_ID,
    )
    if (!hasConsent) {
      throw new ConsentDeniedError(userId, HIE_CONSENT_TYPE_ID, patientId)
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

  /**
   * Audit a completed adapter call based on its result object, not just
   * whether it threw. Adapters signal remote failures either by throwing
   * or by returning a result carrying an `error` message or an
   * unsuccessful flag (`found: false` on error, `retrieved: false`,
   * `submitted: false`). Both paths must land as audit failures so
   * failed HIE operations are never logged as successes.
   */
  private async auditResultOutcome(
    action: Parameters<EHRAuditService['logIntegration']>[0],
    userId: string,
    result: { error?: string },
    input: Omit<IntegrationAuditInput, 'userId' | 'status'>,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (result.error !== undefined) {
      await this.auditError(action, userId, new Error(result.error), input)
      return
    }
    await this.auditSuccess(action, userId, { ...input, metadata })
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
