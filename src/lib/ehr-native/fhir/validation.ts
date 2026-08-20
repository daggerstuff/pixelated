/**
 * FHIR R4 validation pipeline.
 *
 * Maps each supported resource type to its zod schema from F1.0 types,
 * validates incoming resources, and provides the validation result.
 *
 * @see https://hl7.org/fhir/R4/validation.html
 */

import { z } from 'zod'

import {
  claimSchema,
  claimResponseSchema,
  coverageSchema,
  explanationOfBenefitSchema,
} from '../types/billing.js'
import {
  documentReferenceSchema,
  communicationSchema,
  communicationRequestSchema,
} from '../types/communication.js'
// F1.0 FHIR R4 zod schemas
import {
  fhirBaseSchema,
  patientSchema,
  practitionerSchema,
  encounterSchema,
  observationSchema,
  conditionSchema,
  allergyIntoleranceSchema,
  medicationSchema,
  medicationRequestSchema,
  immunizationSchema,
  procedureSchema,
  diagnosticReportSchema,
} from '../types/index.js'
import {
  appointmentSchema,
  scheduleSchema,
  slotSchema,
} from '../types/scheduling.js'
import type { FHIRResourceType, ResourceRegistryEntry } from './types.js'
import {
  SUPPORTED_RESOURCE_TYPES,
  RESOURCE_TABLE_MAP,
  RESOURCE_PK_MAP,
  DEDICATED_TABLE_RESOURCES,
} from './types.js'

/** Zod schema registry for each FHIR resource type. */
export const SCHEMA_REGISTRY: Record<
  FHIRResourceType,
  z.ZodType<Record<string, unknown>>
> = {
  Patient: patientSchema as z.ZodType<Record<string, unknown>>,
  Practitioner: practitionerSchema as z.ZodType<Record<string, unknown>>,
  Encounter: encounterSchema as z.ZodType<Record<string, unknown>>,
  Observation: observationSchema as z.ZodType<Record<string, unknown>>,
  Condition: conditionSchema as z.ZodType<Record<string, unknown>>,
  AllergyIntolerance: allergyIntoleranceSchema as z.ZodType<
    Record<string, unknown>
  >,
  MedicationRequest: medicationRequestSchema as z.ZodType<
    Record<string, unknown>
  >,
  Medication: medicationSchema as z.ZodType<Record<string, unknown>>,
  Immunization: immunizationSchema as z.ZodType<Record<string, unknown>>,
  Procedure: procedureSchema as z.ZodType<Record<string, unknown>>,
  DiagnosticReport: diagnosticReportSchema as z.ZodType<
    Record<string, unknown>
  >,
  Appointment: appointmentSchema as z.ZodType<Record<string, unknown>>,
  Schedule: scheduleSchema as z.ZodType<Record<string, unknown>>,
  Slot: slotSchema as z.ZodType<Record<string, unknown>>,
  Claim: claimSchema as z.ZodType<Record<string, unknown>>,
  ClaimResponse: claimResponseSchema as z.ZodType<Record<string, unknown>>,
  Coverage: coverageSchema as z.ZodType<Record<string, unknown>>,
  ExplanationOfBenefit: explanationOfBenefitSchema as z.ZodType<
    Record<string, unknown>
  >,
  DocumentReference: documentReferenceSchema as z.ZodType<
    Record<string, unknown>
  >,
  Communication: communicationSchema as z.ZodType<Record<string, unknown>>,
  CommunicationRequest: communicationRequestSchema as z.ZodType<
    Record<string, unknown>
  >,
  // F1.0 does not define consentSchema or serviceRequestSchema — use base schema
  Consent: fhirBaseSchema as z.ZodType<Record<string, unknown>>,
  ServiceRequest: fhirBaseSchema as z.ZodType<Record<string, unknown>>,
}

/** Full resource registry with table and PK info. */
export const RESOURCE_REGISTRY: Record<
  FHIRResourceType,
  ResourceRegistryEntry
> = (() => {
  const entries = {} as Record<FHIRResourceType, ResourceRegistryEntry>
  for (const rt of SUPPORTED_RESOURCE_TYPES) {
    entries[rt] = {
      resourceType: rt,
      schema: SCHEMA_REGISTRY[rt],
      table: RESOURCE_TABLE_MAP[rt],
      pkColumn: RESOURCE_PK_MAP[rt],
      isGeneric: !DEDICATED_TABLE_RESOURCES.includes(rt),
    }
  }
  return entries
})()

/** Result of validating a resource. */
export interface ValidationResult {
  success: boolean
  data?: Record<string, unknown>
  error?: {
    message: string
    issues: Array<{ path: string; message: string }>
  }
}

/** Validate a resource body against the zod schema for the given resource type. */
export function validateResource(
  resourceType: FHIRResourceType,
  body: unknown,
): ValidationResult {
  const schema = SCHEMA_REGISTRY[resourceType]

  const result = schema.safeParse(body)
  if (result.success) {
    return {
      success: true,
      data: result.data as Record<string, unknown>,
    }
  }

  // Collect zod issues into a structured error
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))

  return {
    success: false,
    error: {
      message: `Validation failed for ${resourceType}: ${issues.length} issue(s)`,
      issues,
    },
  }
}

/** Validate that the resourceType in the body matches the expected type. */
export function validateResourceType(
  expectedType: FHIRResourceType,
  body: unknown,
): { valid: boolean; error?: string } {
  if (body === null || body === undefined || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' }
  }

  const bodyRecord = body as Record<string, unknown>
  const bodyResourceType = bodyRecord['resourceType']

  if (bodyResourceType !== expectedType) {
    return {
      valid: false,
      error: `resourceType must be "${expectedType}" but was "${String(bodyResourceType)}".`,
    }
  }

  return { valid: true }
}

/** Check if a resource type is supported. */
export function isSupportedResourceType(rt: string): rt is FHIRResourceType {
  return SUPPORTED_RESOURCE_TYPES.includes(rt as FHIRResourceType)
}

/** Get the registry entry for a resource type. */
export function getRegistryEntry(
  resourceType: FHIRResourceType,
): ResourceRegistryEntry {
  return RESOURCE_REGISTRY[resourceType]
}
