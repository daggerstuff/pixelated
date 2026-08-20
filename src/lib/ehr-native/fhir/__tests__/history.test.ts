/**
 * Tests for FHIR R4 version history retrieval.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repository functions
vi.mock('../repositories/index.js', () => ({
  getDedicatedResourceHistory: vi.fn(),
  getGenericResourceHistory: vi.fn(),
}))

import { getResourceHistory } from '../history.js'
import {
  getDedicatedResourceHistory,
  getGenericResourceHistory,
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

describe('getResourceHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with a history Bundle for a dedicated resource', async () => {
    const mockHistory = [
      {
        resource: { resourceType: 'Patient', id: 'p1' },
        timestamp: '2024-01-01T00:00:00Z',
        action: 'create',
      },
      {
        resource: { resourceType: 'Patient', id: 'p1' },
        timestamp: '2024-01-02T00:00:00Z',
        action: 'update',
      },
    ]
    vi.mocked(getDedicatedResourceHistory).mockResolvedValue(mockHistory)

    const result = await getResourceHistory(
      'Patient',
      'p1',
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(200)
    expect(result.headers['Content-Type']).toBe('application/fhir+json')
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('Bundle')
    expect(body['type']).toBe('history')
    expect(body['total']).toBe(2)
  })

  it('returns 200 with a history Bundle for a generic resource', async () => {
    const mockHistory = [
      {
        resource: { resourceType: 'Condition', id: 'c1' },
        timestamp: '2024-01-01T00:00:00Z',
        action: 'create',
      },
    ]
    vi.mocked(getGenericResourceHistory).mockResolvedValue(mockHistory)

    const result = await getResourceHistory(
      'Condition',
      'c1',
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(200)
    const body = result.body as Record<string, unknown>
    expect(body['total']).toBe(1)
  })

  it('returns 404 when no history exists', async () => {
    vi.mocked(getDedicatedResourceHistory).mockResolvedValue([])

    const result = await getResourceHistory(
      'Patient',
      'nonexistent',
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(404)
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('OperationOutcome')
  })

  it('includes entry request method based on action', async () => {
    const mockHistory = [
      {
        resource: { resourceType: 'Patient', id: 'p1' },
        timestamp: '2024-01-01T00:00:00Z',
        action: 'create',
      },
      {
        resource: { resourceType: 'Patient', id: 'p1' },
        timestamp: '2024-01-03T00:00:00Z',
        action: 'delete',
      },
    ]
    vi.mocked(getDedicatedResourceHistory).mockResolvedValue(mockHistory)

    const result = await getResourceHistory(
      'Patient',
      'p1',
      mockContext,
      BASE_URL,
    )
    const body = result.body as Record<string, unknown>
    const entries = body['entry'] as Array<Record<string, unknown>>
    const createEntry = entries.find((e) => {
      const req = e['request'] as Record<string, string>
      return req['method'] === 'POST'
    })
    expect(createEntry).toBeDefined()
    const deleteEntry = entries.find((e) => {
      const req = e['request'] as Record<string, string>
      return req['method'] === 'DELETE'
    })
    expect(deleteEntry).toBeDefined()
  })

  it('includes self link in history Bundle', async () => {
    vi.mocked(getDedicatedResourceHistory).mockResolvedValue([
      {
        resource: { resourceType: 'Patient', id: 'p1' },
        timestamp: '2024-01-01T00:00:00Z',
        action: 'create',
      },
    ])

    const result = await getResourceHistory(
      'Patient',
      'p1',
      mockContext,
      BASE_URL,
    )
    const body = result.body as Record<string, unknown>
    const links = body['link'] as Array<Record<string, string>>
    const selfLink = links.find((l) => l['relation'] === 'self')
    expect(selfLink).toBeDefined()
    expect(selfLink!['url']).toContain('_history')
  })

  it('returns 500 on error', async () => {
    vi.mocked(getDedicatedResourceHistory).mockRejectedValue(
      new Error('DB error'),
    )

    const result = await getResourceHistory(
      'Patient',
      'p1',
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(500)
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('OperationOutcome')
  })
})
