/**
 * Tests for FHIR R4 CapabilityStatement generation.
 */

import { describe, it, expect } from 'vitest'
import {
  generateCapabilityStatement,
  capabilityStatementResponse,
} from '../capability-statement.js'
import { SUPPORTED_RESOURCE_TYPES } from '../types.js'

const BASE_URL = 'https://example.com/fhir/r4'

describe('generateCapabilityStatement', () => {
  const cs = generateCapabilityStatement(BASE_URL) as Record<string, unknown>

  it('returns a CapabilityStatement resource', () => {
    expect(cs['resourceType']).toBe('CapabilityStatement')
  })

  it('has status active', () => {
    expect(cs['status']).toBe('active')
  })

  it('has FHIR version 4.0.1', () => {
    expect(cs['fhirVersion']).toBe('4.0.1')
  })

  it('supports only json format', () => {
    expect(cs['format']).toEqual(['json'])
  })

  it('has kind instance', () => {
    expect(cs['kind']).toBe('instance')
  })

  it('has publisher set', () => {
    expect(cs['publisher']).toBeDefined()
  })

  it('has date in ISO date format', () => {
    const date = cs['date'] as string
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('has implementation with description and url', () => {
    const impl = cs['implementation'] as Record<string, unknown>
    expect(impl['description']).toBeDefined()
    expect(impl['url']).toBe(BASE_URL)
  })

  it('has exactly one rest entry with mode server', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    expect(rest).toHaveLength(1)
    expect(rest[0]['mode']).toBe('server')
  })

  it('has security with cors false and OAuth service', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const security = rest[0]['security'] as Record<string, unknown>
    expect(security['cors']).toBe(false)
    expect(security['service']).toBeDefined()
  })

  it('lists all 23 supported resource types', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    expect(resources).toHaveLength(SUPPORTED_RESOURCE_TYPES.length)
    const types = resources.map((r) => r['type'])
    for (const rt of SUPPORTED_RESOURCE_TYPES) {
      expect(types).toContain(rt)
    }
  })

  it('each resource has all 6 interactions', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      const interactions = res['interaction'] as Array<Record<string, string>>
      const codes = interactions.map((i) => i['code'])
      expect(codes).toContain('read')
      expect(codes).toContain('search-type')
      expect(codes).toContain('create')
      expect(codes).toContain('update')
      expect(codes).toContain('delete')
      expect(codes).toContain('history-instance')
    }
  })

  it('each resource has common search params', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      const searchParams = res['searchParam'] as Array<Record<string, string>>
      const names = searchParams.map((p) => p['name'])
      expect(names).toContain('_id')
      expect(names).toContain('_count')
      expect(names).toContain('_offset')
      expect(names).toContain('_format')
    }
  })

  it('Patient resource has resource-specific search params', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    const patient = resources.find((r) => r['type'] === 'Patient')
    expect(patient).toBeDefined()
    const searchParams = patient!['searchParam'] as Array<
      Record<string, string>
    >
    const names = searchParams.map((p) => p['name'])
    expect(names).toContain('name')
    expect(names).toContain('family')
    expect(names).toContain('given')
    expect(names).toContain('identifier')
    expect(names).toContain('birthdate')
    expect(names).toContain('gender')
    expect(names).toContain('active')
  })

  it('has metadata operation defined', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const operations = rest[0]['operation'] as Array<Record<string, string>>
    const metadataOp = operations.find((op) => op['name'] === 'metadata')
    expect(metadataOp).toBeDefined()
    expect(metadataOp!['definition']).toBe(`${BASE_URL}/metadata`)
  })

  it('each resource has versioned and readHistory true', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      expect(res['versioning']).toBe('versioned')
      expect(res['readHistory']).toBe(true)
      expect(res['updateCreate']).toBe(true)
    }
  })
})

describe('capabilityStatementResponse', () => {
  it('returns a 200 FHIRResponse with correct headers', () => {
    const response = capabilityStatementResponse(BASE_URL)
    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toBe('application/fhir+json')
    expect(response.headers['Cache-Control']).toBe('no-store')
  })

  it('body is a CapabilityStatement resource', () => {
    const response = capabilityStatementResponse(BASE_URL)
    const body = response.body as Record<string, unknown>
    expect(body['resourceType']).toBe('CapabilityStatement')
  })
})
