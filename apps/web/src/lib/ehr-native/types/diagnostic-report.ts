import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirDateTimeSchema,
  fhirInstantSchema,
  fhirAttachmentSchema,
  fhirBackboneElementSchema,
} from "./base.js";
import { z } from "zod";

/** FHIR R4 DiagnosticReport resource schema. @see http://hl7.org/fhir/R4/diagnosticreport.html */
export const diagnosticReportSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal("DiagnosticReport"),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    "registered",
    "partial",
    "preliminary",
    "final",
    "amended",
    "corrected",
    "appended",
    "cancelled",
    "entered-in-error",
    "unknown",
  ]),
  category: z.array(fhirCodeableConceptSchema).optional(),
  code: fhirCodeableConceptSchema,
  subject: fhirReferenceSchema.optional(),
  encounter: fhirReferenceSchema.optional(),
  effectiveDateTime: fhirDateTimeSchema.optional(),
  effectivePeriod: fhirPeriodSchema.optional(),
  issued: fhirInstantSchema.optional(),
  performer: z
    .array(
      z.object({
        function: fhirCodeableConceptSchema.optional(),
        actor: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  resultsInterpreter: z
    .array(
      z.object({
        function: fhirCodeableConceptSchema.optional(),
        actor: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  specimen: z.array(fhirReferenceSchema).optional(),
  result: z.array(fhirReferenceSchema).optional(),
  imagingStudy: z.array(fhirReferenceSchema).optional(),
  conclusion: z.string().optional(),
  conclusionCode: z.array(fhirCodeableConceptSchema).optional(),
  presentedForm: z.array(fhirAttachmentSchema).optional(),
});

export type DiagnosticReport = z.infer<typeof diagnosticReportSchema>;
