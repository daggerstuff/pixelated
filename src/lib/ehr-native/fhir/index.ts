/**
 * FHIR R4 internal server — barrel exports.
 *
 * @see https://hl7.org/fhir/R4/http.html
 */

// Server entry point
export { handleFHIRRequest } from './server.js'

// Router
export { routeFHIRRequest } from './router.js'

// CRUD operations
export {
  createResource,
  readResource,
  updateResource,
  deleteResource,
} from './crud.js'

// Search
export { searchResources } from './search.js'

// History
export { getResourceHistory } from './history.js'

// CapabilityStatement
export {
  generateCapabilityStatement,
  capabilityStatementResponse,
} from './capability-statement.js'

// Validation
export {
  validateResource,
  validateResourceType,
  isSupportedResourceType,
  getRegistryEntry,
  RESOURCE_REGISTRY,
  SCHEMA_REGISTRY,
} from './validation.js'

// Error helpers
export {
  createOperationOutcome,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  preconditionFailed,
  unprocessableEntity,
  internalServerError,
  notImplemented,
} from './error.js'

// Types (re-export from types.ts)
export type {
  FHIRResourceType,
  FHIRRequestContext,
  FHIRRequest,
  FHIRResponse,
  FHIRBundle,
  OperationOutcome,
  IssueSeverity,
  IssueCode,
  ResourceRegistryEntry,
} from './types.js'

// Repository functions (for advanced use)
export {
  createGenericResource,
  readGenericResource,
  updateGenericResource,
  softDeleteGenericResource,
  searchGenericResources,
  getGenericResourceHistory,
  insertGenericResourceHistory,
} from './repositories/generic.js'

export {
  createDedicatedResource,
  readDedicatedResource,
  updateDedicatedResource,
  softDeleteDedicatedResource,
  searchDedicatedResources,
  getDedicatedResourceHistory,
  insertDedicatedResourceHistory,
} from './repositories/dedicated.js'
