/**
 * EHR Native — HIE Adapter Interface
 *
 * Defines the contract for Health Information Exchange adapters.
 * Implementations connect to real HIE networks (Carequality, DirectTrust,
 * eHealthExchange) or provide in-memory stubs for development.
 *
 * @see docs/adr/ADR-005-security-rbac.md
 */

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
  HIENetwork,
} from './types'

/**
 * Adapter interface for HIE operations.
 * All methods are async since real HIE networks require network calls.
 */
export interface HIEAdapter {
  /** The HIE network this adapter connects to */
  readonly network: HIENetwork

  /**
   * Discover a patient across the HIE network using demographic data.
   * Returns match info including which organizations hold records.
   */
  discoverPatient(
    request: PatientDiscoveryRequest,
  ): Promise<PatientDiscoveryResult>

  /**
   * Query documents available for a patient from other organizations.
   * Returns document references without content (use retrieveDocument for content).
   */
  queryDocuments(
    request: DocumentQueryRequest,
  ): Promise<DocumentQueryResult>

  /**
   * Retrieve the full content of a specific document.
   * Content is returned as base64-encoded string.
   */
  retrieveDocument(
    request: DocumentRetrievalRequest,
  ): Promise<DocumentRetrievalResult>

  /**
   * Submit a document to the HIE network, making it available to
   * other participating organizations.
   */
  submitDocument(
    request: DocumentSubmissionRequest,
  ): Promise<DocumentSubmissionResult>

  /**
   * Query the organization directory for participating providers
   * and institutions on the HIE network.
   */
  queryOrganizationDirectory(
    request: OrganizationDirectoryRequest,
  ): Promise<OrganizationDirectoryResult>
}
