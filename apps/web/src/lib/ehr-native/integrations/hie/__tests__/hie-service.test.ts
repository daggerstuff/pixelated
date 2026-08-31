import { describe, expect, it, vi } from 'vitest'

import type { HIEAdapter } from '../adapter'
import { HIEService, sanitizeDocumentQuery } from '../hie-service'
import type { DocumentQueryRequest, DocumentQueryResult } from '../types'

const request: DocumentQueryRequest = {
  patientId: ' patient-001 ',
  authorOrganizationId: ' org-001 ',
  fromDate: '2026-01-01',
  toDate: '2026-01-31',
  limit: 5_000,
  offset: -10,
}

const result: DocumentQueryResult = {
  documents: [],
  total: 0,
  hasMore: false,
}

function makeAdapter(): HIEAdapter {
  return {
    network: 'carequality',
    discoverPatient: vi.fn(),
    queryDocuments: vi.fn().mockResolvedValue(result),
    retrieveDocument: vi.fn(),
    submitDocument: vi.fn(),
    queryOrganizationDirectory: vi.fn(),
  }
}

describe('sanitizeDocumentQuery', () => {
  it('trims identifiers and bounds pagination inputs', () => {
    expect(sanitizeDocumentQuery(request)).toEqual({
      ...request,
      patientId: 'patient-001',
      authorOrganizationId: 'org-001',
      limit: 1000,
      offset: 0,
    })
  })

  it('rejects identifiers that are not HIE tokens', () => {
    expect(() =>
      sanitizeDocumentQuery({ ...request, patientId: 'Patient/../secret' }),
    ).toThrow('Invalid patientId: expected an HIE identifier token')
  })

  it('rejects malformed date filters', () => {
    expect(() =>
      sanitizeDocumentQuery({ ...request, fromDate: '2026/01/01' }),
    ).toThrow('Invalid fromDate: expected an ISO 8601 date or timestamp')
  })
})

describe('HIEService.queryDocuments', () => {
  it('sends only the sanitized query to the adapter', async () => {
    const adapter = makeAdapter()
    const service = new HIEService(adapter)

    await expect(service.queryDocuments(request)).resolves.toEqual(result)
    expect(adapter.queryDocuments).toHaveBeenCalledWith(
      sanitizeDocumentQuery(request),
    )
  })
})
