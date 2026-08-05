import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callAgent, pingHealth, HttpError, TimeoutError } from './http.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('callAgent', () => {
  it('sends POST to {endpoint}/eve/v1/{tool}', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { result: 'ok' }));

    const res = await callAgent({
      endpoint: 'http://localhost:2000',
      tool: 'review',
      body: { pr: 123 },
      timeoutMs: 5000,
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ result: 'ok' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:2000/eve/v1/review',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr: 123 }),
      }),
    );
  });

  it('strips trailing slash from endpoint', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, {}));

    await callAgent({
      endpoint: 'http://localhost:2000/',
      tool: 'review',
      body: {},
      timeoutMs: 5000,
    });

    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:2000/eve/v1/review',
    );
  });

  it('throws HttpError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(500, { error: 'oops' }));

    try {
      await callAgent({
        endpoint: 'http://localhost:2000',
        tool: 'review',
        body: {},
        timeoutMs: 5000,
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(500);
      expect((e as HttpError).endpoint).toBe('http://localhost:2000');
    }
  });

  it('throws HttpError on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    try {
      await callAgent({
        endpoint: 'http://localhost:2000',
        tool: 'review',
        body: {},
        timeoutMs: 5000,
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(0);
    }
  });

  it('handles non-JSON response gracefully', async () => {
    const res = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.reject(new Error('not JSON')),
    } as Response;
    mockFetch.mockResolvedValueOnce(res);

    const result = await callAgent({
      endpoint: 'http://localhost:2000',
      tool: 'review',
      body: {},
      timeoutMs: 5000,
    });

    expect(result.data).toEqual({ error: 'non-JSON response' });
  });

  it('throws TimeoutError on abort', async () => {
    // Simulate abort by rejecting with AbortError
    const abortError = new DOMException('aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    try {
      await callAgent({
        endpoint: 'http://localhost:2000',
        tool: 'review',
        body: {},
        timeoutMs: 1,
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TimeoutError);
      expect((e as TimeoutError).endpoint).toBe('http://localhost:2000');
    }
  });
});

describe('pingHealth', () => {
  it('returns ok for 200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const result = await pingHealth('http://localhost:2000', 5000);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.detail).toBeUndefined();
  });

  it('returns down for non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const result = await pingHealth('http://localhost:2000', 5000);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.detail).toBe('HTTP 503');
  });

  it('returns timeout on abort', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await pingHealth('http://localhost:2000', 1);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.detail).toBe('timeout');
  });

  it('returns error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await pingHealth('http://localhost:2000', 5000);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.detail).toBe('ECONNREFUSED');
  });

  it('strips trailing slash from endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await pingHealth('http://localhost:2000/', 5000);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:2000/eve/v1/health',
    );
  });

  it('uses default timeout of 5000ms', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await pingHealth('http://localhost:2000');
    // Verify it was called (default timeout applied internally)
    expect(mockFetch).toHaveBeenCalled();
  });
});
