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
    return this.adapter.discoverPatient(request)
  }

  /**
   * Query documents available for a patient from other organizations.
   * Returns document references; use retrieveDocument for content.
   */
  async queryDocuments(
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult> {
    return this.adapter.queryDocuments(request)
  }

  /**
   * Retrieve the full content of a specific document.
   * Content is returned as base64-encoded string.
   */
  async retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult> {
    return this.adapter.retrieveDocument(request)
  }

  /**
   * Submit a document to the HIE network, making it available to
   * other participating organizations.
   */
  async submitDocument(
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult> {
    return this.adapter.submitDocument(request)
  }

  /**
   * Query the organization directory for participating providers
   * and institutions on the HIE network.
   */
  async queryOrganizationDirectory(
    request: OrganizationDirectoryRequest,
  ): Promise<OrganizationDirectoryResult> {
    return this.adapter.queryOrganizationDirectory(request)
  }
}
