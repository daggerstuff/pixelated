/**
 * EHR REST API v1 — Type definitions.
 *
 * Types for the higher-level EHR REST API surface that wraps the FHIR R4
 * internal server with RBAC enforcement and audit logging.
 */

import type { ClinicalRole, EHRPermission } from '../auth/types.js'
import type { FHIRResourceType } from '../fhir/types.js'

/** Context extracted from incoming HTTP request headers. */
export interface APIRequestContext {
  userId: string
  role: ClinicalRole
  tenantId: string
  patientId?: string
  breakGlass: boolean
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/** Standard API response envelope. */
export interface APIResponse<T = unknown> {
  status: number
  headers: Record<string, string>
  body: T
}

/** The seven EHR REST API endpoint groups. */
export type EndpointGroup =
  | 'patients'
  | 'encounters'
  | 'appointments'
  | 'notes'
  | 'claims'
  | 'consents'
  | 'observations'

/** Definition of a single REST API endpoint. */
export interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  resourceType: FHIRResourceType
  permission: EHRPermission
  description: string
  operation: 'create' | 'read' | 'update' | 'delete' | 'search'
}
