/**
 * EHR Native — HIE Service
 *
 * Service layer wrapping the HIE adapter for document exchange operations.
 * Provides patient discovery, document query/retrieval, submission, and
 * organization directory lookup.
 *
 * @see docs/adr/ADR-005-security-rbac.md
 */

import type { HIEAdapter } from './adapter'
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
} from './types'

// ---------------------------------------------------------------------------
// Input sanitization
//
// All inbound request fields are validated here before they reach any
// adapter implementation, so FHIR search/lookup paths never receive
// unsanitized identifiers, timestamps, or unbounded text.
// ---------------------------------------------------------------------------

/** HIE identifier token: alphanumeric start, internal . _ : - separators. */
const HIE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** ISO 8601 date or timestamp (date-only through offset-qualified form). */
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/

/** Free-text field cap bounding input size before it reaches the adapter. */
const MAX_TEXT_LENGTH = 200

/**
 * Direct address per RFC 5598: local@domain with a public suffix domain.
 * Local part limited to unreserved characters; domain requires at least
 * one dot to prevent bare-host placeholders like `@localhost`.
 */
const DIRECT_ADDRESS_PATTERN =
  /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

export function requireHieId(value: string, field: string): string {
  const trimmed = value.trim()
  if (!HIE_ID_PATTERN.test(trimmed)) {
    throw new Error(`Invalid ${field}: expected an HIE identifier token`)
  }
  return trimmed
}

export function sanitizeDirectAddress(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim().toLowerCase()
  if (
    trimmed.length > MAX_TEXT_LENGTH ||
    !DIRECT_ADDRESS_PATTERN.test(trimmed)
  ) {
    throw new Error(
      `Invalid ${field}: expected a Direct address (local@domain)`,
    )
  }
  return trimmed
}

function optionalHieId(
  value: string | undefined,
  field: string,
): string | undefined {
  return value === undefined ? undefined : requireHieId(value, field)
}

export function sanitizeIsoDate(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) {
    throw new Error(`Invalid ${field}: expected an ISO 8601 date or timestamp`)
  }
  return trimmed
}

export function sanitizeBoundedText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined
  return value.trim().slice(0, MAX_TEXT_LENGTH)
}

export function clampLimit(limit: number | undefined): number | undefined {
  if (limit === undefined || !Number.isFinite(limit)) return undefined
  return Math.min(Math.max(Math.trunc(limit), 1), 1000)
}

export function clampOffset(offset: number | undefined): number | undefined {
  if (offset === undefined || !Number.isFinite(offset)) return undefined
  return Math.max(Math.trunc(offset), 0)
}

export function sanitizeDocumentQuery(
  request: DocumentQueryRequest,
): DocumentQueryRequest {
  return {
    ...request,
    patientId: requireHieId(request.patientId, 'patientId'),
    authorOrganizationId: optionalHieId(
      request.authorOrganizationId,
      'authorOrganizationId',
    ),
    fromDate: sanitizeIsoDate(request.fromDate, 'fromDate'),
    toDate: sanitizeIsoDate(request.toDate, 'toDate'),
    limit: clampLimit(request.limit),
    offset: clampOffset(request.offset),
  }
}

/**
 * HIE service for health information exchange operations.
 * Wraps an HIE adapter and provides the application-facing API for
 * cross-organization document exchange.
 */
export class HIEService {
  constructor(private readonly adapter: HIEAdapter) {}

  /**
   * Discover a patient across the HIE network using demographic data.
   * Returns match info including which organizations hold records for them.
   */
  async discoverPatient(
    request: PatientDiscoveryRequest,
  ): Promise<PatientDiscoveryResult> {
    const sanitizedFamily = sanitizeBoundedText(request.familyName) ?? ''
    if (!sanitizedFamily || sanitizedFamily.trim().length === 0) {
      throw new Error('Invalid familyName: must be a non-empty string')
    }
    const sanitized: PatientDiscoveryRequest = {
      ...request,
      givenName: sanitizeBoundedText(request.givenName) ?? '',
      familyName: sanitizedFamily,
      dateOfBirth: sanitizeIsoDate(request.dateOfBirth, 'dateOfBirth') ?? '',
      gender: (() => {
        if (request.gender === undefined) return undefined
        const g = request.gender.trim().toLowerCase()
        const allowed = new Set([
          'male',
          'female',
          'other',
          'unknown',
          'administrative',
        ])
        if (!allowed.has(g))
          throw new Error(
            `Invalid gender: expected one of male, female, other, unknown, administrative`,
          )
        return g
      })(),
    }
    return this.adapter.discoverPatient(sanitized)
  }

  /**
   * Query documents available for a patient from other organizations.
   * Returns document references; use retrieveDocument for content.
   */
  async queryDocuments(
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult> {
    return this.adapter.queryDocuments(sanitizeDocumentQuery(request))
  }

  /**
   * Retrieve the full content of a specific document.
   * Content is returned as base64-encoded string.
   */
  async retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    const sanitized: DocumentRetrievalRequest = {
      documentId: requireHieId(request.documentId, 'documentId'),
      patientId: requireHieId(request.patientId, 'patientId'),
    }
    return this.adapter.retrieveDocument(sanitized)
  }

  /**
   * Submit a document to the HIE network, making it available to
   * other participating organizations.
   */
  async submitDocument(
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult> {
    const recipientDirectAddress = sanitizeDirectAddress(
      request.recipientDirectAddress,
      'recipientDirectAddress',
    )
    const sanitized: DocumentSubmissionRequest = {
      ...request,
      patientId: requireHieId(request.patientId, 'patientId'),
      title: sanitizeBoundedText(request.title) ?? '',
      authorOrganizationId: requireHieId(
        request.authorOrganizationId,
        'authorOrganizationId',
      ),
      authorPractitionerId: optionalHieId(
        request.authorPractitionerId,
        'authorPractitionerId',
      ),
      recipientDirectAddress,
    }
    return this.adapter.submitDocument(sanitized)
  }

  /**
   * Query the organization directory for participating providers
   * and institutions on the HIE network.
   */
  async queryOrganizationDirectory(
    request: OrganizationDirectoryRequest,
  ): Promise<OrganizationDirectoryResult> {
    const sanitized: OrganizationDirectoryRequest = {
      ...request,
      type: sanitizeBoundedText(request.type),
      state: sanitizeBoundedText(request.state),
      name: sanitizeBoundedText(request.name),
      limit: clampLimit(request.limit),
    }
    return this.adapter.queryOrganizationDirectory(sanitized)
  }
}
