/**
 * EHR Native — HIE Integration barrel export
 */

export type { HIEAdapter } from './adapter'
export { StubHIEAdapter, stubHIEAdapter } from './stub-adapter'
export { HIEService } from './hie-service'
export type {
  HIENetwork,
  HIEDocumentType,
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
  HIEDocumentReference,
  HIEOrganization,
} from './types'
