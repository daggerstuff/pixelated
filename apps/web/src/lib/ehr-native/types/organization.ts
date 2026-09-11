import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirContactPointSchema,
  fhirAddressSchema,
  fhirReferenceSchema,
} from "./base.js";
import { z } from "zod";

/** FHIR R4 Organization resource schema. @see http://hl7.org/fhir/R4/organization.html */
export const organizationSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal("Organization"),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: z.boolean().optional(),
  type: z.array(fhirCodeableConceptSchema).optional(),
  name: z.string().optional(),
  alias: z.array(z.string()).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  address: z.array(fhirAddressSchema).optional(),
  partOf: fhirReferenceSchema.optional(),
  contact: z
    .array(
      z.object({
        purpose: fhirCodeableConceptSchema.optional(),
        name: z.array(z.string()).optional(),
        telecom: z.array(fhirContactPointSchema).optional(),
        address: fhirAddressSchema.optional(),
      }),
    )
    .optional(),
  endpoint: z.array(fhirReferenceSchema).optional(),
});

export type Organization = z.infer<typeof organizationSchema>;
