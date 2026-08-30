/**
 * EHR Native — HIE Integration Types
 *
 * Types for Health Information Exchange operations including patient
 * discovery, document query/retrieval, and document submission across
 * HIE networks (Carequality, DirectTrust, eHealthExchange).
 *
 * @see docs/adr/ADR-005-security-rbac.md
 */

import type { DocumentReference } from '@/lib/ehr-native/types'

/** HIE network identifiers */
export type HIENetwork =
  'carequality' | 'directtrust' | 'ehealthexchange' | 'local'

/** Document type codes (LOINC) for common clinical documents */
export type HIEDocumentType =
  | 'summary-of-care-ccd'
  | 'discharge-summary'
  | 'progress-note'
  | 'history-and-physical'
  | 'operative-note'
  | 'pathology-report'
  | 'imaging-report'
  | 'lab-results'
  | 'medication-list'
  | 'allergy-list'
  | 'immunization-record'
  | 'care-plan'
  | 'referral-note'
  | 'consent-document'

/** Patient demographics for HIE discovery */
export interface PatientDiscoveryRequest {
  /** Patient's legal given (first) name */
  givenName: string
  /** Patient's legal family (last) name */
  familyName: string
  /** ISO 8601 date of birth (YYYY-MM-DD) */
  dateOfBirth: string
  /** Two-letter gender code (male, female, other, unknown) */
  gender?: string
  /** Optional address components for disambiguation */
  address?: {
    state?: string
    postalCode?: string
    city?: string
  }
  /** Optional MRN or other identifier */
  identifier?: string
}

/** Result of a patient discovery query */
export interface PatientDiscoveryResult {
  /** Whether the patient was found on the HIE network */
  found: boolean
  /** HIE-assigned patient identifier, if found */
  patientId?: string
  /** Confidence score 0-1 (demographic match quality) */
  confidence?: number
  /** Matched demographics summary */
  matchedDemographics?: {
    givenName: string
    familyName: string
    dateOfBirth: string
    gender?: string
    address?: string
  }
  /** Participating organizations that have records for this patient */
  organizations?: HIEOrganization[]
  /** Discovery error message if found=false due to error */
  error?: string
}

/** A participating HIE organization */
export interface HIEOrganization {
  /** Organization identifier on the HIE network */
  id: string
  /** Organization display name */
  name: string
  /** NPI or OID identifier */
  npi?: string
  /** Organization type (hospital, clinic, pharmacy, lab) */
  type?: string
  /** Contact endpoint (Direct address or URL) */
  endpoint?: string
}

/** Request to query documents for a patient */
export interface DocumentQueryRequest {
  /** HIE patient identifier from discovery */
  patientId: string
  /** Filter by document type */
  documentType?: HIEDocumentType
  /** Filter by authoring organization */
  authorOrganizationId?: string
  /** ISO 8601 start timestamp */
  fromDate?: string
  /** ISO 8601 end timestamp */
  toDate?: string
  /** Maximum number of results (default 50) */
  limit?: number
  /** Offset for pagination (default 0) */
  offset?: number
}

/** A document reference from HIE query results */
export interface HIEDocumentReference {
  /** HIE-assigned document identifier */
  documentId: string
  /** Document type code */
  documentType: HIEDocumentType
  /** Document title */
  title: string
  /** ISO 8601 creation timestamp */
  created: string
  /** Authoring organization */
  authorOrganization: HIEOrganization
  /** Authoring practitioner name */
  authorPractitioner?: string
  /** Document status */
  status: 'current' | 'superseded' | 'entered-in-error'
  /** MIME content type of the document */
  contentType: string
  /** Document size in bytes, if known */
  size?: number
  /** Hash of the document content, if known */
  hash?: string
  /** Document language code (e.g., 'en') */
  language?: string
  /** Whether the document is on-demand (requires retrieval) */
  onDemand?: boolean
}

/** Result of a document query */
export interface DocumentQueryResult {
  /** Matching document references */
  documents: HIEDocumentReference[]
  /** Total number of matching documents (may exceed returned count) */
  total: number
  /** Whether more results are available */
  hasMore: boolean
  /** Query error if the query failed */
  error?: string
}

/** Request to retrieve a specific document */
export interface DocumentRetrievalRequest {
  /** HIE document identifier */
  documentId: string
  /** HIE patient identifier */
  patientId: string
}

/** Result of a document retrieval */
export interface DocumentRetrievalResult {
  /** Whether retrieval succeeded */
  retrieved: boolean
  /** Document content as base64-encoded string */
  content?: string
  /** MIME content type */
  contentType: string
  /** Document character set (e.g., 'utf-8') */
  charset?: string
  /** Retrieved document reference metadata */
  document: HIEDocumentReference
  /** Retrieval error message */
  error?: string
}

/** Request to submit a document to the HIE */
export interface DocumentSubmissionRequest {
  /** HIE patient identifier */
  patientId: string
  /** Document type */
  documentType: HIEDocumentType
  /** Document title */
  title: string
  /** Document content as base64-encoded string */
  content: string
  /** MIME content type (e.g., 'application/xml', 'application/pdf') */
  contentType: string
  /** Authoring organization identifier */
  authorOrganizationId: string
  /** Authoring practitioner identifier */
  authorPractitionerId?: string
  /** ISO 8601 creation timestamp (defaults to now) */
  created?: string
  /** Document language code (default 'en') */
  language?: string
}

/** Result of a document submission */
export interface DocumentSubmissionResult {
  /** Whether submission succeeded */
  submitted: boolean
  /** HIE-assigned document identifier */
  documentId?: string
  /** Submission timestamp */
  timestamp: string
  /** Submission error message */
  error?: string
}

/** Request to query the organization directory */
export interface OrganizationDirectoryRequest {
  /** Filter by organization type */
  type?: string
  /** Filter by state */
  state?: string
  /** Filter by name (partial match) */
  name?: string
  /** Maximum results (default 50) */
  limit?: number
}

/** Result of an organization directory query */
export interface OrganizationDirectoryResult {
  /** Matching organizations */
  organizations: HIEOrganization[]
  /** Total count */
  total: number
  /** Query error */
  error?: string
}
