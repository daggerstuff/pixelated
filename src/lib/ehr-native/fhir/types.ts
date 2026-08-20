/**
 * FHIR R4 server types.
 *
 * Core type definitions for the FHIR R4 internal server, including request
 * context, resource type registry, and response helpers.
 */

import type { z } from 'zod';

/** Supported FHIR R4 resource types. */
export type FHIRResourceType =
  | 'Patient'
  | 'Practitioner'
  | 'Encounter'
  | 'Observation'
  | 'Condition'
  | 'AllergyIntolerance'
  | 'MedicationRequest'
  | 'Medication'
  | 'Immunization'
  | 'Procedure'
  | 'DiagnosticReport'
  | 'Appointment'
  | 'Schedule'
  | 'Slot'
  | 'Claim'
  | 'ClaimResponse'
  | 'Coverage'
  | 'ExplanationOfBenefit'
  | 'DocumentReference'
  | 'Communication'
  | 'CommunicationRequest'
  | 'Consent'
  | 'ServiceRequest';

/** All 23 supported resource types. */
export const SUPPORTED_RESOURCE_TYPES: readonly FHIRResourceType[] = [
  'Patient',
  'Practitioner',
  'Encounter',
  'Observation',
  'Condition',
  'AllergyIntolerance',
  'MedicationRequest',
  'Medication',
  'Immunization',
  'Procedure',
  'DiagnosticReport',
  'Appointment',
  'Schedule',
  'Slot',
  'Claim',
  'ClaimResponse',
  'Coverage',
  'ExplanationOfBenefit',
  'DocumentReference',
  'Communication',
  'CommunicationRequest',
  'Consent',
  'ServiceRequest',
] as const;

/** Resource types with dedicated database tables (migration 015). */
export const DEDICATED_TABLE_RESOURCES: readonly FHIRResourceType[] = [
  'Patient',
  'Practitioner',
  'Encounter',
  'Observation',
  'Appointment',
  'DocumentReference',
  'Claim',
  'Consent',
  'ServiceRequest',
] as const;

/** Map of FHIR resource type → database table name. */
export const RESOURCE_TABLE_MAP: Record<FHIRResourceType, string> = {
  Patient: 'ehr_patient',
  Practitioner: 'ehr_practitioner',
  Encounter: 'ehr_encounter',
  Observation: 'ehr_observation',
  Appointment: 'ehr_appointment',
  DocumentReference: 'ehr_document_reference',
  Claim: 'ehr_claim',
  Consent: 'ehr_consent',
  ServiceRequest: 'ehr_service_request',
  Condition: 'ehr_resource',
  AllergyIntolerance: 'ehr_resource',
  MedicationRequest: 'ehr_resource',
  Medication: 'ehr_resource',
  Immunization: 'ehr_resource',
  Procedure: 'ehr_resource',
  DiagnosticReport: 'ehr_resource',
  Schedule: 'ehr_resource',
  Slot: 'ehr_resource',
  ClaimResponse: 'ehr_resource',
  Coverage: 'ehr_resource',
  ExplanationOfBenefit: 'ehr_resource',
  Communication: 'ehr_resource',
  CommunicationRequest: 'ehr_resource',
};

/** Map of FHIR resource type → primary key column name in the DB table. */
export const RESOURCE_PK_MAP: Record<FHIRResourceType, string> = {
  Patient: 'patient_id',
  Practitioner: 'practitioner_id',
  Encounter: 'encounter_id',
  Observation: 'observation_id',
  Appointment: 'appointment_id',
  DocumentReference: 'document_id',
  Claim: 'claim_id',
  Consent: 'consent_id',
  ServiceRequest: 'service_request_id',
  Condition: 'resource_id',
  AllergyIntolerance: 'resource_id',
  MedicationRequest: 'resource_id',
  Medication: 'resource_id',
  Immunization: 'resource_id',
  Procedure: 'resource_id',
  DiagnosticReport: 'resource_id',
  Schedule: 'resource_id',
  Slot: 'resource_id',
  ClaimResponse: 'resource_id',
  Coverage: 'resource_id',
  ExplanationOfBenefit: 'resource_id',
  Communication: 'resource_id',
  CommunicationRequest: 'resource_id',
};

/** Request context extracted from the incoming HTTP request. */
export interface FHIRRequestContext {
  /** Tenant ID from JWT or session. */
  tenantId: string;
  /** User ID from JWT. */
  userId: string;
  /** Clinical role from JWT. */
  role: string;
  /** Whether break-glass access is activated. */
  breakGlass: boolean;
  /** Raw JWT claims. */
  jwtClaims: Record<string, unknown>;
}

/** Parsed FHIR request. */
export interface FHIRRequest {
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Resource type (e.g. "Patient"). */
  resourceType: FHIRResourceType | null;
  /** Resource ID (for instance-level operations). */
  resourceId: string | null;
  /** Whether this is a _history request. */
  isHistory: boolean;
  /** Whether this is a metadata (CapabilityStatement) request. */
  isMetadata: boolean;
  /** Search/query parameters from the URL. */
  searchParams: URLSearchParams;
  /** Request body (for POST/PUT). */
  body: unknown;
  /** If-Match header value (for optimistic concurrency). */
  ifMatch: string | null;
  /** Request context (tenant, user, role). */
  context: FHIRRequestContext;
}

/** FHIR R4 OperationOutcome issue severity. */
export type IssueSeverity = 'fatal' | 'error' | 'warning' | 'information';

/** FHIR R4 OperationOutcome issue code. */
export type IssueCode =
  | 'invalid'
  | 'structure'
  | 'required'
  | 'value'
  | 'invariant'
  | 'security'
  | 'login'
  | 'unknown'
  | 'expired'
  | 'forbidden'
  | 'suppressed'
  | 'processing'
  | 'not-supported'
  | 'duplicate'
  | 'multiple-matches'
  | 'not-found'
  | 'delete'
  | 'too-long'
  | 'code-invalid'
  | 'extension'
  | 'too-costly'
  | 'business-rule'
  | 'conflict'
  | 'transient'
  | 'lock-error'
  | 'no-store'
  | 'exception'
  | 'timeout'
  | 'incomplete'
  | 'throttled'
  | 'informational';

/** FHIR R4 OperationOutcome. */
export interface OperationOutcome {
  resourceType: 'OperationOutcome';
  id?: string;
  issue: Array<{
    severity: IssueSeverity;
    code: IssueCode;
    diagnostics?: string;
    details?: { text: string };
    expression?: string[];
  }>;
}

/** FHIR R4 Bundle. */
export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'searchset' | 'history' | 'batch-response' | 'transaction-response';
  total?: number;
  entry: Array<{
    fullUrl?: string;
    resource?: Record<string, unknown>;
    request?: { method: string; url: string };
    response?: { status: string; etag?: string; lastModified?: string };
  }>;
  link?: Array<{ relation: string; url: string }>;
}

/** Resource registry entry: maps resource type to its zod schema and table. */
export interface ResourceRegistryEntry {
  resourceType: FHIRResourceType;
  schema: z.ZodType<Record<string, unknown>>;
  table: string;
  pkColumn: string;
  isGeneric: boolean;
}

/** Result of a FHIR operation. */
export interface FHIRResponse {
  status: number;
  headers: Record<string, string>;
  body: OperationOutcome | FHIRBundle | Record<string, unknown>;
}
