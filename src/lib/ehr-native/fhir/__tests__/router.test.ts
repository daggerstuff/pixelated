/**
 * Tests for FHIR R4 router — resource type routing and dispatch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all handlers the router dispatches to
vi.mock('../capability-statement.js', () => ({
  capabilityStatementResponse: vi.fn(),
}));

vi.mock('../crud.js', () => ({
  createResource: vi.fn(),
  readResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
}));

vi.mock('../search.js', () => ({
  searchResources: vi.fn(),
}));

vi.mock('../history.js', () => ({
  getResourceHistory: vi.fn(),
}));

import { routeFHIRRequest } from '../router.js';
import { capabilityStatementResponse } from '../capability-statement.js';
import { createResource, readResource, updateResource, deleteResource } from '../crud.js';
import { searchResources } from '../search.js';
import { getResourceHistory } from '../history.js';
import type { FHIRRequest, FHIRRequestContext, FHIRResponse } from '../types.js';

const BASE_URL = 'https://example.com/fhir/r4';

const mockContext: FHIRRequestContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  role: 'physician',
  breakGlass: false,
  jwtClaims: { sub: 'user-001', role: 'physician' },
};

const mockResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: { resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'informational', diagnostics: 'OK' }] },
};

describe('routeFHIRRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes metadata to capabilityStatementResponse', async () => {
    vi.mocked(capabilityStatementResponse).mockReturnValue(mockResponse);

    const request: FHIRRequest = {
      method: 'GET',
      resourceType: null,
      resourceId: null,
      isHistory: false,
      isMetadata: true,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(capabilityStatementResponse).toHaveBeenCalledWith(BASE_URL);
    expect(result).toBe(mockResponse);
  });

  it('returns 400 for unknown resource type', async () => {
    const request: FHIRRequest = {
      method: 'GET',
      resourceType: null,
      resourceId: null,
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(result.status).toBe(400);
  });

  it('routes GET /{ResourceType}/{id} to readResource', async () => {
    vi.mocked(readResource).mockResolvedValue(mockResponse);

    const request: FHIRRequest = {
      method: 'GET',
      resourceType: 'Patient',
      resourceId: 'p1',
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(readResource).toHaveBeenCalledWith('Patient', 'p1', mockContext);
    expect(result).toBe(mockResponse);
  });

  it('routes GET /{ResourceType} to searchResources', async () => {
    vi.mocked(searchResources).mockResolvedValue(mockResponse);

    const params = new URLSearchParams('name=Smith');
    const request: FHIRRequest = {
      method: 'GET',
      resourceType: 'Patient',
      resourceId: null,
      isHistory: false,
      isMetadata: false,
      searchParams: params,
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(searchResources).toHaveBeenCalledWith('Patient', params, mockContext, BASE_URL);
    expect(result).toBe(mockResponse);
  });

  it('routes POST /{ResourceType} to createResource', async () => {
    vi.mocked(createResource).mockResolvedValue(mockResponse);

    const body = { resourceType: 'Patient', name: [{ family: 'Doe' }] };
    const request: FHIRRequest = {
      method: 'POST',
      resourceType: 'Patient',
      resourceId: null,
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(createResource).toHaveBeenCalledWith('Patient', body, mockContext, BASE_URL);
    expect(result).toBe(mockResponse);
  });

  it('routes PUT /{ResourceType}/{id} to updateResource', async () => {
    vi.mocked(updateResource).mockResolvedValue(mockResponse);

    const body = { resourceType: 'Patient', id: 'p1', name: [{ family: 'Doe' }] };
    const request: FHIRRequest = {
      method: 'PUT',
      resourceType: 'Patient',
      resourceId: 'p1',
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body,
      ifMatch: 'W/"1"',
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(updateResource).toHaveBeenCalledWith('Patient', 'p1', body, mockContext, 'W/"1"');
    expect(result).toBe(mockResponse);
  });

  it('routes DELETE /{ResourceType}/{id} to deleteResource', async () => {
    vi.mocked(deleteResource).mockResolvedValue(mockResponse);

    const request: FHIRRequest = {
      method: 'DELETE',
      resourceType: 'Patient',
      resourceId: 'p1',
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(deleteResource).toHaveBeenCalledWith('Patient', 'p1', mockContext);
    expect(result).toBe(mockResponse);
  });

  it('routes GET /{ResourceType}/{id}/_history to getResourceHistory', async () => {
    vi.mocked(getResourceHistory).mockResolvedValue(mockResponse);

    const request: FHIRRequest = {
      method: 'GET',
      resourceType: 'Patient',
      resourceId: 'p1',
      isHistory: true,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(getResourceHistory).toHaveBeenCalledWith('Patient', 'p1', mockContext, BASE_URL);
    expect(result).toBe(mockResponse);
  });

  it('returns 400 for non-GET history request', async () => {
    const request: FHIRRequest = {
      method: 'POST',
      resourceType: 'Patient',
      resourceId: 'p1',
      isHistory: true,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(result.status).toBe(400);
  });

  it('returns 400 for history without resource ID', async () => {
    const request: FHIRRequest = {
      method: 'GET',
      resourceType: 'Patient',
      resourceId: null,
      isHistory: true,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(result.status).toBe(400);
  });

  it('returns 400 for POST to a specific resource ID', async () => {
    const request: FHIRRequest = {
      method: 'POST',
      resourceType: 'Patient',
      resourceId: 'p1',
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(result.status).toBe(400);
  });

  it('returns 400 for PUT without resource ID', async () => {
    const request: FHIRRequest = {
      method: 'PUT',
      resourceType: 'Patient',
      resourceId: null,
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(result.status).toBe(400);
  });

  it('returns 400 for DELETE without resource ID', async () => {
    const request: FHIRRequest = {
      method: 'DELETE',
      resourceType: 'Patient',
      resourceId: null,
      isHistory: false,
      isMetadata: false,
      searchParams: new URLSearchParams(),
      body: null,
      ifMatch: null,
      context: mockContext,
    };

    const result = await routeFHIRRequest(request, BASE_URL);

    expect(result.status).toBe(400);
  });
});
