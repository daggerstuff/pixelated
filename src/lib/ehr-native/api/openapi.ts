/**
 * EHR REST API v1 — OpenAPI 3.1 specification generator.
 *
 * Generates an OpenAPI 3.1 spec from the endpoint definitions, including
 * FHIR R4 resource type schemas, Bearer auth security scheme, and servers.
 */

import { ALL_ENDPOINT_GROUPS, ENDPOINT_GROUPS } from './endpoints.js'
import type { EndpointDefinition, EndpointGroup } from './types.js'

/** OpenAPI 3.1 specification object. */
export interface OpenAPISpec {
  openapi: '3.1.0'
  info: {
    title: string
    version: string
    description: string
    license: { name: string; url: string }
  }
  servers: Array<{ url: string; description: string }>
  paths: Record<string, Record<string, unknown>>
  components: {
    schemas: Record<string, Record<string, unknown>>
    securitySchemes: Record<string, Record<string, unknown>>
  }
  security: Array<Record<string, unknown>>
}

/** FHIR R4 resource type schemas referenced by the API. */
const FHIR_RESOURCE_SCHEMAS: Record<string, Record<string, unknown>> = {
  Patient: {
    type: 'object',
    description: 'FHIR R4 Patient resource — demographics and administrative data.',
    properties: {
      resourceType: { type: 'string', enum: ['Patient'] },
      id: { type: 'string' },
      name: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            family: { type: 'string' },
            given: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      birthDate: { type: 'string' },
      gender: { type: 'string' },
      identifier: { type: 'array', items: { type: 'object' } },
    },
  },
  Encounter: {
    type: 'object',
    description: 'FHIR R4 Encounter resource — healthcare interaction.',
    properties: {
      resourceType: { type: 'string', enum: ['Encounter'] },
      id: { type: 'string' },
      status: { type: 'string' },
      class: { type: 'object' },
      subject: { type: 'object' },
      period: { type: 'object' },
    },
  },
  Appointment: {
    type: 'object',
    description: 'FHIR R4 Appointment resource — scheduled healthcare visit.',
    properties: {
      resourceType: { type: 'string', enum: ['Appointment'] },
      id: { type: 'string' },
      status: { type: 'string' },
      start: { type: 'string', format: 'date-time' },
      end: { type: 'string', format: 'date-time' },
      participant: { type: 'array', items: { type: 'object' } },
    },
  },
  DocumentReference: {
    type: 'object',
    description: 'FHIR R4 DocumentReference — clinical note document.',
    properties: {
      resourceType: { type: 'string', enum: ['DocumentReference'] },
      id: { type: 'string' },
      status: { type: 'string' },
      type: { type: 'object' },
      content: { type: 'array', items: { type: 'object' } },
      context: { type: 'object' },
    },
  },
  Claim: {
    type: 'object',
    description: 'FHIR R4 Claim resource — billing and insurance claim.',
    properties: {
      resourceType: { type: 'string', enum: ['Claim'] },
      id: { type: 'string' },
      status: { type: 'string' },
      type: { type: 'object' },
      patient: { type: 'object' },
      item: { type: 'array', items: { type: 'object' } },
    },
  },
  Consent: {
    type: 'object',
    description: 'FHIR R4 Consent resource — patient consent directives.',
    properties: {
      resourceType: { type: 'string', enum: ['Consent'] },
      id: { type: 'string' },
      status: { type: 'string' },
      scope: { type: 'object' },
      patient: { type: 'object' },
      provision: { type: 'array', items: { type: 'object' } },
    },
  },
  Observation: {
    type: 'object',
    description: 'FHIR R4 Observation resource — clinical measurement.',
    properties: {
      resourceType: { type: 'string', enum: ['Observation'] },
      id: { type: 'string' },
      status: { type: 'string' },
      code: { type: 'object' },
      subject: { type: 'object' },
      valueQuantity: { type: 'object' },
    },
  },
  Error: {
    type: 'object',
    description: 'Standard error response.',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['error', 'message'],
  },
}

/** HTTP method → OpenAPI operation key. */
const METHOD_MAP: Record<string, 'get' | 'post' | 'put' | 'delete'> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
}

/**
 * Convert an endpoint path pattern (e.g. '/patients/:id') to an
 * OpenAPI path template (e.g. '/patients/{id}').
 */
function toOpenAPIPath(path: string): string {
  return path.replace(/:id/g, '{id}')
}

/**
 * Build an OpenAPI operation object for a single endpoint.
 */
function buildOperation(endpoint: EndpointDefinition): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    summary: endpoint.description,
    operationId: `${endpoint.operation}_${endpoint.resourceType}_${endpoint.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    tags: [endpoint.resourceType],
    security: [{ BearerAuth: [] }],
    responses: {},
  }

  const responses: Record<string, unknown> = {}

  switch (endpoint.operation) {
    case 'search': {
      responses['200'] = {
        description: 'Search results',
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.resourceType}` },
          },
        },
      }
      break
    }
    case 'read': {
      responses['200'] = {
        description: `${endpoint.resourceType} resource`,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.resourceType}` },
          },
        },
      }
      break
    }
    case 'create': {
      responses['201'] = {
        description: 'Created resource',
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.resourceType}` },
          },
        },
      }
      operation['requestBody'] = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.resourceType}` },
          },
        },
      }
      break
    }
    case 'update': {
      responses['200'] = {
        description: 'Updated resource',
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.resourceType}` },
          },
        },
      }
      operation['requestBody'] = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${endpoint.resourceType}` },
          },
        },
      }
      break
    }
    case 'delete': {
      responses['204'] = { description: 'Deleted' }
      break
    }
  }

  // Common error responses
  responses['401'] = {
    description: 'Authentication required',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  }
  responses['403'] = {
    description: 'Permission denied',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  }
  responses['404'] = {
    description: 'Resource not found',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  }

  operation['responses'] = responses
  return operation
}

/**
 * Generate the complete OpenAPI 3.1 specification from endpoint definitions.
 */
export function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const group of ALL_ENDPOINT_GROUPS) {
    const endpoints = ENDPOINT_GROUPS[group]
    for (const endpoint of endpoints) {
      const openApiPath = toOpenAPIPath(endpoint.path)
      const methodKey = METHOD_MAP[endpoint.method]
      if (methodKey === undefined) continue

      paths[openApiPath] ??= {}
      paths[openApiPath][methodKey] = buildOperation(endpoint)
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'EHR REST API v1',
      version: '1.0.0',
      description:
        'Higher-level REST API surface for EHR native operations. Wraps the FHIR R4 internal server with RBAC enforcement, audit logging, and JSON (non-FHIR) request/response format.',
      license: {
        name: 'Apache-2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0',
      },
    },
    servers: [
      {
        url: '/api/ehr/v1',
        description: 'Relative server URL',
      },
    ],
    paths,
    components: {
      schemas: FHIR_RESOURCE_SCHEMAS,
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Auth0 Bearer JWT token',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  }
}

/** Pre-computed OpenAPI 3.1 spec as a plain object. */
export const OPENAPI_JSON: OpenAPISpec = generateOpenAPISpec()
