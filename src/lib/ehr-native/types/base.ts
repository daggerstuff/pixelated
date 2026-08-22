/**
 * FHIR R4 Base Infrastructure Types
 *
 * Primitive types, datatypes, and base resource infrastructure
 * per HL7 FHIR R4 specification (http://hl7.org/fhir/R4/).
 *
 * All schemas use Zod v4 syntax. Inferred TypeScript types are exported
 * alongside their schemas.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitive Type Schemas
// ---------------------------------------------------------------------------

/** FHIR string: Unicode string, 1..1, max 1MB */
export const fhirStringSchema = z.string()

/** FHIR code: string with restricted character set (whitespace not allowed) */
export const fhirCodeSchema = z.string().regex(/^[^\s]+$/)

/** FHIR id: string of 1-64 chars, A-Z, a-z, 0-9, -, . */
export const fhirIdSchema = z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/)

/** FHIR boolean */
export const fhirBooleanSchema = z.boolean()

/** FHIR integer: signed 32-bit integer */
export const fhirIntegerSchema = z.number().int()

/** FHIR positiveInt: positive integer (>= 1) */
export const fhirPositiveIntSchema = z.number().int().positive()

/** FHIR decimal: rational number with no integer limit */
export const fhirDecimalSchema = z.number()

/** FHIR uri: absolute or relative URI */
export const fhirUriSchema = z.url()

/** FHIR url: absolute URL */
export const fhirUrlSchema = z.url()

/** FHIR canonical: absolute URL used in references to other resources */
export const fhirCanonicalSchema = z.url()

/** FHIR uuid: UUID string */
export const fhirUuidSchema = z.string().uuid()

/**
 * FHIR date: YYYY, YYYY-MM, or YYYY-MM-DD
 * Per R4: a partial date is allowed
 */
export const fhirDateSchema = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)

/**
 * FHIR dateTime: YYYY, YYYY-MM, YYYY-MM-DD, or full ISO-8601 datetime
 * with optional timezone
 */
export const fhirDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/,
  )

/** FHIR instant: full ISO-8601 datetime with required timezone */
export const fhirInstantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/)

/** FHIR time: HH:MM:SS */
export const fhirTimeSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}(\.\d+)?$/)

// ---------------------------------------------------------------------------
// Inferred Primitive Types
// ---------------------------------------------------------------------------

export type FHIRString = z.infer<typeof fhirStringSchema>
export type FHIRCode = z.infer<typeof fhirCodeSchema>
export type FHIRId = z.infer<typeof fhirIdSchema>
export type FHIRBoolean = z.infer<typeof fhirBooleanSchema>
export type FHIRInteger = z.infer<typeof fhirIntegerSchema>
export type FHIRPositiveInt = z.infer<typeof fhirPositiveIntSchema>
export type FHIRDecimal = z.infer<typeof fhirDecimalSchema>
export type FHIRUri = z.infer<typeof fhirUriSchema>
export type FHIRUrl = z.infer<typeof fhirUrlSchema>
export type FHIRCanonical = z.infer<typeof fhirCanonicalSchema>
export type FHIRUuid = z.infer<typeof fhirUuidSchema>
export type FHIRDate = z.infer<typeof fhirDateSchema>
export type FHIRDateTime = z.infer<typeof fhirDateTimeSchema>
export type FHIRInstant = z.infer<typeof fhirInstantSchema>
export type FHIRTime = z.infer<typeof fhirTimeSchema>

// ---------------------------------------------------------------------------
// FHIRExtension (0..* on most elements)
// ---------------------------------------------------------------------------

/**
 * FHIR Extension: Optional extension element.
 * value[x] is polymorphic — modeled as a union of common FHIR datatypes.
 */
export const fhirExtensionSchema = z.object({
  url: fhirUriSchema,
  /** value[x] polymorphic — discriminated by the key name */
  valueString: fhirStringSchema.optional(),
  valueBoolean: fhirBooleanSchema.optional(),
  valueInteger: fhirIntegerSchema.optional(),
  valueDecimal: fhirDecimalSchema.optional(),
  valueDate: fhirDateSchema.optional(),
  valueDateTime: fhirDateTimeSchema.optional(),
  valueInstant: fhirInstantSchema.optional(),
  valueCode: fhirCodeSchema.optional(),
  valueUri: fhirUriSchema.optional(),
  valueUrl: fhirUrlSchema.optional(),
  valueId: fhirIdSchema.optional(),
})

export type FHIRExtension = z.infer<typeof fhirExtensionSchema>

// ---------------------------------------------------------------------------
// FHIRNarrative (Resource.text 0..1)
// ---------------------------------------------------------------------------

export const fhirNarrativeStatusSchema = z.enum([
  'generated',
  'extensions',
  'additional',
  'empty',
])

export const fhirNarrativeSchema = z.object({
  status: fhirNarrativeStatusSchema,
  /** xhtml-contained div (limited validation: must be non-empty string) */
  div: z.string().min(1),
})

export type FHIRNarrative = z.infer<typeof fhirNarrativeSchema>

// ---------------------------------------------------------------------------
// FHIRCoding
// ---------------------------------------------------------------------------

export const fhirCodingSchema = z.object({
  system: fhirUriSchema.optional(),
  version: fhirStringSchema.optional(),
  code: fhirCodeSchema.optional(),
  display: fhirStringSchema.optional(),
  userSelected: fhirBooleanSchema.optional(),
})

export type FHIRCoding = z.infer<typeof fhirCodingSchema>

// ---------------------------------------------------------------------------
// FHIRCodeableConcept
// ---------------------------------------------------------------------------

export const fhirCodeableConceptSchema = z.object({
  coding: z.array(fhirCodingSchema).optional(),
  text: fhirStringSchema.optional(),
})

export type FHIRCodeableConcept = z.infer<typeof fhirCodeableConceptSchema>

// ---------------------------------------------------------------------------
// FHIRPeriod
// ---------------------------------------------------------------------------

export const fhirPeriodSchema = z.object({
  start: fhirDateTimeSchema.optional(),
  end: fhirDateTimeSchema.optional(),
})

export type FHIRPeriod = z.infer<typeof fhirPeriodSchema>

// ---------------------------------------------------------------------------
// FHIRReference (base — without identifier to break circular dependency)
// ---------------------------------------------------------------------------

/**
 * FHIR Reference: validates that the reference string follows FHIR R4
 * reference formats:
 *   - Relative: ResourceType/id
 *   - Absolute: https?://...
 *   - Internal: #fragment
 *   - UUID: urn:uuid:...
 */
export const fhirReferenceStringSchema = z
  .string()
  .regex(
    /^([A-Z][a-zA-Z0-9]+\/[A-Za-z0-9\-.]{1,64}|https?:\/\/[^\s]+|#[A-Za-z0-9\-.]+|urn:uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
  )

/** Internal base — without identifier field to break the Identifier↔Reference cycle. */
const fhirReferenceBaseSchema = z.object({
  reference: fhirReferenceStringSchema.optional(),
  type: fhirUriSchema.optional(),
  display: fhirStringSchema.optional(),
})

// ---------------------------------------------------------------------------
// FHIRIdentifier
// ---------------------------------------------------------------------------

export const fhirIdentifierUseSchema = z.enum([
  'usual',
  'official',
  'temp',
  'secondary',
  'old',
])

export const fhirIdentifierSchema = z.object({
  use: fhirIdentifierUseSchema.optional(),
  type: fhirCodeableConceptSchema.optional(),
  system: fhirUriSchema.optional(),
  value: fhirStringSchema.optional(),
  period: fhirPeriodSchema.optional(),
  assigner: fhirReferenceBaseSchema.optional(),
})

export type FHIRIdentifier = z.infer<typeof fhirIdentifierSchema>

// ---------------------------------------------------------------------------
// FHIRQuantity
// ---------------------------------------------------------------------------

export const fhirQuantityComparatorSchema = z.enum(['<', '<=', '>=', '>'])

export const fhirQuantitySchema = z.object({
  value: fhirDecimalSchema.optional(),
  comparator: fhirQuantityComparatorSchema.optional(),
  unit: fhirStringSchema.optional(),
  system: fhirUriSchema.optional(),
  code: fhirCodeSchema.optional(),
})

export type FHIRQuantity = z.infer<typeof fhirQuantitySchema>

// ---------------------------------------------------------------------------
// FHIRRange
// ---------------------------------------------------------------------------

export const fhirRangeSchema = z.object({
  low: fhirQuantitySchema.optional(),
  high: fhirQuantitySchema.optional(),
})

export type FHIRRange = z.infer<typeof fhirRangeSchema>

// ---------------------------------------------------------------------------
// FHIRRatio
// ---------------------------------------------------------------------------

export const fhirRatioSchema = z.object({
  numerator: fhirQuantitySchema.optional(),
  denominator: fhirQuantitySchema.optional(),
})

export type FHIRRatio = z.infer<typeof fhirRatioSchema>

// ---------------------------------------------------------------------------
// FHIRMoney
// ---------------------------------------------------------------------------

export const fhirMoneySchema = z.object({
  value: fhirDecimalSchema.optional(),
  currency: fhirCodeSchema.optional(),
})

export type FHIRMoney = z.infer<typeof fhirMoneySchema>

// ---------------------------------------------------------------------------
// FHIRReference (full — extends base with identifier)
// ---------------------------------------------------------------------------

export const fhirReferenceSchema = fhirReferenceBaseSchema.extend({
  identifier: fhirIdentifierSchema.optional(),
})

export type FHIRReference = z.infer<typeof fhirReferenceSchema>

// ---------------------------------------------------------------------------
// FHIRMeta (part of FHIRBase)
// ---------------------------------------------------------------------------

export const fhirMetaSchema = z.object({
  versionId: fhirIdSchema.optional(),
  lastUpdated: fhirInstantSchema.optional(),
  source: fhirUriSchema.optional(),
  profile: z.array(fhirCanonicalSchema).optional(),
  security: z.array(fhirCodingSchema).optional(),
  tag: z.array(fhirCodingSchema).optional(),
})

export type FHIRMeta = z.infer<typeof fhirMetaSchema>

// ---------------------------------------------------------------------------
// FHIRBase — base for all FHIR resources
// ---------------------------------------------------------------------------

/**
 * FHIRBase: the base structure every FHIR resource extends.
 * Per R4: id 0..1, meta 0..1, implicitRules 0..1, language 0..1.
 * resourceType is added by each specific resource schema as a literal.
 */
export const fhirBaseSchema = z.object({
  id: fhirIdSchema.optional(),
  meta: fhirMetaSchema.optional(),
  implicitRules: fhirUriSchema.optional(),
  language: fhirCodeSchema.optional(),
})

export type FHIRBase = z.infer<typeof fhirBaseSchema>

// ---------------------------------------------------------------------------
// FHIRContactPoint (used by Patient, Practitioner, Organization)
// ---------------------------------------------------------------------------

export const fhirContactPointSystemSchema = z.enum([
  'phone',
  'fax',
  'email',
  'pager',
  'url',
  'sms',
  'other',
])

export const fhirContactPointUseSchema = z.enum([
  'home',
  'work',
  'temp',
  'old',
  'mobile',
])

export const fhirContactPointSchema = z.object({
  system: fhirContactPointSystemSchema.optional(),
  value: fhirStringSchema.optional(),
  use: fhirContactPointUseSchema.optional(),
  rank: fhirPositiveIntSchema.optional(),
  period: fhirPeriodSchema.optional(),
})

export type FHIRContactPoint = z.infer<typeof fhirContactPointSchema>

// ---------------------------------------------------------------------------
// FHIRAddress (used by Patient, Organization, etc.)
// ---------------------------------------------------------------------------

export const fhirAddressUseSchema = z.enum([
  'home',
  'work',
  'temp',
  'old',
  'billing',
])

export const fhirAddressTypeSchema = z.enum(['postal', 'physical', 'both'])

export const fhirAddressSchema = z.object({
  use: fhirAddressUseSchema.optional(),
  type: fhirAddressTypeSchema.optional(),
  text: fhirStringSchema.optional(),
  line: z.array(fhirStringSchema).optional(),
  city: fhirStringSchema.optional(),
  district: fhirStringSchema.optional(),
  state: fhirStringSchema.optional(),
  postalCode: fhirStringSchema.optional(),
  country: fhirStringSchema.optional(),
  period: fhirPeriodSchema.optional(),
})

export type FHIRAddress = z.infer<typeof fhirAddressSchema>

// ---------------------------------------------------------------------------
// FHIRHumanName
// ---------------------------------------------------------------------------

export const fhirHumanNameUseSchema = z.enum([
  'usual',
  'official',
  'temp',
  'nickname',
  'anonymous',
  'old',
  'maiden',
])

export const fhirHumanNameSchema = z.object({
  use: fhirHumanNameUseSchema.optional(),
  text: fhirStringSchema.optional(),
  family: fhirStringSchema.optional(),
  given: z.array(fhirStringSchema).optional(),
  prefix: z.array(fhirStringSchema).optional(),
  suffix: z.array(fhirStringSchema).optional(),
  period: fhirPeriodSchema.optional(),
})

export type FHIRHumanName = z.infer<typeof fhirHumanNameSchema>

// ---------------------------------------------------------------------------
// FHIRExtensionList helper — array of extensions used on many resources
// ---------------------------------------------------------------------------

export const fhirExtensionListSchema = z.array(fhirExtensionSchema)
export type FHIRExtensionList = z.infer<typeof fhirExtensionListSchema>

// ---------------------------------------------------------------------------
// FHIRBackboneElement — base for nested elements within resources
// ---------------------------------------------------------------------------

export const fhirBackboneElementSchema = z.object({
  id: fhirStringSchema.optional(),
  extension: fhirExtensionListSchema.optional(),
  modifierExtension: fhirExtensionListSchema.optional(),
})
export type FHIRBackboneElement = z.infer<typeof fhirBackboneElementSchema>

// ---------------------------------------------------------------------------
// FHIRDomainResource — base for all FHIR domain resources
// ---------------------------------------------------------------------------

export const fhirDomainResourceSchema = z.object({
  text: z
    .object({
      status: fhirNarrativeStatusSchema,
      div: fhirStringSchema,
    })
    .optional(),
  contained: z.array(z.record(z.unknown())).optional(),
  extension: fhirExtensionListSchema.optional(),
  modifierExtension: fhirExtensionListSchema.optional(),
})
export type FHIRDomainResource = z.infer<typeof fhirDomainResourceSchema>

// ---------------------------------------------------------------------------
// FHIRAttachment — for binary attachments (documents, images, etc.)
// ---------------------------------------------------------------------------

export const fhirAttachmentSchema = z.object({
  contentType: fhirStringSchema.optional(),
  language: fhirStringSchema.optional(),
  data: fhirStringSchema.optional(),
  url: fhirUrlSchema.optional(),
  size: fhirIntegerSchema.optional(),
  title: fhirStringSchema.optional(),
  hashes: z
    .array(
      z.object({
        algorithm: fhirStringSchema,
        value: fhirStringSchema,
      }),
    )
    .optional(),
})
export type FHIRAttachment = z.infer<typeof fhirAttachmentSchema>
