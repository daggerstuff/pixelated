import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirDateTimeSchema,
  fhirBackboneElementSchema,
} from "./base.js";
import { z } from "zod";

/** FHIR R4 Procedure resource schema. @see http://hl7.org/fhir/R4/procedure.html */
export const procedureSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal("Procedure"),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    "preparation",
    "in-progress",
    "not-done",
    "on-hold",
    "stopped",
    "completed",
    "entered-in-error",
    "unknown",
  ]),
  statusReason: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.optional(),
  code: fhirCodeableConceptSchema.optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  occurrenceDateTime: fhirDateTimeSchema.optional(),
  occurrencePeriod: fhirPeriodSchema.optional(),
  recorded: fhirDateTimeSchema.optional(),
  recorder: fhirReferenceSchema.optional(),
  asserter: fhirReferenceSchema.optional(),
  performer: z
    .array(
      z.object({
        function: fhirCodeableConceptSchema.optional(),
        actor: fhirReferenceSchema.optional(),
        onBehalfOf: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  complication: z.array(fhirCodeableConceptSchema).optional(),
  complicationDetail: z.array(fhirReferenceSchema).optional(),
  followUp: z.array(fhirCodeableConceptSchema).optional(),
  note: z.array(z.object({ text: z.string() })).optional(),
  usedCode: z.array(fhirCodeableConceptSchema).optional(),
  usedReference: z.array(fhirReferenceSchema).optional(),
});

export type Procedure = z.infer<typeof procedureSchema>;
