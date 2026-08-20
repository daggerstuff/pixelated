/**
 * Tests for FHIR R4 OperationOutcome error helpers.
 */

import { describe, it, expect } from 'vitest'

import {
  createOperationOutcome,
  createErrorResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  preconditionFailed,
  unprocessableEntity,
  internalServerError,
  notImplemented,
} from '../error.js'
import type { OperationOutcome } from '../types.js'

describe('createOperationOutcome', () => {
  it('creates an OperationOutcome with a single issue', () => {
    const outcome = createOperationOutcome(
      'error',
      'not-found',
      'Resource not found',
    )
    expect(outcome.resourceType).toBe('OperationOutcome')
    expect(outcome.issue).toHaveLength(1)
    expect(outcome.issue[0].severity).toBe('error')
    expect(outcome.issue[0].code).toBe('not-found')
    expect(outcome.issue[0].diagnostics).toBe('Resource not found')
    expect(outcome.issue[0].details?.text).toBe('Resource not found')
  })

  it('includes expression when provided', () => {
    const outcome = createOperationOutcome('error', 'invalid', 'Bad value', [
      'field1',
    ])
    expect(outcome.issue[0].expression).toEqual(['field1'])
  })

  it('omits expression when not provided', () => {
    const outcome = createOperationOutcome('warning', 'structure', 'Warning')
    expect(outcome.issue[0].expression).toBeUndefined()
  })
})

describe('createErrorResponse', () => {
  it('returns a FHIRResponse with correct status and content type', () => {
    const response = createErrorResponse(400, 'error', 'invalid', 'Bad request')
    expect(response.status).toBe(400)
    expect(response.headers['Content-Type']).toBe('application/fhir+json')
    const body = response.body as OperationOutcome
    expect(body.resourceType).toBe('OperationOutcome')
  })
})

describe('error helper functions', () => {
  it('badRequest returns 400 with error/invalid', () => {
    const res = badRequest('Invalid input')
    expect(res.status).toBe(400)
    const body = res.body as OperationOutcome
    expect(body.issue[0].severity).toBe('error')
    expect(body.issue[0].code).toBe('invalid')
    expect(body.issue[0].diagnostics).toBe('Invalid input')
  })

  it('unauthorized returns 401 with error/login and default message', () => {
    const res = unauthorized()
    expect(res.status).toBe(401)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('login')
    expect(body.issue[0].diagnostics).toBe('Authentication required.')
  })

  it('unauthorized accepts custom message', () => {
    const res = unauthorized('Token expired')
    const body = res.body as OperationOutcome
    expect(body.issue[0].diagnostics).toBe('Token expired')
  })

  it('forbidden returns 403 with error/forbidden and default message', () => {
    const res = forbidden()
    expect(res.status).toBe(403)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('forbidden')
    expect(body.issue[0].diagnostics).toBe('Access denied.')
  })

  it('notFound returns 404 with resource type and id in message', () => {
    const res = notFound('Patient', '123')
    expect(res.status).toBe(404)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('not-found')
    expect(body.issue[0].diagnostics).toContain('Patient')
    expect(body.issue[0].diagnostics).toContain('123')
  })

  it('conflict returns 409 with error/conflict', () => {
    const res = conflict('Version mismatch')
    expect(res.status).toBe(409)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('conflict')
  })

  it('preconditionFailed returns 412 with error/conflict', () => {
    const res = preconditionFailed()
    expect(res.status).toBe(412)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('conflict')
  })

  it('preconditionFailed accepts custom message', () => {
    const res = preconditionFailed('ETag mismatch')
    const body = res.body as OperationOutcome
    expect(body.issue[0].diagnostics).toBe('ETag mismatch')
  })

  it('unprocessableEntity returns 422 with error/structure', () => {
    const res = unprocessableEntity('Validation failed', ['field1', 'field2'])
    expect(res.status).toBe(422)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('structure')
    expect(body.issue[0].expression).toEqual(['field1', 'field2'])
  })

  it('internalServerError returns 500 with error/exception', () => {
    const res = internalServerError()
    expect(res.status).toBe(500)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('exception')
    expect(body.issue[0].diagnostics).toBe('Internal server error.')
  })

  it('notImplemented returns 501 with error/not-supported', () => {
    const res = notImplemented('PATCH not supported')
    expect(res.status).toBe(501)
    const body = res.body as OperationOutcome
    expect(body.issue[0].code).toBe('not-supported')
  })
})
