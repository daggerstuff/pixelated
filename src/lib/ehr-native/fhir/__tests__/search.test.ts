/**
 * Tests for FHIR R4 search parameter parsing and query building.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock repository functions
vi.mock('../repositories/index.js', () => ({
  searchDedicatedResources: vi.fn(),
  searchGenericResources: vi.fn(),
}))

import { searchResources } from '../search.js'
import {
  searchDedicatedResources,
  searchGenericResources,
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

describe('searchResources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with a Bundle for a dedicated resource type', async () => {
    const mockResources = [
      { resourceType: 'Patient', id: 'p1' },
      { resourceType: 'Patient', id: 'p2' },
    ]
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: mockResources,
      total: 2,
    })

    const params = new URLSearchParams()
    const result = await searchResources(
      'Patient',
      params,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(200)
    expect(result.headers['Content-Type']).toBe('application/fhir+json')
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('Bundle')
    expect(body['type']).toBe('searchset')
    expect(body['total']).toBe(2)
  })

  it('returns 200 with a Bundle for a generic resource type', async () => {
    const mockResources = [{ resourceType: 'Condition', id: 'c1' }]
    vi.mocked(searchGenericResources).mockResolvedValue({
      resources: mockResources,
      total: 1,
    })

    const params = new URLSearchParams()
    const result = await searchResources(
      'Condition',
      params,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(200)
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('Bundle')
    expect(body['total']).toBe(1)
  })

  it('includes entry fullUrl with base URL and resource type', async () => {
    const mockResources = [{ resourceType: 'Patient', id: 'p1' }]
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: mockResources,
      total: 1,
    })

    const params = new URLSearchParams()
    const result = await searchResources(
      'Patient',
      params,
      mockContext,
      BASE_URL,
    )
    const body = result.body as Record<string, unknown>
    const entries = body['entry'] as Array<Record<string, unknown>>
    expect(entries[0]['fullUrl']).toBe(`${BASE_URL}/Patient/p1`)
  })

  it('includes self link in Bundle', async () => {
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: [],
      total: 0,
    })

    const params = new URLSearchParams()
    const result = await searchResources(
      'Patient',
      params,
      mockContext,
      BASE_URL,
    )
    const body = result.body as Record<string, unknown>
    const links = body['link'] as Array<Record<string, string>>
    const selfLink = links.find((l) => l['relation'] === 'self')
    expect(selfLink).toBeDefined()
    expect(selfLink!['url']).toContain('Patient')
  })

  it('includes next link when there are more results', async () => {
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: Array(20).fill({ resourceType: 'Patient', id: 'p' }),
      total: 50,
    })

    const params = new URLSearchParams('_count=20&_offset=0')
    const result = await searchResources(
      'Patient',
      params,
      mockContext,
      BASE_URL,
    )
    const body = result.body as Record<string, unknown>
    const links = body['link'] as Array<Record<string, string>>
    const nextLink = links.find((l) => l['relation'] === 'next')
    expect(nextLink).toBeDefined()
    expect(nextLink!['url']).toContain('_offset=20')
  })

  it('includes previous link when offset > 0', async () => {
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: [],
      total: 50,
    })

    const params = new URLSearchParams('_count=20&_offset=20')
    const result = await searchResources(
      'Patient',
      params,
      mockContext,
      BASE_URL,
    )
    const body = result.body as Record<string, unknown>
    const links = body['link'] as Array<Record<string, string>>
    const prevLink = links.find((l) => l['relation'] === 'previous')
    expect(prevLink).toBeDefined()
    expect(prevLink!['url']).toContain('_offset=0')
  })

  it('returns 500 on error', async () => {
    vi.mocked(searchDedicatedResources).mockRejectedValue(new Error('DB error'))

    const params = new URLSearchParams()
    const result = await searchResources(
      'Patient',
      params,
      mockContext,
      BASE_URL,
    )

    expect(result.status).toBe(500)
    const body = result.body as Record<string, unknown>
    expect(body['resourceType']).toBe('OperationOutcome')
  })

  it('respects _count parameter (max 100)', async () => {
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: [],
      total: 0,
    })

    const params = new URLSearchParams('_count=200')
    await searchResources('Patient', params, mockContext, BASE_URL)

    // The function injects parsed pagination back into searchParams
    expect(params.get('_count')).toBe('100')
  })

  it('uses default _count of 20 when not specified', async () => {
    vi.mocked(searchDedicatedResources).mockResolvedValue({
      resources: [],
      total: 0,
    })

    const params = new URLSearchParams()
    await searchResources('Patient', params, mockContext, BASE_URL)

    expect(params.get('_count')).toBe('20')
  })
})
