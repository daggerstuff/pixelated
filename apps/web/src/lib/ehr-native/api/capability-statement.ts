/**
 * FHIR R4 CapabilityStatement Generator
 *
 * Generates a FHIR R4 CapabilityStatement that declares ONLY the resources
 * and operations actually implemented in the EHR module.
 *
 * Per ADR-002: FHIR R4 validated with Zod.
 * Per task PIX-4408: CapabilityStatement must validate against FHIR R4 profile.
 */

/**
 * The implemented FHIR R4 resource types in the EHR module.
 * Each type maps to a repository + API route pair.
 */
const IMPLEMENTED_FHIR_RESOURCES = [
  'Patient',
  'Encounter',
  'Observation',
  'Appointment',
  'Claim',
  'DocumentReference',
  'Consent',
] as const

type FhirResourceType = (typeof IMPLEMENTED_FHIR_RESOURCES)[number]

/**
 * The interactions supported per resource type.
 * Most resources support: read, search-type, create, patch.
 * Notes (DocumentReference) also support a custom "sign" operation.
 */
const RESOURCE_INTERACTIONS: Record<
  FhirResourceType,
  {
    read: boolean
    search: boolean
    create: boolean
    update: boolean
    patch: boolean
    delete: boolean
  }
> = {
  Patient: {
    read: true,
    search: true,
    create: true,
    update: false,
    patch: true,
    delete: true,
  },
  Encounter: {
    read: true,
    search: true,
    create: true,
    update: false,
    patch: true,
    delete: false,
  },
  Observation: {
    read: true,
    search: true,
    create: true,
    update: false,
    patch: true,
    delete: false,
  },
  Appointment: {
    read: true,
    search: true,
    create: true,
    update: false,
    patch: true,
    delete: false,
  },
  Claim: {
    read: true,
    search: false,
    create: true,
    update: false,
    patch: true,
    delete: false,
  },
  DocumentReference: {
    read: true,
    search: true,
    create: true,
    update: false,
    patch: false,
    delete: false,
  },
  Consent: {
    read: true,
    search: false,
    create: false,
    update: false,
    patch: false,
    delete: false,
  },
}

/**
 * Search parameters per resource type.
 * Only parameters actually supported by the API routes are declared.
 */
const SEARCH_PARAMS: Partial<
  Record<
    FhirResourceType,
    Array<{ name: string; type: string; definition?: string }>
  >
> = {
  Patient: [
    { name: 'q', type: 'string' },
    { name: 'active', type: 'token' },
  ],
  Encounter: [
    { name: 'patient', type: 'reference' },
    { name: 'status', type: 'token' },
    { name: 'practitioner', type: 'reference' },
    { name: 'start', type: 'date' },
    { name: 'end', type: 'date' },
  ],
  Observation: [
    { name: 'patient', type: 'reference' },
    { name: 'encounter', type: 'reference' },
    { name: 'code', type: 'token' },
    { name: 'status', type: 'token' },
    { name: 'start', type: 'date' },
    { name: 'end', type: 'date' },
  ],
  Appointment: [
    { name: 'patient', type: 'reference' },
    { name: 'status', type: 'token' },
    { name: 'practitioner', type: 'reference' },
    { name: 'start', type: 'date' },
    { name: 'end', type: 'date' },
    { name: 'upcoming', type: 'token' },
  ],
}

/**
 * The canonical FHIR R4 profile URL for a resource type.
 */
function fhirProfile(type: FhirResourceType): string {
  return `http://hl7.org/fhir/StructureDefinition/${type}`
}

/**
 * Builds a single resource entry for the CapabilityStatement rest.resources array.
 */
function buildResourceEntry(type: FhirResourceType) {
  const config = RESOURCE_INTERACTIONS[type]
  const interactions: Array<{ code: string }> = []

  if (config.read) interactions.push({ code: 'read' })
  if (config.search) interactions.push({ code: 'search-type' })
  if (config.create) interactions.push({ code: 'create' })
  if (config.update) interactions.push({ code: 'update' })
  if (config.patch) interactions.push({ code: 'patch' })
  if (config.delete) interactions.push({ code: 'delete' })

  const entry: Record<string, unknown> = {
    type,
    profile: fhirProfile(type),
    interaction: interactions,
  }

  const searchParams = SEARCH_PARAMS[type]
  if (searchParams && searchParams.length > 0) {
    entry['searchParam'] = searchParams.map((p) => ({
      name: p.name,
      type: p.type,
      ...(p.definition ? { definition: p.definition } : {}),
    }))
  }

  return entry
}

/**
 * Generates a FHIR R4 CapabilityStatement for the Pixelated EHR module.
 *
 * The statement declares:
 * - Only the 7 implemented FHIR R4 resource types
 * - Only the interactions actually supported (read, search-type, create, update, delete)
 * - Only the search parameters actually accepted by the API routes
 * - Patient compartment
 * - SMART-on-FHIR security with API key alternative
 *
 * @returns A FHIR R4 CapabilityStatement resource as a plain object
 */
export function generateCapabilityStatement(): Record<string, unknown> {
  const resources = IMPLEMENTED_FHIR_RESOURCES.map(buildResourceEntry)

  return {
    resourceType: 'CapabilityStatement',
    id: 'pixelated-ehr',
    status: 'active',
    date: new Date().toISOString().split('T')[0],
    publisher: 'Pixelated Empathy',
    name: 'PixelatedEHR',
    title: 'Pixelated EHR FHIR R4 Capability Statement',
    kind: 'instance',
    software: {
      name: 'Pixelated EHR',
      version: '1.0.0',
    },
    fhirVersion: '4.0.1',
    format: ['json'],
    patchFormat: 'application/fhir+json',
    implementation: {
      description: 'Pixelated Empathy EHR Module',
      url: 'https://api.pixelatedempathy.com',
    },
    rest: [
      {
        mode: 'server',
        documentation:
          'Pixelated Empathy EHR FHIR R4 API. Supports read, search, create, and patch ' +
          'operations for clinical resources with multi-tenant isolation (RLS), ' +
          'audit hash chaining, and consent-gated access.',
        security: {
          cors: true,
          service: [
            {
              coding: [
                {
                  system:
                    'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'SMART-on-FHIR',
                  display: 'SMART-on-FHIR',
                },
              ],
              text: 'SMART-on-FHIR OAuth2',
            },
            {
              coding: [
                {
                  system:
                    'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'API-Key',
                  display: 'API Key',
                },
              ],
              text: 'API Key authentication via X-API-Key header',
            },
          ],
          description:
            'Authentication via SMART-on-FHIR OAuth2 bearer token or API key (X-API-Key header). ' +
            'API keys are SHA-256 hashed at rest with scopes (read, write, admin). ' +
            'Multi-tenant isolation enforced via PostgreSQL Row-Level Security.',
        },
        resource: resources,
        interaction: [
          {
            code: 'search-system',
            documentation:
              'System-level search across all resource types is not supported. Use resource-level search.',
          },
        ],
        compartment: [
          {
            name: 'Patient',
          },
        ],
      },
    ],
  }
}
