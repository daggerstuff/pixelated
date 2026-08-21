/**
 * EHR REST API v1 — Barrel exports.
 *
 * Re-exports all types, endpoint definitions, handler factory, and
 * OpenAPI 3.1 specification from the EHR REST API module.
 */

// Types
export type {
  APIRequestContext,
  APIResponse,
  EndpointGroup,
  EndpointDefinition,
} from './types.js'

// Endpoint definitions
export { ENDPOINT_GROUPS, ALL_ENDPOINT_GROUPS } from './endpoints.js'

// Handler factory
export {
  extractAPIRequestContext,
  toFHIRRequestContext,
  buildFHIRRequest,
  resolveEndpoint,
  processEHRRequest,
  createEndpointHandler,
} from './handler.js'

// OpenAPI 3.1
export { generateOpenAPISpec, OPENAPI_JSON } from './openapi.js'
export type { OpenAPISpec } from './openapi.js'
