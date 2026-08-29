import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirInstantSchema,
  fhirDateTimeSchema,
  fhirUriSchema,
  fhirBackboneElementSchema,
  fhirCodingSchema,
} from './base.js'

/**
 * FHIR R4 Provenance Agent schema.
 * Represents an actor (person, device, organization) involved in generating or verifying the resource.
 * @see http://hl7.org/fhir/R4/provenance-definitions.html#Provenance.agent
 */
export const provenanceAgentSchema = z.object({
  ...fhirBackboneElementSchema.shape,
  type: fhirCodeableConceptSchema.optional(),
  role: z.array(fhirCodeableConceptSchema).optional(),
  who: fhirReferenceSchema,
  onBehalfOf: fhirReferenceSchema.optional(),
})

export type ProvenanceAgent = z.infer<typeof provenanceAgentSchema>

/**
 * FHIR R4 Provenance Entity schema.
 * Represents an entity (e.g. source document, previous version) used in producing the resource.
 * @see http://hl7.org/fhir/R4/provenance-definitions.html#Provenance.entity
 */
export const provenanceEntitySchema = z.object({
  ...fhirBackboneElementSchema.shape,
  role: z.enum(['derivation', 'revision', 'quotation', 'source', 'removal']),
  what: fhirReferenceSchema,
  agent: z.array(provenanceAgentSchema).optional(),
})

export type ProvenanceEntity = z.infer<typeof provenanceEntitySchema>

/**
 * FHIR R4 Provenance Signature schema.
 * Represents digital or cryptographic signatures affixed to the resource or event.
 * @see http://hl7.org/fhir/R4/provenance-definitions.html#Provenance.signature
 */
export const provenanceSignatureSchema = z.object({
  type: z.array(fhirCodingSchema),
  when: fhirInstantSchema,
  who: fhirReferenceSchema,
  onBehalfOf: fhirReferenceSchema.optional(),
  targetFormat: z.string().optional(),
  sigFormat: z.string().optional(),
  data: z.string().optional(),
})

export type ProvenanceSignature = z.infer<typeof provenanceSignatureSchema>

/**
 * FHIR R4 Provenance Resource Schema.
 * Tracks the lifecycle, creation, derivation, and co-signing / verification of clinical resources.
 * @see http://hl7.org/fhir/R4/provenance.html
 */
export const provenanceSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Provenance'),
  id: z.string().optional(),
  identifier: z.array(fhirIdentifierSchema).optional(),
  target: z.array(fhirReferenceSchema).min(1),
  occurredPeriod: fhirPeriodSchema.optional(),
  occurredDateTime: fhirDateTimeSchema.optional(),
  recorded: fhirInstantSchema,
  policy: z.array(fhirUriSchema).optional(),
  location: fhirReferenceSchema.optional(),
  reason: z.array(fhirCodeableConceptSchema).optional(),
  activity: fhirCodeableConceptSchema.optional(),
  agent: z.array(provenanceAgentSchema).min(1),
  entity: z.array(provenanceEntitySchema).optional(),
  signature: z.array(provenanceSignatureSchema).optional(),
})

export type Provenance = z.infer<typeof provenanceSchema>
