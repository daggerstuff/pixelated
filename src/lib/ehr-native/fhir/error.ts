/**
 * FHIR R4 OperationOutcome error helpers.
 *
 * All errors are returned as FHIR R4 OperationOutcome resources per
 * https://hl7.org/fhir/R4/operationoutcome.html.
 */

import type {
  IssueSeverity,
  IssueCode,
  OperationOutcome,
  FHIRResponse,
} from './types.js'

/** Create an OperationOutcome resource. */
export function createOperationOutcome(
  severity: IssueSeverity,
  code: IssueCode,
  diagnostics: string,
  expression?: string[],
): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity,
        code,
        diagnostics,
        details: { text: diagnostics },
        ...(expression ? { expression } : {}),
      },
    ],
  }
}

/** Create a FHIR response with an OperationOutcome error. */
export function createErrorResponse(
  status: number,
  severity: IssueSeverity,
  code: IssueCode,
  diagnostics: string,
  expression?: string[],
): FHIRResponse {
  return {
    status,
    headers: { 'Content-Type': 'application/fhir+json' },
    body: createOperationOutcome(severity, code, diagnostics, expression),
  }
}

/** 400 Bad Request. */
export function badRequest(message: string): FHIRResponse {
  return createErrorResponse(400, 'error', 'invalid', message)
}

/** 401 Unauthorized. */
export function unauthorized(
  message = 'Authentication required.',
): FHIRResponse {
  return createErrorResponse(401, 'error', 'login', message)
}

/** 403 Forbidden. */
export function forbidden(message = 'Access denied.'): FHIRResponse {
  return createErrorResponse(403, 'error', 'forbidden', message)
}

/** 404 Not Found. */
export function notFound(resourceType: string, id: string): FHIRResponse {
  return createErrorResponse(
    404,
    'error',
    'not-found',
    `Resource ${resourceType}/${id} not found.`,
  )
}

/** 409 Conflict. */
export function conflict(message: string): FHIRResponse {
  return createErrorResponse(409, 'error', 'conflict', message)
}

/** 412 Precondition Failed (If-Match mismatch). */
export function preconditionFailed(
  message = 'ETag mismatch — resource has been modified.',
): FHIRResponse {
  return createErrorResponse(412, 'error', 'conflict', message)
}

/** 422 Unprocessable Entity (validation error). */
export function unprocessableEntity(
  message: string,
  expression?: string[],
): FHIRResponse {
  return createErrorResponse(422, 'error', 'structure', message, expression)
}

/** 500 Internal Server Error. */
export function internalServerError(
  message = 'Internal server error.',
): FHIRResponse {
  return createErrorResponse(500, 'error', 'exception', message)
}

/** 501 Not Implemented. */
export function notImplemented(message: string): FHIRResponse {
  return createErrorResponse(501, 'error', 'not-supported', message)
}
