// @vitest-environment node
/**
 * Tests for FHIR R4 CRUD operations orchestration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-001'),
}))

// Mock repository functions
vi.mock('../repositories/index.js', () => ({
  createDedicatedResource: vi.fn(),
  readDedicatedResource: vi.fn(),
  updateDedicatedResource: vi.fn(),
  softDeleteDedicatedResource: vi.fn(),
  createGenericResource: vi.fn(),
  readGenericResource: vi.fn(),
  updateGenericResource: vi.fn(),
  softDeleteGenericResource: vi.fn(),
  insertDedicatedResourceHistory: vi.fn(),
  insertGenericResourceHistory: vi.fn(),
}))

// Mock audit
vi.mock('@/lib/audit', () => ({
  AuditEventType: {
    CREATE: 'CREATE',
    MODIFY: 'MODIFY',
    DELETE: 'DELETE',
    ACCESS: 'ACCESS',
  },
}))

import {
  createResource,
  readResource,
  updateResource,
  deleteResource,
} from '../crud.js'
import {
  createDedicatedResource,
  readDedicatedResource,
  updateDedicatedResource,
  softDeleteDedicatedResource,
  createGenericResource,
  readGenericResource,
  updateGenericResource,
  softDeleteGenericResource,
  insertDedicatedResourceHistory,
  insertGenericResourceHistory,
} from '../repositories/index.js'
import type { FHIRRequestContext } from '../types.js'

const mockContext: FHIRRequestContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  role: 'physician',
  breakGlass: false,
  jwtClaims: { sub: 'user-001', role: 'physician' },
}

const BASE_URL = 'https://example.com/fhir/r4'

const validPatient = {
  resourceType: 'Patient',
  name: [{ family: 'Doe', given: ['John'] }],
  gender: 'male',
  birthDate: '1990-01-01',
}

describe('createResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a valid Patient and returns 201 with Location header', async () => {
    vi.mocked(createDedicatedResource).mockResolvedValue({
      ...validPatient,
      id: 'test-uuid-001',
    })
    vi.mocked(insertDedicatedResourceHistory).mockResolvedValue(undefined)

    const result = await createResource(
      'Patient',
      validPatient,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(201)
    expect(result.headers['Location']).toBe(
      `${BASE_URL}/Patient/${(result.body as Record<string, unknown>)['id']}`,
    )
    expect(result.headers['ETag']).toBeDefined()
    expect(result.headers['Content-Type']).toBe('application/fhir+json')
    expect(createDedicatedResource).toHaveBeenCalledOnce()
    expect(insertDedicatedResourceHistory).toHaveBeenCalledOnce()
  })

  it('creates a generic resource (Condition)', async () => {
    const condition = {
      resourceType: 'Condition',
      subject: { reference: 'Patient/p1' },
    }
    vi.mocked(createGenericResource).mockResolvedValue({
      ...condition,
      id: 'cond-1',
    })
    vi.mocked(insertGenericResourceHistory).mockResolvedValue(undefined)

    const result = await createResource(
      'Condition',
      condition,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(201)
    expect(createGenericResource).toHaveBeenCalledOnce()
    expect(insertGenericResourceHistory).toHaveBeenCalledOnce()
  })

  it('returns 422 for type mismatch', async () => {
    const wrongType = {
      resourceType: 'Practitioner',
      name: [{ family: 'Doe' }],
    }
    const result = await createResource(
      'Patient',
      wrongType,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(422)
    expect(createDedicatedResource).not.toHaveBeenCalled()
  })

  it('returns 422 for validation failure', async () => {
    const invalidPatient = { resourceType: 'Patient', name: 'not-an-array' }
    const result = await createResource(
      'Patient',
      invalidPatient,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(422)
    expect(createDedicatedResource).not.toHaveBeenCalled()
  })

  it('returns 500 when persistence fails', async () => {
    vi.mocked(createDedicatedResource).mockResolvedValue(null)

    const result = await createResource(
      'Patient',
      validPatient,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(500)
  })

  it('returns 500 on exception', async () => {
    vi.mocked(createDedicatedResource).mockRejectedValue(new Error('DB error'))

    const result = await createResource(
      'Patient',
      validPatient,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(500)
  })
})

describe('readResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with resource and ETag/Last-Modified headers', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })

    const result = await readResource('Patient', 'p1', mockContext)

    expect(result.status).toBe(200)
    expect(result.headers['ETag']).toBeDefined()
    expect(result.headers['Last-Modified']).toBeDefined()
    expect(result.headers['Content-Type']).toBe('application/fhir+json')
  })

  it('returns 404 when resource not found', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue(null)

    const result = await readResource('Patient', 'nonexistent', mockContext)

    expect(result.status).toBe(404)
  })

  it('returns 410 Gone for soft-deleted resource', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: false,
    })

    const result = await readResource('Patient', 'p1', mockContext)

    expect(result.status).toBe(410)
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('OperationOutcome')
  })

  it('reads from generic repository for generic resources', async () => {
    vi.mocked(readGenericResource).mockResolvedValue({
      resource: { resourceType: 'Condition', id: 'c1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })

    const result = await readResource('Condition', 'c1', mockContext)

    expect(result.status).toBe(200)
    expect(readGenericResource).toHaveBeenCalledOnce()
  })

  it('returns 500 on exception', async () => {
    vi.mocked(readDedicatedResource).mockRejectedValue(new Error('DB error'))

    const result = await readResource('Patient', 'p1', mockContext)

    expect(result.status).toBe(500)
  })
})

describe('updateResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates an existing resource and returns 200', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })
    vi.mocked(updateDedicatedResource).mockResolvedValue({
      ...validPatient,
      id: 'p1',
    })
    vi.mocked(insertDedicatedResourceHistory).mockResolvedValue(undefined)

    const result = await updateResource(
      'Patient',
      'p1',
      { ...validPatient, id: 'p1' },
      mockContext,
      null,
    )

    expect(result.status).toBe(200)
    expect(result.headers['ETag']).toBeDefined()
    expect(updateDedicatedResource).toHaveBeenCalledOnce()
    expect(insertDedicatedResourceHistory).toHaveBeenCalledOnce()
  })

  it('returns 422 for type mismatch', async () => {
    const wrongType = {
      resourceType: 'Practitioner',
      id: 'p1',
      name: [{ family: 'Doe' }],
    }
    const result = await updateResource(
      'Patient',
      'p1',
      wrongType,
      mockContext,
      null,
    )

    expect(result.status).toBe(422)
  })

  it('returns 409 when body id does not match path id', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })

    const result = await updateResource(
      'Patient',
      'p1',
      { ...validPatient, id: 'different-id' },
      mockContext,
      null,
    )

    expect(result.status).toBe(409)
  })

  it('returns 412 when If-Match provided but resource does not exist', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue(null)

    const result = await updateResource(
      'Patient',
      'nonexistent',
      { ...validPatient, id: 'nonexistent' },
      mockContext,
      'W/"1"',
    )

    expect(result.status).toBe(412)
  })

  it('returns 500 when update fails', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })
    vi.mocked(updateDedicatedResource).mockResolvedValue(null)

    const result = await updateResource(
      'Patient',
      'p1',
      { ...validPatient, id: 'p1' },
      mockContext,
      null,
    )

    expect(result.status).toBe(500)
  })
})

describe('deleteResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('soft-deletes a resource and returns 204', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })
    vi.mocked(softDeleteDedicatedResource).mockResolvedValue(true)
    vi.mocked(insertDedicatedResourceHistory).mockResolvedValue(undefined)

    const result = await deleteResource('Patient', 'p1', mockContext)

    expect(result.status).toBe(204)
    expect(softDeleteDedicatedResource).toHaveBeenCalledOnce()
    expect(insertDedicatedResourceHistory).toHaveBeenCalledOnce()
  })

  it('returns 404 when resource not found', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue(null)

    const result = await deleteResource('Patient', 'nonexistent', mockContext)

    expect(result.status).toBe(404)
  })

  it('returns 204 when already deleted (idempotent)', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: false,
    })

    const result = await deleteResource('Patient', 'p1', mockContext)

    expect(result.status).toBe(204)
    expect(softDeleteDedicatedResource).not.toHaveBeenCalled()
  })

  it('returns 500 when soft delete fails', async () => {
    vi.mocked(readDedicatedResource).mockResolvedValue({
      resource: { ...validPatient, id: 'p1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })
    vi.mocked(softDeleteDedicatedResource).mockResolvedValue(false)

    const result = await deleteResource('Patient', 'p1', mockContext)

    expect(result.status).toBe(500)
  })

  it('deletes from generic repository for generic resources', async () => {
    vi.mocked(readGenericResource).mockResolvedValue({
      resource: { resourceType: 'Condition', id: 'c1' },
      updatedAt: '2024-01-01T00:00:00.000Z',
      active: true,
    })
    vi.mocked(softDeleteGenericResource).mockResolvedValue(true)
    vi.mocked(insertGenericResourceHistory).mockResolvedValue(undefined)

    const result = await deleteResource('Condition', 'c1', mockContext)

    expect(result.status).toBe(204)
    expect(softDeleteGenericResource).toHaveBeenCalledOnce()
  })
})
