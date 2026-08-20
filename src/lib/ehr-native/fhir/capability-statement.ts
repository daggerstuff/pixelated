/**
 * FHIR R4 CapabilityStatement generation.
 *
 * Produces a FHIR R4 conformant CapabilityStatement describing the
 * server's supported resources, interactions, and search parameters.
 *
 * @see https://hl7.org/fhir/R4/capabilitystatement.html
 */

import { SUPPORTED_RESOURCE_TYPES } from './types.js'
import type { FHIRResourceType, FHIRResponse } from './types.js'

/** FHIR R4 RESTful interaction codes. */
type RestInteraction =
  'read' | 'search-type' | 'create' | 'update' | 'delete' | 'history-instance'

/** Common search parameters available on all resource types. */
const COMMON_SEARCH_PARAMS = [
  { name: '_id', type: 'token', documentation: 'Logical id of the resource' },
  {
    name: '_count',
    type: 'number',
    documentation: 'Number of resources to return per page',
  },
  {
    name: '_offset',
    type: 'number',
    documentation: 'Starting offset for pagination',
  },
  { name: '_format', type: 'token', documentation: 'Response format (json)' },
]

/** Resource-specific search parameters. */
const RESOURCE_SEARCH_PARAMS: Partial<
  Record<
    FHIRResourceType,
    Array<{ name: string; type: string; documentation: string }>
  >
> = {
  Patient: [
    {
      name: 'name',
      type: 'string',
      documentation: 'A portion of the name of the patient',
    },
    {
      name: 'family',
      type: 'string',
      documentation: 'A portion of the family name of the patient',
    },
    {
      name: 'given',
      type: 'string',
      documentation: 'A portion of the given name of the patient',
    },
    {
      name: 'identifier',
      type: 'token',
      documentation: 'A patient identifier (e.g. MRN)',
    },
    {
      name: 'birthdate',
      type: 'date',
      documentation: "The patient's date of birth",
    },
    { name: 'gender', type: 'token', documentation: 'Gender of the patient' },
    {
      name: 'active',
      type: 'token',
      documentation: 'Whether the patient record is active',
    },
  ],
  Practitioner: [
    {
      name: 'name',
      type: 'string',
      documentation: "A portion of the practitioner's name",
    },
    {
      name: 'family',
      type: 'string',
      documentation: 'A portion of the family name',
    },
    {
      name: 'given',
      type: 'string',
      documentation: 'A portion of the given name',
    },
    {
      name: 'identifier',
      type: 'token',
      documentation: 'A practitioner identifier (e.g. NPI)',
    },
    {
      name: 'active',
      type: 'token',
      documentation: 'Whether the practitioner record is active',
    },
  ],
  Encounter: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient present at the encounter',
    },
    {
      name: 'practitioner',
      type: 'reference',
      documentation: 'The practitioner present at the encounter',
    },
    {
      name: 'status',
      type: 'token',
      documentation: 'The status of the encounter',
    },
    {
      name: 'class',
      type: 'token',
      documentation: 'The class of the encounter',
    },
    { name: 'date', type: 'date', documentation: 'The date of the encounter' },
  ],
  Observation: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject that the observation is about',
    },
    {
      name: 'encounter',
      type: 'reference',
      documentation: 'The encounter associated with the observation',
    },
    {
      name: 'code',
      type: 'token',
      documentation: 'The code of the observation type',
    },
    {
      name: 'status',
      type: 'token',
      documentation: 'The status of the observation',
    },
    {
      name: 'date',
      type: 'date',
      documentation: 'The date/time of the observation',
    },
  ],
  Condition: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the condition',
    },
    { name: 'code', type: 'token', documentation: 'The code of the condition' },
    {
      name: 'clinical-status',
      type: 'token',
      documentation: 'The clinical status of the condition',
    },
  ],
  AllergyIntolerance: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the allergy',
    },
    {
      name: 'code',
      type: 'token',
      documentation: 'The substance/code of the allergy',
    },
    {
      name: 'clinical-status',
      type: 'token',
      documentation: 'The clinical status of the allergy',
    },
  ],
  MedicationRequest: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the medication request',
    },
    { name: 'code', type: 'token', documentation: 'The medication code' },
    {
      name: 'status',
      type: 'token',
      documentation: 'The status of the request',
    },
  ],
  Medication: [
    { name: 'code', type: 'token', documentation: 'The medication code' },
    { name: 'status', type: 'token', documentation: 'The medication status' },
  ],
  Immunization: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient who received the immunization',
    },
    { name: 'code', type: 'token', documentation: 'The vaccine code' },
    { name: 'status', type: 'token', documentation: 'The immunization status' },
  ],
  Procedure: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the procedure',
    },
    { name: 'code', type: 'token', documentation: 'The procedure code' },
    { name: 'status', type: 'token', documentation: 'The procedure status' },
    { name: 'date', type: 'date', documentation: 'The date of the procedure' },
  ],
  DiagnosticReport: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the report',
    },
    { name: 'code', type: 'token', documentation: 'The report code' },
    { name: 'status', type: 'token', documentation: 'The report status' },
    { name: 'date', type: 'date', documentation: 'The date of the report' },
  ],
  Appointment: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient of the appointment',
    },
    {
      name: 'practitioner',
      type: 'reference',
      documentation: 'The practitioner of the appointment',
    },
    { name: 'status', type: 'token', documentation: 'The appointment status' },
    { name: 'date', type: 'date', documentation: 'The appointment date' },
  ],
  Schedule: [
    {
      name: 'actor',
      type: 'reference',
      documentation: 'The actor of the schedule',
    },
    { name: 'status', type: 'token', documentation: 'The schedule status' },
  ],
  Slot: [
    {
      name: 'schedule',
      type: 'reference',
      documentation: 'The schedule for the slot',
    },
    { name: 'status', type: 'token', documentation: 'The slot status' },
    { name: 'start', type: 'date', documentation: 'The slot start date/time' },
  ],
  Claim: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient of the claim',
    },
    { name: 'status', type: 'token', documentation: 'The claim status' },
    { name: 'use', type: 'token', documentation: 'The claim use' },
  ],
  ClaimResponse: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient of the claim response',
    },
    {
      name: 'status',
      type: 'token',
      documentation: 'The claim response status',
    },
  ],
  Coverage: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient covered by the coverage',
    },
    { name: 'status', type: 'token', documentation: 'The coverage status' },
  ],
  ExplanationOfBenefit: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient of the EOB',
    },
    { name: 'status', type: 'token', documentation: 'The EOB status' },
  ],
  DocumentReference: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the document',
    },
    { name: 'type', type: 'token', documentation: 'The document type' },
    {
      name: 'status',
      type: 'token',
      documentation: 'The document reference status',
    },
  ],
  Communication: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the communication',
    },
    {
      name: 'status',
      type: 'token',
      documentation: 'The communication status',
    },
  ],
  CommunicationRequest: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the communication request',
    },
    {
      name: 'status',
      type: 'token',
      documentation: 'The communication request status',
    },
  ],
  Consent: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The patient of the consent',
    },
    { name: 'status', type: 'token', documentation: 'The consent status' },
    { name: 'scope', type: 'token', documentation: 'The consent scope' },
  ],
  ServiceRequest: [
    {
      name: 'patient',
      type: 'reference',
      documentation: 'The subject of the service request',
    },
    { name: 'code', type: 'token', documentation: 'The service code' },
    {
      name: 'status',
      type: 'token',
      documentation: 'The service request status',
    },
  ],
}

/** All interactions supported by this server. */
const ALL_INTERACTIONS: RestInteraction[] = [
  'read',
  'search-type',
  'create',
  'update',
  'delete',
  'history-instance',
]

/** Build a single resource entry for the CapabilityStatement. */
function buildResourceEntry(resourceType: FHIRResourceType) {
  const specificParams = RESOURCE_SEARCH_PARAMS[resourceType] ?? []
  const searchParams = [...COMMON_SEARCH_PARAMS, ...specificParams]

  return {
    type: resourceType,
    interaction: ALL_INTERACTIONS.map((code) => ({
      code,
      documentation: `Supports ${code} on ${resourceType} resources.`,
    })),
    searchParam: searchParams,
    versioning: 'versioned',
    readHistory: true,
    updateCreate: true,
    conditionalCreate: false,
    conditionalUpdate: false,
    conditionalDelete: 'not-supported',
  }
}

/** Generate the full FHIR R4 CapabilityStatement. */
export function generateCapabilityStatement(
  baseUrl: string,
): Record<string, unknown> {
  const now = new Date().toISOString()

  return {
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: now.split('T')[0],
    publisher: 'Pixelated Empathy',
    kind: 'instance',
    implementation: {
      description: 'Pixelated Empathy FHIR R4 Internal Server',
      url: baseUrl,
    },
    fhirVersion: '4.0.1',
    format: ['json'],
    patchFormat: [],
    rest: [
      {
        mode: 'server',
        documentation:
          'Pixelated Empathy FHIR R4 internal server with tenant-aware RLS, consent-gated access, and audit logging.',
        security: {
          cors: false,
          service: [
            {
              coding: [
                {
                  system:
                    'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'OAuth',
                  display: 'OAuth2',
                },
              ],
              text: 'JWT-based authentication with tenant isolation and RBAC',
            },
          ],
        },
        resource: SUPPORTED_RESOURCE_TYPES.map(buildResourceEntry),
        interaction: [
          {
            code: 'transaction',
            documentation: 'Not supported in this version.',
          },
        ],
        operation: [
          {
            name: 'metadata',
            definition: `${baseUrl}/metadata`,
            documentation: 'Returns this CapabilityStatement.',
          },
        ],
      },
    ],
  }
}

/** Return the CapabilityStatement as a FHIRResponse. */
export function capabilityStatementResponse(baseUrl: string): FHIRResponse {
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/fhir+json',
      'Cache-Control': 'no-store',
    },
    body: generateCapabilityStatement(baseUrl),
  }
}
