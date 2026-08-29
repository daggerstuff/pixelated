/**
 * FHIR R4 Native Type System — Barrel Export
 *
 * Re-exports all Zod schemas and inferred TypeScript types for FHIR R4 resources.
 *
 * @see http://hl7.org/fhir/R4/
 */

// ---------------------------------------------------------------------------
// Base Infrastructure
// ---------------------------------------------------------------------------

export * from './base.js'

// ---------------------------------------------------------------------------
// Clinical Resources
// ---------------------------------------------------------------------------

export * from './clinical.js'

// ---------------------------------------------------------------------------
// Scheduling Resources
// ---------------------------------------------------------------------------

export * from './scheduling.js'

// ---------------------------------------------------------------------------
// Billing Resources
// ---------------------------------------------------------------------------

export * from './billing.js'

// ---------------------------------------------------------------------------
// Communication & Document Reference Resources
// ---------------------------------------------------------------------------

export * from './communication.js'

// ---------------------------------------------------------------------------
// Individual Resource Schemas (not covered by aggregate files)
// ---------------------------------------------------------------------------

export * from './care-plan.js'
export * from './consent.js'
export * from './provenance.js'
export * from './questionnaire.js'
export * from './service-request.js'
export * from './telehealth.js'

// ---------------------------------------------------------------------------
// EHR Resource Discriminated Union + Helpers
// ---------------------------------------------------------------------------

import { z } from 'zod'

import { claimSchema } from './billing.js'
import { carePlanSchema } from './care-plan.js'
import {
  patientSchema,
  practitionerSchema,
  practitionerRoleSchema,
  encounterSchema,
  observationSchema,
  conditionSchema,
  allergyIntoleranceSchema,
  medicationRequestSchema,
} from './clinical.js'
import { documentReferenceSchema } from './communication.js'
import { consentSchema } from './consent.js'
import { provenanceSchema } from './provenance.js'
import {
  questionnaireSchema,
  questionnaireResponseSchema,
} from './questionnaire.js'
import { appointmentSchema } from './scheduling.js'
import { serviceRequestSchema } from './service-request.js'

export const ehrResourceSchema = z.discriminatedUnion('resourceType', [
  patientSchema,
  practitionerSchema,
  practitionerRoleSchema,
  encounterSchema,
  observationSchema,
  conditionSchema,
  allergyIntoleranceSchema,
  medicationRequestSchema,
  appointmentSchema,
  claimSchema,
  documentReferenceSchema,
  consentSchema,
  provenanceSchema,
  serviceRequestSchema,
  questionnaireSchema,
  questionnaireResponseSchema,
  carePlanSchema,
])

export type EHRResource = z.infer<typeof ehrResourceSchema>

export function validateEHRResource(data: unknown): EHRResource {
  return ehrResourceSchema.parse(data)
}

export function safeValidateEHRResource(data: unknown) {
  return ehrResourceSchema.safeParse(data)
}
